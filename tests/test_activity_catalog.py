import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import json
import unittest
from datetime import datetime,timedelta
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base,User,WeeklyTaskSet,GameResult,DailyTaskAward
from score_service import initialize_score_state,begin_run,submit_result
from task_service import select_tasks,weekly_task_state
from activity_catalog import TASKS,ACHIEVEMENTS
from achievement_service import achievement_state
from weekly import period_now
class CatalogTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine)
  self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add(User(id=1,first_name='Test',jera=0))
 def tearDown(self):self.engine.dispose()
 def test_selection_is_stable_and_has_three_categories(self):
  selected=select_tasks(0)
  self.assertEqual(selected,select_tasks(0))
  self.assertEqual(len({t['category'] for t in selected}),3)
  self.assertNotEqual(selected,select_tasks(1))
  self.assertGreater(len(TASKS),37)
 def test_saved_week_survives_catalog_changes(self):
  with self.sessions.begin() as db:first=weekly_task_state(db,1)
  with patch('task_service.select_tasks',side_effect=AssertionError('must use saved set')):
   with self.sessions.begin() as db:self.assertEqual(weekly_task_state(db,1),first)
 def test_progress_excludes_unverified_invalid_and_other_weeks(self):
  now=datetime.utcnow();period=period_now(now)
  definitions=[dict(id=k,kind=k,title=k,target=10000,game='dino') for k in ['runs','distinct_games','best','total']]
  with self.sessions.begin() as db:
   db.add(WeeklyTaskSet(period=period,definitions_json=json.dumps(definitions)))
   run=begin_run(db,1,'dino',now=now-timedelta(seconds=60));submit_result(db,1,'dino',500,now=now,run_id=run.id)
   db.add_all([GameResult(user_id=1,game='dino',score=9000,period=period,epoch='initial',valid=True),GameResult(user_id=1,game='dino',score=8000,period=period,epoch='initial',valid=False)])
  with self.sessions.begin() as db:
   state=weekly_task_state(db,1,now)
   self.assertEqual([t['current'] for t in state['tasks']],[1,1,500,500])
  with self.sessions.begin() as db:self.assertTrue(all(t['current']==0 for t in weekly_task_state(db,1,now+timedelta(days=7))['tasks']))
 def test_other_games_unlock_badges_and_pay_milestones(self):
  now=datetime.utcnow()
  with self.sessions.begin() as db:
   run=begin_run(db,1,'flappy',now=now-timedelta(seconds=20));submit_result(db,1,'flappy',25,now=now,run_id=run.id)
   state=achievement_state(db,1,'flappy')
   self.assertEqual(sum(s['earned'] for s in state['steps']),3)
   self.assertEqual(db.get(User,1).jera,160)
   self.assertEqual(state['total_earned'],160)
   self.assertEqual(len(ACHIEVEMENTS),5)
