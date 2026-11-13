import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import tempfile, unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from database import Base, User, JeraTx, EconomyWelcome
from score_service import initialize_score_state
from economy_service import initialize_economy, reward_economy_welcome, CAMPAIGN
from compensation_service import list_letters, mark_read

class EconomyWelcomeTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.engine=create_engine('sqlite:///'+str(Path(self.tmp.name)/'test.db'),connect_args={'check_same_thread':False})
  Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add(User(id=1,first_name='Existing',jera=50))
  initialize_economy(self.sessions)
 def tearDown(self):self.engine.dispose();self.tmp.cleanup()
 def test_snapshot_survives_restart_and_newcomers_only_get_starter(self):
  with self.sessions.begin() as db:db.add(User(id=2,first_name='New',jera=0))
  initialize_economy(self.sessions)
  for _ in range(2):
   with self.sessions.begin() as db:
    reward_economy_welcome(db,1);reward_economy_welcome(db,2)
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,5050);self.assertEqual(db.get(User,2).jera,2000)
   old=list_letters(db,1)[0];new=list_letters(db,2)[0]
   self.assertEqual([x['credit'] for x in old['entries']],[2500,500,1000,1000]);self.assertEqual(old['total'],5000)
   self.assertEqual(new['total'],2000)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),3)
 def test_two_devices_and_receipt_read_never_repeat_payment(self):
  def visit(_):
   with self.sessions.begin() as db:reward_economy_welcome(db,1)
  with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(visit,range(2)))
  with self.sessions.begin() as db:
   self.assertTrue(mark_read(db,1,CAMPAIGN));self.assertTrue(mark_read(db,1,CAMPAIGN))
   self.assertFalse(mark_read(db,2,CAMPAIGN))
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,5050);self.assertTrue(list_letters(db,1)[0]['read'])
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),2)
 def test_rollback_keeps_payment_pending(self):
  with self.sessions() as db:reward_economy_welcome(db,1);db.rollback()
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,50);self.assertIsNone(db.get(EconomyWelcome,1).paid_at)
  with self.sessions.begin() as db:reward_economy_welcome(db,1)
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,5050)

 def test_already_paid_old_compensation_only_receives_extra_thousand(self):
  from datetime import datetime
  with self.sessions.begin() as db:
   row=db.get(EconomyWelcome,1);row.paid_at=datetime.utcnow();row.read_at=datetime.utcnow()
   db.get(User,1).jera=4050
  for _ in range(2):
   with self.sessions.begin() as db:reward_economy_welcome(db,1)
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,5050)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
   self.assertFalse(list_letters(db,1)[0]['read'])
