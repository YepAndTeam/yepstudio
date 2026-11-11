import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from sqlalchemy import create_engine,select,func,event
from sqlalchemy.orm import sessionmaker
from database import Base,User,Notification
from widget_service import initialize_widget_state,enroll,WidgetError
from social_models import Friendship
from social_service import change_friend,friend_state,heartbeat,search_players,invite_friend
from widget_models import BoardInvitation

class FriendsTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_widget_state(self.sessions);self.now=datetime(2026,11,12,8)
  with self.sessions.begin() as db:
   for uid,name in [(1,'One'),(2,'Two'),(3,'Other')]:enroll(db,uid,name)
 def tearDown(self):self.engine.dispose()
 def test_friendship_requires_recipient_confirmation_and_is_idempotent(self):
  with self.sessions.begin() as db:
   change_friend(db,1,2,'request',self.now);change_friend(db,1,2,'request',self.now)
   self.assertEqual(len(friend_state(db,1,self.now)['outgoing']),1)
   self.assertEqual(len(friend_state(db,2,self.now)['incoming']),1)
   with self.assertRaises(WidgetError):change_friend(db,1,2,'accept',self.now)
   change_friend(db,2,1,'accept',self.now);change_friend(db,2,1,'accept',self.now)
   self.assertEqual(len(friend_state(db,1,self.now)['friends']),1)
   self.assertEqual(db.scalar(select(func.count()).select_from(Notification)),2)
   change_friend(db,1,2,'remove',self.now);self.assertEqual(friend_state(db,2,self.now)['friends'],[])
 def test_presence_is_private_to_friends_can_be_hidden_and_expires(self):
  with self.sessions.begin() as db:
   heartbeat(db,2,now=self.now)
   self.assertEqual(friend_state(db,1,self.now)['friends'],[])
   change_friend(db,1,2,'request',self.now);change_friend(db,2,1,'accept',self.now)
   self.assertTrue(friend_state(db,1,self.now)['friends'][0]['online'])
   self.assertFalse(friend_state(db,1,self.now+timedelta(seconds=91))['friends'][0]['online'])
   heartbeat(db,2,visible=False,now=self.now)
   self.assertFalse(friend_state(db,1,self.now)['friends'][0]['online'])
   heartbeat(db,2,visible=True,active=False,now=self.now)
   self.assertFalse(friend_state(db,1,self.now)['friends'][0]['online'])
 def test_only_friends_can_invite_and_retries_do_not_duplicate(self):
  with self.sessions.begin() as db:
   with self.assertRaises(WidgetError):invite_friend(db,1,2,'chess','a'*32)
   change_friend(db,1,2,'request',self.now);change_friend(db,2,1,'accept',self.now)
   first,delivery=invite_friend(db,1,2,'chess','a'*32);again,duplicate=invite_friend(db,1,2,'chess','a'*32)
   self.assertEqual(first.id,again.id);self.assertTrue(delivery);self.assertIsNone(duplicate)
   self.assertEqual(db.scalar(select(func.count()).select_from(BoardInvitation)),1)
 def test_search_escapes_wildcards_and_does_not_expose_presence(self):
  with self.sessions() as db:
   self.assertEqual(search_players(db,1,'%_'),[])
   row=search_players(db,1,'Two')[0];self.assertEqual(row['id'],2);self.assertNotIn('online',row)
 def test_invalid_targets_and_request_cooldown(self):
  with self.sessions.begin() as db:
   with self.assertRaises(WidgetError):change_friend(db,1,1,'request',self.now)
   change_friend(db,1,2,'request',self.now)
   with self.assertRaises(WidgetError):change_friend(db,1,3,'request',self.now)
 def test_heartbeat_does_not_lock_economy(self):
  statements=[];event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,sql,params,*args:statements.append(str(params)))
  with self.sessions.begin() as db:heartbeat(db,1,now=self.now)
  self.assertFalse(any('score_write_lock' in s or 'board_widget_lock' in s for s in statements))
