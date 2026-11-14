import os,unittest,json,time
import party_engine as game
os.environ['DATABASE_URL']='sqlite:///:memory:'
from fastapi import FastAPI,Depends,Header
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger,create_engine,select
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from database import Base,User
from party_models import PartyRoom,PartyMember,PartyPose
from party_api import make_party_router
class PartyApiTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool);Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine)
  with self.sessions.begin() as db:db.add_all([User(id=i,first_name=str(i),jera=100) for i in range(1,14)])
  def get_db():
   with self.sessions() as db:yield db
  def user(x_test_user:int=Header(default=1),db=Depends(get_db)):return db.get(User,x_test_user)
  app=FastAPI();app.include_router(make_party_router(user,get_db));self.client=TestClient(app)
 def tearDown(self):self.client.close();self.engine.dispose()
 def post(self,path,body=None,uid=1):return self.client.post('/api/party'+path,json=body or {},headers={'X-Test-User':str(uid)})
 def get(self,path,uid=1):return self.client.get('/api/party'+path,headers={'X-Test-User':str(uid)})
 def room(self,kind='mafia',public=True):
  r=self.post('',{'kind':kind,'capacity':4,'seats':1,'public':public});self.assertEqual(r.status_code,200,r.text);code=r.json()['code']
  for i in range(2,5):self.assertEqual(self.post('/'+code+'/join',uid=i).status_code,200)
  return code
 def command(self,code,kind,value=None,uid=1,nonce='a'*16,token=None):
  if token is None:token=self.get('/'+code,uid).json().get('phase_token','')
  return self.post('/'+code+'/action',{'id':nonce,'kind':kind,'value':value,'phase_token':token},uid)
 def test_create_private_join_and_spectator_secrets(self):
  code=self.room(public=False);self.assertEqual(self.get('/'+code,5).status_code,403);self.assertEqual(self.get('?kind=mafia',5).json()['rooms'],[])
  self.assertEqual(self.command(code,'start',uid=2).status_code,422)
  started=self.command(code,'start');self.assertEqual(started.status_code,200,started.text)
  own=next(p for p in started.json()['players'] if p['id']==1);self.assertIsNotNone(own['role'])
  self.assertTrue(all(p['role'] is None for p in started.json()['players'] if p['id']!=1))
 def test_retry_start_and_stale_phase(self):
  code=self.room();one=self.command(code,'start');two=self.command(code,'start');self.assertEqual(two.status_code,200);self.assertEqual(one.json()['players'],two.json()['players'])
  stale=self.command(code,'vote',2,nonce='b'*16,token='old');self.assertEqual(stale.status_code,409)
 def test_invalid_target_not_server_error(self):
  code=self.room();self.command(code,'start')
  for value in [999,'bad',None]:self.assertEqual(self.command(code,'night',value,nonce='b'*16).status_code,422)
 def test_chat_idempotent_and_wallet_untouched(self):
  code=self.room();body={'id':'c'*16,'text':'Привет'}
  first=self.post('/'+code+'/chat',body);again=self.post('/'+code+'/chat',body);self.assertEqual(first.status_code,200);self.assertEqual(len(again.json()['messages']),1)
  with self.sessions() as db:self.assertTrue(all(u.jera==100 for u in db.scalars(select(User)).all()))
 def test_full_lobby_and_no_join_after_start(self):
  code=self.room();self.assertEqual(self.post('/'+code+'/join',uid=5).status_code,422);self.command(code,'start');self.assertEqual(self.post('/'+code+'/join',uid=5).status_code,422)
  self.assertEqual(self.post('/'+code+'/join',uid=2).status_code,200)
 def test_commissar_shot_is_private_and_retry_does_not_add_an_action(self):
  code=self.room();self.command(code,'start')
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['players'][0]['role']='detective';s['players'][1]['role']='mafia';s['deadline']=time.time()+24;row.data_json=json.dumps(s)
  shot=self.command(code,'night_kill',2,nonce='shot'*4);self.assertEqual(shot.status_code,200,shot.text);self.assertEqual(shot.json()['my_action_kind'],'shoot')
  retry=self.command(code,'night_kill',2,nonce='shot'*4);self.assertEqual(retry.status_code,200)
  self.assertEqual(self.command(code,'night',3,nonce='check'*4).status_code,422)
  other=self.get('/'+code,2).json();self.assertIsNone(other['my_action_kind']);self.assertFalse(other['my_action'])
  with self.sessions() as db:
   s=json.loads(db.get(PartyRoom,code).data_json);self.assertEqual(len(s['actions']),1);self.assertEqual(s['actions']['1']['target'],2)
 def test_admin_timings_authorized_validated_and_snapshot_per_game(self):
  settings={'mafia':{'discussion_seconds':150,'vote_seconds':60},'bunker':{'discussion_seconds':240,'vote_seconds':90}}
  def put(body,uid=1):return self.client.put('/api/party/settings',json=body,headers={'X-Test-User':str(uid)})
  self.assertEqual(self.get('/settings').status_code,403);self.assertEqual(put(settings).status_code,403)
  with self.sessions.begin() as db:db.get(User,1).role='admin'
  self.assertEqual(self.get('/settings').json()['mafia']['discussion_seconds'],120)
  for invalid in [0,14,1801,True,1.5,'60']:
   body=json.loads(json.dumps(settings));body['mafia']['vote_seconds']=invalid;self.assertEqual(put(body).status_code,422)
  self.assertEqual(put(settings).status_code,200);self.assertEqual(self.get('/settings').json(),settings)
  code=self.room('bunker');started=self.command(code,'start').json();self.assertEqual(started['timings']['discussion'],240);self.assertAlmostEqual(started['deadline']-started['server_now'],240,delta=1)
  settings['bunker']['discussion_seconds']=300;self.assertEqual(put(settings).status_code,200)
  self.assertEqual(self.get('/'+code).json()['timings']['discussion'],240)
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['deadline']=time.time()-1;row.data_json=json.dumps(s)
  voted=self.get('/'+code).json();self.assertEqual(voted['phase'],'vote');self.assertAlmostEqual(voted['deadline']-voted['server_now'],90,delta=1)
 def test_narrator_directive_persists_and_wrong_card_is_rejected_by_api(self):
  code=self.room('bunker');self.command(code,'start')
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['phase']='vote';s['votes']={};s['deadline']=time.time()-1;row.data_json=json.dumps(s)
  first=self.get('/'+code).json();key=first['reveal_trait'];self.assertIsNotNone(key);self.assertEqual(self.get('/'+code).json()['reveal_trait'],key)
  wrong=next(k for k in first['players'][0]['traits'] if k not in ('profession',key))
  self.assertEqual(self.command(code,'reveal',wrong,nonce='wrong'*4).status_code,422)
  accepted=self.command(code,'reveal',key,nonce='right'*4);self.assertEqual(accepted.status_code,200,accepted.text)
  self.assertEqual(accepted.json()['reveal_trait'],key)
 def test_look_is_self_only_bounded_and_does_not_change_room_revision(self):
  code=self.room('bunker');self.command(code,'start')
  def look(body,uid=1):return self.post('/'+code+'/look',body,uid)
  with self.sessions() as db:revision=db.get(PartyRoom,code).revision
  self.assertEqual(look({'yaw':.8,'pitch':.1},5).status_code,422)
  for body in [{'yaw':2,'pitch':0},{'yaw':0,'pitch':-.6},{'yaw':0,'pitch':.5}]:self.assertEqual(look(body).status_code,422)
  self.assertTrue(look({'yaw':.8,'pitch':.1}).json()['ok'])
  public=self.get('/'+code,2).json();self.assertEqual(public['players'][0]['look'],{'yaw':.8,'pitch':.1})
  with self.sessions() as db:self.assertEqual(db.get(PartyRoom,code).revision,revision)
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['phase']='night';s['deadline']=time.time()+40;row.data_json=json.dumps(s)
  self.assertFalse(look({'yaw':-.8,'pitch':.1}).json()['ok']);self.assertTrue(all('look' not in p for p in self.get('/'+code,2).json()['players']))
 def test_targeted_gaze_points_to_a_member_and_manual_look_clears_it(self):
  code=self.room('bunker');self.command(code,'start')
  for target in (1,999):self.assertEqual(self.post('/'+code+'/look',{'yaw':0,'pitch':0,'target_id':target}).status_code,422)
  self.assertEqual(self.post('/'+code+'/look',{'yaw':0,'pitch':0,'target_id':2}).status_code,200)
  self.assertEqual(self.get('/'+code,2).json()['players'][0]['look']['target_id'],2)
  with self.sessions.begin() as db:db.get(PartyPose,(code,1)).look_updated=0
  self.post('/'+code+'/look',{'yaw':.4,'pitch':0});self.assertNotIn('target_id',self.get('/'+code,2).json()['players'][0]['look'])
 def test_emote_is_public_idempotent_rate_limited_and_expires(self):
  code=self.room('bunker');self.command(code,'start');body={'id':'wave-test-0000001','name':'wave'}
  self.assertEqual(self.post('/'+code+'/emote',body,5).status_code,422)
  self.assertEqual(self.post('/'+code+'/emote',{'id':'invalid-test-001','name':'unknown'}).status_code,422)
  one=self.post('/'+code+'/emote',body);self.assertEqual(one.status_code,200,one.text)
  retry=self.post('/'+code+'/emote',body);self.assertEqual(one.json()['emote'],retry.json()['emote'])
  self.assertEqual(self.get('/'+code,2).json()['players'][0]['emote'],one.json()['emote'])
  self.assertEqual(self.post('/'+code+'/emote',{'id':'nod-test-00000001','name':'nod'}).status_code,429)
  with self.sessions.begin() as db:db.get(PartyPose,(code,1)).emote_at=time.time()-7
  self.assertNotIn('emote',self.get('/'+code,2).json()['players'][0])
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['players'][0]['alive']=False;row.data_json=json.dumps(s)
  self.assertEqual(self.post('/'+code+'/emote',{'id':'dead-test-000001','name':'wave'}).status_code,422)
 def test_emotes_are_disabled_and_hidden_during_night(self):
  code=self.room();self.command(code,'start')
  self.assertEqual(self.post('/'+code+'/emote',{'id':'night-test-000001','name':'wave'}).status_code,422)
  self.assertTrue(all('emote' not in p for p in self.get('/'+code).json()['players']))
 def test_lazy_deadline_advances_and_persists(self):
  code=self.room('bunker');self.command(code,'start')
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);s['deadline']=time.time()-2;row.data_json=json.dumps(s)
  r=self.get('/'+code);self.assertEqual(r.json()['phase'],'vote');r2=self.get('/'+code);self.assertEqual(r2.json()['phase_token'],r.json()['phase_token'])
 def test_spectator_cannot_act_or_chat(self):
  code=self.room();self.command(code,'start');v=self.get('/'+code,5).json();self.assertTrue(all(p['role'] is None for p in v['players']))
  self.assertEqual(self.command(code,'vote',2,uid=5).status_code,422);self.assertEqual(self.post('/'+code+'/chat',{'id':'x'*16,'text':'hey'},uid=5).status_code,422)
 def test_leave_removes_membership_and_empty_room_closes(self):
  r=self.post('',{'kind':'bunker','capacity':4,'seats':1,'public':False});code=r.json()['code'];self.assertTrue(self.command(code,'leave').json()['left'])
  with self.sessions() as db:self.assertIsNone(db.get(PartyMember,(code,1)));self.assertEqual(db.get(PartyRoom,code).status,'cancelled')
 def test_membership_supports_telegram_bigint_ids(self):
  self.assertIsInstance(PartyMember.__table__.c.user_id.type,BigInteger)
  uid=9000000001
  with self.sessions.begin() as db:db.add(User(id=uid,first_name='Big',jera=100))
  r=self.post('',{'kind':'mafia','capacity':4,'seats':1},uid=uid);self.assertEqual(r.status_code,200,r.text)
  with self.sessions() as db:self.assertIsNotNone(db.get(PartyMember,(r.json()['code'],uid)))
 def test_wrong_game_code_does_not_join(self):
  r=self.post('',{'kind':'bunker','capacity':4,'seats':1});code=r.json()['code']
  wrong=self.post('/'+code+'/join',{'kind':'mafia'},uid=2);self.assertEqual(wrong.status_code,422)
  with self.sessions() as db:self.assertIsNone(db.get(PartyMember,(code,2)))
 def test_last_words_retry_is_idempotent_and_other_users_cannot_interrupt(self):
  code=self.room();self.command(code,'start')
  with self.sessions.begin() as db:
   row=db.get(PartyRoom,code);s=json.loads(row.data_json);victim=game.player(s,2);victim['alive']=False;game.begin_last_words(s,victim,'discussion',time.time());row.data_json=json.dumps(s)
  body={'id':'final_word_123456','text':'Моё последнее слово'}
  self.assertEqual(self.post('/'+code+'/chat',body,uid=1).status_code,422)
  first=self.post('/'+code+'/chat',body,uid=2);self.assertEqual(first.status_code,200,first.text);again=self.post('/'+code+'/chat',body,uid=2);self.assertEqual(again.status_code,200);self.assertEqual(len(again.json()['messages']),1);self.assertTrue(again.json()['messages'][0]['last_words'])
  self.assertEqual(self.post('/'+code+'/chat',{'id':'another_word_123456','text':'Ещё'},uid=2).status_code,422)
if __name__=='__main__':unittest.main()
