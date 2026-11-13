import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import tempfile, unittest
from pathlib import Path
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from database import Base, User, AllTimeScore, GlobalRecordAward, JeraTx
from score_service import initialize_score_state, begin_run, submit_result
from weekly import prize_for

class RecordRewardTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.engine=create_engine('sqlite:///'+str(Path(self.tmp.name)/'test.db'),connect_args={'check_same_thread':False})
  Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  self.now=datetime.utcnow()
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='Player',jera=0),User(id=2,first_name='Leader',jera=0)])
   db.add(AllTimeScore(user_id=2,game='drive',best=100))
 def tearDown(self):self.engine.dispose();self.tmp.cleanup()
 def result(self,db,score,game='drive'):
  run=begin_run(db,1,game,now=self.now-timedelta(seconds=100))
  submit_result(db,1,game,score,now=self.now,run_id=run.id)
  return run.id
 def test_opponent_then_self_improvement_pay_and_ties_do_not(self):
  with self.sessions.begin() as db:
   self.result(db,101);self.result(db,112);self.result(db,112);self.result(db,99)
   self.assertEqual(db.get(User,1).jera,2000)
   self.assertEqual(db.scalar(select(func.count()).select_from(GlobalRecordAward)),2)
 def test_retry_from_two_devices_only_pays_once(self):
  with self.sessions.begin() as db:identity=begin_run(db,1,'drive',now=self.now-timedelta(seconds=100)).id
  def send(_):
   with self.sessions.begin() as db:submit_result(db,1,'drive',101,now=self.now,run_id=identity)
  with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(send,range(2)))
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,1000)
   self.assertEqual(db.scalar(select(func.count()).select_from(GlobalRecordAward)),1)
 def test_same_new_record_from_distinct_runs_only_pays_first(self):
  with self.sessions.begin() as db:ids=[begin_run(db,1,'drive',now=self.now-timedelta(seconds=100)).id for _ in range(2)]
  def send(identity):
   with self.sessions.begin() as db:submit_result(db,1,'drive',101,now=self.now,run_id=identity)
  with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(send,ids))
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,1000)
 def test_empty_table_and_no_server_run_do_not_pay(self):
  with self.sessions.begin() as db:
   self.result(db,100,'hell')
   # Hell milestones are a separate reward, not a world-record award.
   self.assertEqual(db.scalar(select(func.count()).select_from(GlobalRecordAward)),0)
   submit_result(db,1,'drive',500,now=self.now)
   self.assertEqual(db.scalar(select(func.count()).select_from(GlobalRecordAward)),0)
 def test_rollback_is_atomic(self):
  with self.sessions() as db:self.result(db,101);db.rollback()
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,0)
   self.assertEqual(db.scalar(select(func.count()).select_from(GlobalRecordAward)),0)
 def test_impossible_dino_time_does_not_pay(self):
  with self.sessions.begin() as db:
   db.add(AllTimeScore(user_id=2,game='dino',best=100));db.flush()
   run=begin_run(db,1,'dino',now=self.now-timedelta(seconds=1))
   submit_result(db,1,'dino',10000,now=self.now,run_id=run.id)
   self.assertEqual(db.get(User,1).jera,0)
 def test_weekly_prize_distribution(self):
  self.assertEqual([prize_for(i) for i in range(1,12)],[1000,750,500,350,250,100,100,100,100,100,0])

 def test_own_record_requires_ten_percent_rounded_up(self):
  with self.sessions.begin() as db:
   identity=self.result(db,101)
   self.result(db,111) # Below ceil(101*1.1), so no self-improvement reward.
   self.assertEqual(db.get(User,1).jera,1000)
   self.result(db,123) # ceil(111*1.1) = 123.
   self.assertEqual(db.get(User,1).jera,2000)
   from record_reward_service import record_reward_for_run
   self.assertEqual(record_reward_for_run(db,1,identity),1000)
   self.assertEqual(record_reward_for_run(db,2,identity),0)
 def test_shared_first_place_is_also_owned(self):
  with self.sessions.begin() as db:
   db.add(AllTimeScore(user_id=1,game='drive',best=100));db.flush()
   self.result(db,109)
   self.assertEqual(db.get(User,1).jera,0)
 def test_exact_ten_percent_is_enough(self):
  with self.sessions.begin() as db:
   db.add(AllTimeScore(user_id=1,game='drive',best=100));db.flush()
   self.result(db,110)
   self.assertEqual(db.get(User,1).jera,1000)
