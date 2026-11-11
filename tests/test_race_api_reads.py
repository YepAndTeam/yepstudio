import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from fastapi import BackgroundTasks
from sqlalchemy import create_engine,event
from sqlalchemy.orm import sessionmaker
from database import Base,User,Meta
from race_models import RaceFund
from race_api import make_race_router
from race_service import make_meeting,tick
from score_service import initialize_score_state

class RaceReadTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine)
  self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  self.now=datetime.utcnow()
  with self.sessions.begin() as db:
   db.add(User(id=1,first_name='Admin',role='admin',jera=10000));db.add(Meta(key='races_enabled',value='1'));db.add(RaceFund(id=1,balance=1000));db.flush()
   self.mid=make_meeting(db,self.now-timedelta(minutes=1)).id
  self.router=make_race_router(lambda:None,lambda:None,lambda:None,lambda notices:None)
 def tearDown(self):self.engine.dispose()
 def test_listing_and_detail_only_read_without_wallet_lock_or_scheduler(self):
  statements=[]
  event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:statements.append(statement))
  with self.sessions() as db:
   user=db.get(User,1)
   listing=next(r.endpoint for r in self.router.routes if r.path=='/api/races')
   detail=next(r.endpoint for r in self.router.routes if r.path=='/api/races/{race_id}')
   bg=BackgroundTasks();result=listing(bg=bg,user=user,db=db)
   self.assertEqual(result['current']['id'],self.mid+'_PRE')
   self.assertEqual(detail(self.mid+'_PRE',bg=bg,user=user,db=db)['id'],self.mid+'_PRE')
   self.assertEqual(bg.tasks,[])
  self.assertTrue(statements)
  self.assertTrue(all(sql.lstrip().upper().startswith('SELECT') for sql in statements))
 def test_unchanged_future_schedule_has_bounded_background_work(self):
  with self.sessions.begin() as db:tick(db,self.now)
  statements=[]
  event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:statements.append(statement))
  with self.sessions.begin() as db:tick(db,self.now)
  self.assertLess(len(statements),30)
