import os,json,unittest,zlib
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from pathlib import Path
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User
from widget_models import BoardInvitation,BoardWidgetSession,BotContact
from widget_service import initialize_widget_state,enroll,new_session,handle_action,opponents,WidgetError
from chess_models import ChessGame
from checkers_models import CheckersGame

class WidgetTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_widget_state(self.sessions)
  self.now=datetime(2026,11,12,7)
  with self.sessions.begin() as db:
   for uid in [1,2,3]:enroll(db,uid,'Player '+str(uid))
   row=new_session(db,1);row.message_id=100
 def tearDown(self):self.engine.dispose()
 def action(self,db,uid,mid,action,qid,now=None):return handle_action(db,uid,uid,mid,qid,action,now or self.now)
 def invite(self,db,kind='chess'):
  self.action(db,1,100,'kind:'+kind,'kind');state,delivery=self.action(db,1,100,'invite:2','invite')
  row=new_session(db,2);row.message_id=200;row.invitation_id=delivery;db.flush()
  return delivery
 def test_accept_creates_one_private_chess_game_and_retry_is_safe(self):
  with self.sessions.begin() as db:
   iid=self.invite(db)
   first,_=self.action(db,2,200,'accept','accept')
   again,_=self.action(db,2,200,'accept','accept')
   third,_=self.action(db,2,200,'accept','accept-again')
   self.assertEqual(first['game_id'],again['game_id']);self.assertEqual(first['game_id'],third['game_id'])
   game=db.get(ChessGame,first['game_id']);self.assertEqual({game.white_id,game.black_id},{1,2});self.assertEqual(game.status,'active')
   self.assertEqual(db.scalar(select(func.count()).select_from(ChessGame)),1)
   self.assertEqual(db.get(BoardInvitation,iid).status,'accepted')
 def test_checkers_invitation_and_unauthorized_accept(self):
  with self.sessions.begin() as db:
   self.invite(db,'checkers')
   with self.assertRaises(WidgetError):self.action(db,1,100,'accept','bad-accept')
   with self.assertRaises(WidgetError):self.action(db,3,200,'accept','other-user')
   result,_=self.action(db,2,200,'accept','ok')
   self.assertIsNotNone(db.get(CheckersGame,result['game_id']))
 def test_decline_cancel_expiry_do_not_create_games(self):
  for action in ['decline','cancel','expire']:
   with self.subTest(action=action):
    self.tearDown();self.setUp()
    with self.sessions.begin() as db:
     self.invite(db)
     if action=='cancel':self.action(db,1,100,'cancel','close')
     elif action=='decline':self.action(db,2,200,'decline','close')
     else:self.action(db,2,200,'refresh','close',self.now+timedelta(minutes=31))
     with self.assertRaises(WidgetError):self.action(db,2,200,'accept','late',self.now+timedelta(minutes=32))
     self.assertEqual(db.scalar(select(func.count()).select_from(ChessGame)),0)
 def test_opponents_require_start_and_notifications(self):
  with self.sessions.begin() as db:
   db.get(User,2).notify=False;db.get(BotContact,3).available=False;db.add(User(id=4,first_name='No start'))
   self.assertEqual(opponents(db,1,0)[2],[])
   self.action(db,1,100,'kind:chess','kind')
   for target in [1,2,3,4,999]:
    with self.assertRaises(WidgetError):self.action(db,1,100,'invite:'+str(target),'bad-'+str(target))
 def test_duplicate_invitation_query_does_not_send_twice(self):
  with self.sessions.begin() as db:
   self.action(db,1,100,'kind:chess','kind');_,delivery=self.action(db,1,100,'invite:2','invite')
   _,again=self.action(db,1,100,'invite:2','invite')
   self.assertTrue(delivery);self.assertIsNone(again)
   self.assertEqual(db.scalar(select(func.count()).select_from(BoardInvitation)),1)
 def test_widget_html_fits_telegram_limits(self):
  html=(Path(__file__).parents[1]/'widgets/board.html').read_bytes()
  self.assertLessEqual(len(html),32768);self.assertLessEqual(len(zlib.compress(html,9)),4096)
 def test_widget_uses_its_own_lock(self):
  from sqlalchemy import event
  statements=[];event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,parameters,*args:statements.append((statement,str(parameters))))
  with self.sessions.begin() as db:self.action(db,1,100,'kind:chess','kind')
  self.assertTrue(any('board_widget_lock' in params for sql,params in statements))
  self.assertFalse(any('score_write_lock' in params for sql,params in statements))
 def test_rate_limit_and_query_payload_binding(self):
  with self.sessions.begin() as db:
   self.invite(db)
   with self.assertRaises(WidgetError):self.action(db,1,100,'home','invite')
   self.action(db,1,100,'home','home');self.action(db,1,100,'kind:chess','kind-again')
   with self.assertRaises(WidgetError):self.action(db,1,100,'invite:3','spam')
 def test_huge_page_request_is_clamped(self):
  with self.sessions.begin() as db:
   self.action(db,1,100,'kind:chess','kind');view,_=self.action(db,1,100,'page:'+'9'*40,'page')
   self.assertEqual(view['page'],0)
 def test_rendering_expired_invite_does_not_overwrite_a_concurrent_accept(self):
  from widget_service import session_view
  with self.sessions.begin() as db:
   iid=self.invite(db);session=db.scalar(select(BoardWidgetSession).where(BoardWidgetSession.message_id==200))
   view=session_view(db,session,self.now+timedelta(minutes=31))
   self.assertEqual(view['status'],'expired')
   self.assertEqual(db.get(BoardInvitation,iid).status,'pending')

 def test_main_menu_navigation_preserves_single_session_and_personal_state(self):
  from widget_service import session_view
  from database import Notification,Tournament
  with self.sessions.begin() as db:
   session=new_session(db,1,menu=True);session.message_id=300
   db.add(Notification(user_id=1,kind='news',text='One',read=False));db.add(Notification(user_id=2,kind='news',text='Other',read=False))
   db.add(Tournament(id='test-menu',game='dino',title='Dino cup',starts_at=self.now-timedelta(hours=1),ends_at=self.now+timedelta(hours=2)))
   db.flush();view=session_view(db,session,self.now)
   self.assertEqual(view['screen'],'main');self.assertEqual(view['name'],'Player 1');self.assertEqual(view['unread'],1);self.assertEqual(view['event']['minutes'],120)
   count=db.scalar(select(func.count()).select_from(BoardWidgetSession))
   for i,action in enumerate(['home','kind:chess','home','studio','refresh']):
    value,_=handle_action(db,1,1,300,'menu-'+str(i),action,self.now)
   self.assertEqual(value['screen'],'main');self.assertEqual(db.scalar(select(func.count()).select_from(BoardWidgetSession)),count)
 def test_main_state_fits_widget_payload_for_long_unicode_names(self):
  from widget_service import session_view
  from widget_bot import with_link,packed
  with self.sessions.begin() as db:
   db.get(User,1).first_name='Ж'*100
   row=new_session(db,1,menu=True);data=packed(with_link(session_view(db,row,self.now)))
   self.assertLessEqual(len(data.encode()),1024)
