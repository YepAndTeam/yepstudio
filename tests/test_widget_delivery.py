import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from unittest.mock import AsyncMock,patch
from types import SimpleNamespace
from sqlalchemy import create_engine,select
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from database import Base
from widget_models import BoardInvitation,BoardWidgetSession
from widget_service import initialize_widget_state,enroll,new_session,WidgetError
from widget_bot import handle_widget_query

class WidgetDeliveryTest(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.engine=create_engine('sqlite:///:memory:',poolclass=StaticPool,connect_args={'check_same_thread':False});Base.metadata.create_all(self.engine)
  self.sessions=sessionmaker(bind=self.engine);initialize_widget_state(self.sessions)
  with self.sessions.begin() as db:
   for uid in [1,2]:enroll(db,uid,'Player '+str(uid))
   row=new_session(db,1);row.message_id=100;row.kind='chess'
  self.bot=SimpleNamespace(token='TEST_ONLY')
 async def asyncTearDown(self):self.engine.dispose()
 def query(self,data='invite:2',qid='query-1',uid=1,mid=100):return {'id':qid,'from':{'id':uid},'chat':{'id':uid,'type':'private'},'message_id':mid,'data':data}
 async def test_delivery_uses_widget_api_and_retries_do_not_resend(self):
  async def fake(bot,method,payload):return {'message_id':200} if method=='sendWidget' else True
  with patch('widget_bot.api_call',new=AsyncMock(side_effect=fake)) as api:
   await handle_widget_query(self.bot,self.sessions,self.query())
   await handle_widget_query(self.bot,self.sessions,self.query())
   self.assertEqual(sum(call.args[1]=='sendWidget' for call in api.await_args_list),1)
   self.assertEqual(api.await_args_list[0].args[1],'answerWidgetQuery')
   await handle_widget_query(self.bot,self.sessions,self.query('accept','accept-1',2,200))
  with self.sessions() as db:
   invitation=db.scalar(select(BoardInvitation));self.assertEqual(invitation.status,'accepted');self.assertEqual(invitation.delivery,'sent')
 async def test_start_sends_one_main_widget(self):
  import json
  from widget_bot import start_widget
  with patch('widget_bot.api_call',new=AsyncMock(return_value={'message_id':300})) as api:
   await start_widget(self.bot,self.sessions,SimpleNamespace(id=1,first_name='One',username=None))
   self.assertEqual(api.await_count,1);self.assertEqual(api.await_args.args[1],'sendWidget')
   state=json.loads(api.await_args.args[2]['chat_data']);self.assertEqual(state['screen'],'main');self.assertEqual(state['name'],'One')
 async def test_delivery_failure_has_explicit_retry(self):
  async def fake(bot,method,payload):
   if method=='sendWidget':raise WidgetError('Offline')
   return True
  with patch('widget_bot.api_call',new=AsyncMock(side_effect=fake)):
   await handle_widget_query(self.bot,self.sessions,self.query())
  with self.sessions() as db:self.assertEqual(db.scalar(select(BoardInvitation)).delivery,'failed')
  async def recovered(bot,method,payload):return {'message_id':201} if method=='sendWidget' else True
  with patch('widget_bot.api_call',new=AsyncMock(side_effect=recovered)) as api:
   await handle_widget_query(self.bot,self.sessions,self.query('retry','retry-1'))
   self.assertEqual(sum(call.args[1]=='sendWidget' for call in api.await_args_list),1)
  with self.sessions() as db:self.assertEqual(db.scalar(select(BoardInvitation)).delivery,'sent')

class WidgetConcurrencyTest(unittest.TestCase):
 def test_simultaneous_accepts_create_one_game(self):
  import tempfile
  from pathlib import Path
  from concurrent.futures import ThreadPoolExecutor
  from widget_service import handle_action
  from chess_models import ChessGame
  from sqlalchemy import func
  with tempfile.TemporaryDirectory() as tmp:
   engine=create_engine('sqlite:///'+str(Path(tmp)/'widgets.db'),connect_args={'check_same_thread':False,'timeout':15})
   Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_widget_state(sessions)
   try:
    with sessions.begin() as db:
     for uid in [1,2]:enroll(db,uid,'Player '+str(uid))
     source=new_session(db,1);source.message_id=100;source.kind='chess';db.flush()
     _,iid=handle_action(db,1,1,100,'invite-query','invite:2')
     target=new_session(db,2);target.message_id=200;target.invitation_id=iid
    def accept(i):
     with sessions.begin() as db:return handle_action(db,2,2,200,'accept-'+str(i),'accept')[0]['game_id']
    with ThreadPoolExecutor(max_workers=2) as pool:games=list(pool.map(accept,range(2)))
    self.assertEqual(len(set(games)),1)
    with sessions() as db:self.assertEqual(db.scalar(select(func.count()).select_from(ChessGame)),1)
   finally:engine.dispose()
