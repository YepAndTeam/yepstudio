import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import json,tempfile,unittest
from pathlib import Path
from datetime import datetime,timedelta
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,GameRun,GameResult,DailyTaskSet,DailyTaskAward
from score_service import initialize_score_state
from task_service import daily_task_state

class DailyTasksTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.engine=create_engine('sqlite:///'+str(Path(self.tmp.name)/'test.db'),connect_args={'check_same_thread':False})
  Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  self.now=datetime(2026,11,11,18,59,59)
  definitions=[dict(id='a',kind='runs',title='a',target=1,amount=3),dict(id='b',kind='best',title='b',target=100,game='dino',amount=3),dict(id='c',kind='total',title='c',target=100,game='dino',amount=4)]
  with self.sessions.begin() as db:
   db.add(User(id=1,first_name='Test',jera=0));db.flush()
   db.add(DailyTaskSet(day='2026-11-11',definitions_json=json.dumps(definitions)))
   db.add(GameRun(id='run',user_id=1,game='dino',epoch='initial',started_at=self.now-timedelta(seconds=20)));db.flush()
   db.add(GameResult(user_id=1,game='dino',run_id='run',score=100,submitted_at=self.now,period=0,epoch='initial',valid=True))
 def tearDown(self):self.engine.dispose();self.tmp.cleanup()
 def test_cap_and_idempotent_payment(self):
  for _ in range(3):
   with self.sessions.begin() as db:
    result=daily_task_state(db,1,self.now)
    self.assertEqual(result['earned_today'],100)
    self.assertEqual(result['balance'],100)
  with self.sessions() as db:self.assertEqual(db.scalar(select(func.count()).select_from(DailyTaskAward)),3)
 def test_midnight_and_old_results_do_not_count(self):
  with self.sessions.begin() as db:
   old=daily_task_state(db,1,self.now)
   self.assertEqual(old['ends_at'],'2026-11-11T19:00:00Z')
  with self.sessions.begin() as db:
   new=daily_task_state(db,1,self.now+timedelta(seconds=1))
   self.assertEqual(new['day'],'2026-11-12');self.assertEqual(new['earned_today'],0)
   self.assertTrue(all(t['current']==0 for t in new['tasks']))
   self.assertEqual(new['balance'],100)
 def test_two_devices_cannot_double_pay(self):
  def request(_):
   with self.sessions.begin() as db:return daily_task_state(db,1,self.now)['earned_today']
  with ThreadPoolExecutor(max_workers=2) as pool:self.assertEqual(list(pool.map(request,range(2))),[100,100])
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,100)
 def test_failed_transaction_rolls_back_awards_and_wallet(self):
  with self.sessions() as db:daily_task_state(db,1,self.now);db.rollback()
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,0)
   self.assertEqual(db.scalar(select(func.count()).select_from(DailyTaskAward)),0)
 def test_impossible_dino_result_is_not_paid(self):
  with self.sessions.begin() as db:db.get(GameResult,1).score=10000
  with self.sessions.begin() as db:
   state=daily_task_state(db,1,self.now)
   self.assertEqual(state['earned_today'],0)

 def test_old_completed_tasks_receive_only_the_missing_difference(self):
  with self.sessions.begin() as db:
   for identity,amount in [('a',3),('b',3),('c',4)]:
    db.add(DailyTaskAward(user_id=1,day='2026-11-11',task_id=identity,amount=amount))
   db.get(User,1).jera=10
  for _ in range(2):
   with self.sessions.begin() as db:
    state=daily_task_state(db,1,self.now)
    self.assertEqual(state['earned_today'],100);self.assertEqual(state['balance'],100)
    self.assertEqual([t['id'] for t in state['tasks']],['a','b','c'])
