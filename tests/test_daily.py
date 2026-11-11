import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import unittest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from database import Base, User, DailyVisit, JeraTx
from score_service import initialize_score_state
from daily_service import reward_visit

class DailyTest(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)
        initialize_score_state(self.sessions)
        with self.sessions.begin() as db: db.add(User(id=1,first_name='Test',jera=0))
    def tearDown(self): self.engine.dispose()
    def visit(self,now):
        with self.sessions.begin() as db: return reward_visit(db,1,now)
    def test_same_day_across_sessions_is_paid_once(self):
        now=datetime(2026,11,11,10,tzinfo=timezone.utc)
        self.assertTrue(self.visit(now)['awarded'])
        self.assertFalse(self.visit(now+timedelta(hours=2))['awarded'])
        with self.sessions() as db:
            self.assertEqual(db.get(User,1).jera,25)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
    def test_midnight_is_kazakhstan_time(self):
        now=datetime(2026,11,11,18,59,59,tzinfo=timezone.utc)
        first=self.visit(now)
        second=self.visit(now+timedelta(seconds=1))
        self.assertEqual(first['day'],'2026-11-11')
        self.assertEqual(second['day'],'2026-11-12')
        self.assertEqual(second['streak'],2)
        self.assertEqual(datetime.fromisoformat(first['next_at']),now+timedelta(seconds=1))
    def test_week_bonus_then_new_cycle_and_skip(self):
        now=datetime(2026,11,1,10,tzinfo=timezone.utc)
        week=[self.visit(now+timedelta(days=i)) for i in range(7)]
        self.assertEqual([r['amount'] for r in week],[25]*6+[50])
        self.assertEqual(self.visit(now+timedelta(days=7))['streak'],1)
        self.assertEqual(self.visit(now+timedelta(days=9))['streak'],1)
        with self.sessions() as db: self.assertEqual(db.get(User,1).jera,250)
    def test_rollback_does_not_leave_paid_marker(self):
        now=datetime(2026,11,11,10,tzinfo=timezone.utc)
        with self.sessions() as db:
            reward_visit(db,1,now)
            db.rollback()
        self.assertTrue(self.visit(now)['awarded'])
        with self.sessions() as db: self.assertEqual(db.get(User,1).jera,25)
