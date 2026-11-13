import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import unittest
from datetime import datetime,timedelta
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx,Meta,AchievementAward,AchievementProgress
from score_service import initialize_score_state,begin_run,submit_result
from achievement_service import achievement_state
from reset_records import preview,apply_plan
class AchievementTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine)
  self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add(User(id=1,first_name='Test',jera=0))
 def tearDown(self):self.engine.dispose()
 def run_score(self,db,score,seconds=1000):
  now=datetime.utcnow();run=begin_run(db,1,'dino',now=now-timedelta(seconds=seconds));submit_result(db,1,'dino',score,now=now,run_id=run.id);return run.id,now
 def test_skipped_steps_and_retry_only_paid_once(self):
  with self.sessions.begin() as db:
   run,now=self.run_score(db,1000)
   self.assertEqual(db.get(User,1).jera,160)
   submit_result(db,1,'dino',1000,now=now,run_id=run)
   self.assertEqual(db.get(User,1).jera,160)
  with self.sessions.begin() as db:
   self.run_score(db,1000)
   state=achievement_state(db,1)
   self.assertEqual(state['total_earned'],160)
   self.assertEqual(sum(s['earned'] for s in state['steps']),3)
 def test_full_track_is_1910_jera(self):
  with self.sessions.begin() as db:
   self.run_score(db,10000)
   self.assertEqual(db.get(User,1).jera,1910)
   self.assertEqual(achievement_state(db,1)['best'],10000)
 def test_unverified_or_impossible_scores_do_not_mint(self):
  with self.sessions.begin() as db:
   submit_result(db,1,'dino',5000)
   self.run_score(db,5000,seconds=1)
   self.assertEqual(achievement_state(db,1)['best'],0)
   self.assertEqual(db.get(User,1).jera,0)
 def test_rollback_is_atomic(self):
  with self.sessions() as db:
   self.run_score(db,5000);db.rollback()
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,0)
   self.assertEqual(db.scalar(select(func.count()).select_from(AchievementAward)),0)
 def test_record_reset_keeps_lifetime_awards(self):
  with self.sessions.begin() as db:self.run_score(db,1000)
  with self.sessions.begin() as db:
   db.get(Meta,'score_maintenance').value='1';db.flush();apply_plan(db,preview(db))
  with self.sessions() as db:
   self.assertEqual(achievement_state(db,1)['best'],1000)
   self.assertEqual(achievement_state(db,1)['total_earned'],160)

 def test_old_milestones_are_not_paid_a_second_time(self):
  with self.sessions.begin() as db:
   db.add(AchievementAward(user_id=1,game='dino',threshold=100,amount=1))
   db.get(User,1).jera=1
  with self.sessions.begin() as db:
   self.run_score(db,1000)
   self.assertEqual(db.get(User,1).jera,151)
   self.assertEqual(db.get(AchievementAward,(1,'dino',100)).amount,1)
