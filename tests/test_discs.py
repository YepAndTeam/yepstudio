import os,unittest,tempfile
os.environ['DATABASE_URL']='sqlite:///:memory:'
from uuid import uuid4
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from sqlalchemy import create_engine,select,func,event
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx,Meta
from disc_models import DiscCopy,DiscDraw,DiscRequest
from disc_service import open_disc,reveal_disc,disc_state,choose_disc,DiscError,CATALOG
from score_service import initialize_score_state

class DiscTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='One',jera=500),User(id=2,first_name='Two',jera=0)])
 def tearDown(self):self.engine.dispose()
 def test_hidden_result_is_persisted_and_read_only_until_reveal(self):
  with patch('disc_service.choose_disc',return_value=('minecraft','secret')):
   with self.sessions.begin() as db:answer=open_disc(db,1,uuid4().hex)
  self.assertEqual(answer['balance'],450);self.assertNotIn('rarity',answer['draw']);did=answer['draw']['id']
  with self.sessions() as db:
   state=disc_state(db,1);self.assertEqual(state['pending']['id'],did);self.assertNotIn('rarity',state['pending']);self.assertEqual(state['total_copies'],0)
   self.assertEqual(db.get(DiscDraw,did).rarity,'secret')
  with self.sessions.begin() as db:result=reveal_disc(db,1,did)
  self.assertEqual(result['draw']['rarity'],'secret');self.assertEqual(result['balance'],450);self.assertFalse(result['draw']['is_dupe'])
  with self.sessions() as db:self.assertEqual(disc_state(db,1)['collection'][0]['quantity'],1)
 def test_alias_retries_after_reveal_never_buy_a_second_disc(self):
  one,two=uuid4().hex,uuid4().hex
  with self.sessions.begin() as db:first=open_disc(db,1,one)
  with self.sessions.begin() as db:recovered=open_disc(db,1,two)
  self.assertEqual(first,recovered)
  with self.sessions.begin() as db:reveal_disc(db,1,first['draw']['id'])
  for request in (one,two):
   with self.sessions.begin() as db:
    result=open_disc(db,1,request);self.assertEqual(result['balance'],450);self.assertEqual(result['draw']['id'],first['draw']['id'])
  with self.sessions() as db:self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
 def test_duplicate_copies_are_kept_without_refund_or_double_grant(self):
  with patch('disc_service.choose_disc',return_value=('portal','legendary')):
   for number in (1,2):
    with self.sessions.begin() as db:draw=open_disc(db,1,uuid4().hex)['draw']
    with self.sessions.begin() as db:
     result=reveal_disc(db,1,draw['id']);replayed=reveal_disc(db,1,draw['id']);self.assertEqual(result,replayed);self.assertEqual(result['draw']['copy_number'],number)
  with self.sessions() as db:
   self.assertEqual(db.get(DiscCopy,(1,'portal','legendary')).quantity,2);self.assertEqual(db.get(User,1).jera,400)
 def test_ownership_insufficient_funds_and_maintenance(self):
  with self.sessions.begin() as db:
   with self.assertRaises(DiscError):open_disc(db,2,uuid4().hex)
  with self.sessions.begin() as db:draw=open_disc(db,1,uuid4().hex)['draw']
  with self.sessions.begin() as db:
   with self.assertRaises(DiscError):reveal_disc(db,2,draw['id'])
   db.get(Meta,'score_maintenance').value='1'
  with self.sessions.begin() as db:reveal_disc(db,1,draw['id'])
  with self.sessions.begin() as db:
   with self.assertRaises(DiscError):open_disc(db,1,uuid4().hex)
   self.assertEqual(db.scalar(select(func.count()).select_from(DiscDraw)),1)
 def test_catalogue_probabilities_and_transaction_rollback(self):
  self.assertEqual(sum(r['chance'] for r in CATALOG['rarities']),100)
  for boundary,expected in [(0,'common'),(5999,'common'),(6000,'rare'),(8499,'rare'),(8500,'epic'),(9500,'mythic'),(9900,'legendary'),(9990,'secret'),(9999,'secret')]:
   with patch('disc_service.secrets.randbelow',return_value=boundary):self.assertEqual(choose_disc()[1],expected)
  with self.assertRaises(RuntimeError):
   with self.sessions.begin() as db:open_disc(db,1,uuid4().hex);raise RuntimeError('rollback')
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,500);self.assertEqual(db.scalar(select(func.count()).select_from(DiscDraw)),0)
 def test_collection_get_only_selects_and_excludes_other_users(self):
  with self.sessions.begin() as db:draw=open_disc(db,1,uuid4().hex)['draw'];reveal_disc(db,1,draw['id'])
  sql=[];event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:sql.append(statement))
  with self.sessions() as db:state=disc_state(db,2)
  self.assertFalse(state['collection']);self.assertFalse(state['history']);self.assertIsNone(state['pending']);self.assertTrue(all(q.lstrip().upper().startswith('SELECT') for q in sql))
 def test_concurrent_open_requests_share_one_charge_and_pending_result(self):
  with tempfile.TemporaryDirectory() as folder:
   engine=create_engine('sqlite:///'+str(Path(folder)/'discs.db'),connect_args={'check_same_thread':False,'timeout':15});Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
   with sessions.begin() as db:db.add(User(id=1,first_name='One',jera=500))
   def buy(_):
    with sessions.begin() as db:return open_disc(db,1,uuid4().hex)['draw']['id']
   with ThreadPoolExecutor(max_workers=4) as pool:ids=list(pool.map(buy,range(8)))
   with sessions() as db:self.assertEqual(db.get(User,1).jera,450);self.assertEqual(len(set(ids)),1);self.assertEqual(db.scalar(select(func.count()).select_from(DiscRequest)),8)
   engine.dispose()

