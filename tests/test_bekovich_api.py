import os,unittest,json,tempfile
os.environ['DATABASE_URL']='sqlite:///:memory:'
from uuid import uuid4
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base,User,JeraTx
from disc_equipment import create_instance
from score_service import initialize_score_state
from bekovich_api import make_bekovich_router
from bekovich_models import BekovichOffer,BekovichDeal,BekovichItem
from bekovich_service import quote,accept,items_page,BekovichError

class BekovichApiTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool);Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions);self.actor=1
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='One',jera=100),User(id=2,first_name='Two',jera=100)]);db.flush();self.ids=[]
   for _ in range(3):
    row=create_instance(db,1,'minecraft','common',uuid4().hex);self.ids.append(row.id)
  def get_db():
   with self.sessions() as db:yield db
  app=FastAPI();app.include_router(make_bekovich_router(lambda:SimpleNamespace(id=self.actor),get_db));self.client=TestClient(app)
 def tearDown(self):self.client.close();self.engine.dispose()
 def test_validation_privacy_and_idempotent_accept(self):
  for ids in [[],['bad']*4]:self.assertEqual(self.client.post('/api/bekovich/quote',json={'discs':ids}).status_code,422)
  self.actor=2;self.assertEqual(self.client.post('/api/bekovich/quote',json={'discs':self.ids}).status_code,409);self.actor=1
  quoted=self.client.post('/api/bekovich/quote',json={'discs':self.ids});self.assertEqual(quoted.status_code,200,quoted.text);q=quoted.json();self.assertNotIn('kind',q)
  with self.sessions.begin() as db:
   row=db.get(BekovichOffer,q['id']);row.chest='worn';row.refused=False;row.reward_json=json.dumps({'kind':'coins','amount':50})
  body={'offer_id':q['id'],'discs':self.ids,'request_id':uuid4().hex}
  result=self.client.post('/api/bekovich/accept',json=body);self.assertEqual(result.status_code,200,result.text);item=result.json()['entry']
  again=self.client.post('/api/bekovich/accept',json=body);self.assertEqual(again.json()['balance'],150);self.assertEqual(again.json()['entry']['id'],item['id'])
  self.actor=2;self.assertEqual(self.client.post('/api/bekovich/items/'+item['id']+'/open').status_code,404)
  self.assertEqual(self.client.get('/api/bekovich').json()['stash'],[])

class BekovichConcurrencyTest(unittest.TestCase):
 def test_two_confirmations_spend_once_and_mint_once(self):
  with tempfile.TemporaryDirectory() as directory:
   engine=create_engine('sqlite:///'+str(Path(directory)/'bek.sqlite'),connect_args={'check_same_thread':False,'timeout':15});Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
   with sessions.begin() as db:
    db.add(User(id=1,first_name='One',jera=0));db.flush();ids=[]
    for _ in range(3):
     row=create_instance(db,1,'minecraft','common',uuid4().hex);ids.append(row.id)
    q=quote(db,1,ids);offer=db.get(BekovichOffer,q['id']);offer.refused=False;offer.reward_json=json.dumps({'kind':'coins','amount':50})
   key=uuid4().hex
   def run(_):
    with sessions.begin() as db:return accept(db,1,q['id'],ids,key)['entry']['id']
   with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,range(2)))
   self.assertEqual(results[0],results[1])
   with sessions() as db:
    self.assertEqual(db.get(User,1).jera,50);self.assertEqual(db.scalar(select(func.count()).select_from(BekovichDeal)),1);self.assertEqual(db.scalar(select(func.count()).select_from(BekovichItem)),1);self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
   engine.dispose()

class BekovichPageTest(unittest.TestCase):
 def test_equal_timestamps_do_not_duplicate_or_drop_receipts(self):
  from datetime import datetime
  engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine)
  with sessions.begin() as db:
   db.add_all([User(id=1,first_name='One',jera=0),User(id=2,first_name='Two',jera=0)]);db.flush()
   at=datetime.utcnow();offer=BekovichOffer(id=uuid4().hex,user_id=1,signature='test',assessment_json='{}',reward_json='{}',chest='worn');db.add(offer);db.flush()
   for _ in range(105):
    identity=uuid4().hex;db.add(BekovichDeal(id=identity,user_id=1,request_id=identity,offer_id=offer.id,discs_json='[]',created_at=at));db.flush();db.add(BekovichItem(id=identity,user_id=1,kind='coins',chest='worn',payload_json='{"kind":"coins","amount":5}',created_at=at))
   db.flush();one=items_page(db,1);two=items_page(db,1,one['next_cursor'])
   self.assertEqual(len(one['stash']),100);self.assertEqual(len(two['stash']),5);self.assertIsNone(two['next_cursor'])
   self.assertEqual(len({i['id'] for i in one['stash']+two['stash']}),105)
   with self.assertRaises(BekovichError):items_page(db,2,one['next_cursor'])
  engine.dispose()