class DiscApiTest(unittest.TestCase):
 def setUp(self):
  from sqlalchemy.pool import StaticPool
  from fastapi import FastAPI
  from types import SimpleNamespace
  from disc_api import make_disc_router
  self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool);Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add(User(id=1,first_name='API',jera=100))
  def get_db():
   with self.sessions() as db:yield db
  from community_api import make_community_router
  self.actor=1;self.delivered=[]
  async def deliver_notice(identity):self.delivered.append(identity)
  get_user=lambda:SimpleNamespace(id=self.actor)
  app=FastAPI();app.include_router(make_disc_router(get_user,get_db));app.include_router(make_community_router(get_user,get_db,deliver_notice));self.app=app
  class Client:
   def request(client,method,path,json=None):
    import asyncio,json as codec
    from types import SimpleNamespace
    async def run():
     messages=[];received=False
     async def receive():
      nonlocal received
      if received:return {'type':'http.disconnect'}
      received=True;return {'type':'http.request','body':codec.dumps(json).encode() if json is not None else b'','more_body':False}
     async def send(message):messages.append(message)
     from urllib.parse import urlsplit
     parsed=urlsplit(path)
     scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','scheme':'http','method':method,'path':parsed.path,'raw_path':parsed.path.encode(),'query_string':parsed.query.encode(),'root_path':'','headers':[(b'content-type',b'application/json')],'server':('test',80),'client':('test',1)}
     await app(scope,receive,send)
     code=next(message['status'] for message in messages if message['type']=='http.response.start')
     body=b''.join(message.get('body',b'') for message in messages if message['type']=='http.response.body')
     return SimpleNamespace(status_code=code,json=lambda:codec.loads(body))
    return asyncio.run(run())
   def get(client,path):return client.request('GET',path)
   def post(client,path,json=None):return client.request('POST',path,json)
   def close(client):pass
  self.client=Client()
 def tearDown(self):self.client.close();self.engine.dispose()
 def test_http_open_reveal_retry_and_persistent_collection(self):
  request={'request_id':uuid4().hex}
  with patch('disc_service.choose_disc',return_value=('minecraft','mythic')):
   response=self.client.post('/api/discs/open',json=request)
  self.assertEqual(response.status_code,200);data=response.json();self.assertEqual(data['balance'],50);self.assertNotIn('rarity',data['draw'])
  self.assertNotIn('rarity',self.client.get('/api/discs').json()['pending'])
  revealed=self.client.post('/api/discs/'+data['draw']['id']+'/reveal').json();self.assertEqual(revealed['draw']['rarity'],'mythic')
  self.assertEqual(self.client.post('/api/discs/open',json=request).json()['balance'],50)
  state=self.client.get('/api/discs').json();self.assertEqual(state['total_copies'],1);self.assertIsNone(state['pending'])
 def test_invalid_request_does_not_debit_wallet(self):
  self.assertEqual(self.client.post('/api/discs/open',json={'request_id':'x'*32}).status_code,422)
  self.assertEqual(self.client.get('/api/discs').json()['balance'],100)

 def test_http_usb_claim_activate_and_retry(self):
  self.assertEqual(self.client.post('/api/discs/gift/activate').status_code,409)
  self.assertEqual(self.client.post('/api/discs/gift/claim').json()['launch_gift']['remaining'],0)
  self.assertEqual(self.client.post('/api/discs/gift/activate').json()['launch_gift']['remaining'],10)
  request={'request_id':uuid4().hex}
  opened=self.client.post('/api/discs/open',json=request).json()
  self.assertEqual(opened['draw']['price'],0);self.assertEqual(opened['balance'],100)
  self.assertEqual(self.client.post('/api/discs/gift/activate').json()['launch_gift']['remaining'],9)
  self.assertEqual(self.client.post('/api/discs/open',json=request).json()['launch_gift']['remaining'],9)

 def test_http_equipment_chat_and_confirmed_trade(self):
  from social_models import Friendship
  from disc_equipment import create_instance
  from disc_models import DiscInstance
  with self.sessions.begin() as db:
   db.add(User(id=2,first_name='Friend',jera=0));db.flush();db.add(Friendship(low_id=1,high_id=2,requested_by=1,status='accepted'));one=create_instance(db,1,'minecraft','rare',uuid4().hex);two=create_instance(db,2,'terraria','common',uuid4().hex);offered,wanted=one.id,two.id
  offer=self.client.post('/api/community/trades',json={'recipient_id':2,'offered':[offered],'wanted':[wanted],'request_id':uuid4().hex})
  self.assertEqual(offer.status_code,200);identity=offer.json()['id']
  self.assertEqual(self.client.post('/api/community/trades/'+identity+'/accept').status_code,403)
  self.actor=2;self.assertEqual(self.client.post('/api/community/trades/'+identity+'/accept').json()['status'],'accepted')
  active=self.client.post('/api/discs/equip',json={'instance_id':offered});self.assertEqual(active.status_code,200);self.assertEqual(active.json()['active']['id'],offered)
  self.actor=1;self.assertEqual(self.client.post('/api/discs/equip',json={'instance_id':offered}).status_code,404)
  self.assertEqual(self.client.post('/api/community/chat',json={'body':'hello'}).status_code,200)
  self.assertEqual(len(self.client.get('/api/community/chat').json()['messages']),1)
  self.actor=2;start=self.client.post('/api/disc-play/start',json={'game':'dino'});self.assertEqual(start.status_code,200)
  score=self.client.post('/api/disc-play/score',json={'game':'dino','run_id':start.json()['run_id'],'score':1});self.assertEqual(score.status_code,200);self.assertEqual(score.json()['mode'],'disc')
  self.assertEqual(self.client.get('/api/disc-play/top?game=dino').json()['my_best'],1)

 def test_http_market_reply_schedules_exactly_one_bot_notification(self):
  from disc_equipment import create_instance
  with self.sessions.begin() as db:
   db.add(User(id=3,first_name='Not a friend',jera=0));db.flush();one=create_instance(db,1,'doom','common',uuid4().hex);two=create_instance(db,3,'portal','rare',uuid4().hex);offered,wanted=one.id,two.id
  listing=self.client.post('/api/community/market',json={'offered':[offered],'wanted':{'rare':1},'request_id':uuid4().hex});self.assertEqual(listing.status_code,200)
  self.actor=3;body={'offered':[wanted],'request_id':uuid4().hex};path='/api/community/market/'+listing.json()['id']+'/reply'
  response=self.client.post(path,json=body);self.assertEqual(response.status_code,200);identity=response.json()['id'];self.assertEqual(self.delivered,[identity])
  self.assertEqual(self.client.post(path,json=body).json()['id'],identity);self.assertEqual(self.delivered,[identity])
  self.actor=1;self.assertEqual(self.client.post('/api/community/trades/'+identity+'/accept').json()['status'],'accepted')
