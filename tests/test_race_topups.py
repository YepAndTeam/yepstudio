import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx
from race_models import RaceFund,RaceFundTx,RaceFundTopUp
from race_service import top_up_fund,RaceError
from score_service import initialize_score_state
from accounting_service import economy_report

class RaceTopUpTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine)
  self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='Player',jera=25),User(id=2,first_name='Admin',role='admin',jera=10000)])
 def tearDown(self):self.engine.dispose()
 def test_topup_is_separate_emission_and_idempotent(self):
  with self.sessions.begin() as db:
   first,created=top_up_fund(db,2,1000,'Initial reserve','request-00000001')
   again,duplicate=top_up_fund(db,2,1000,'Initial reserve','request-00000001')
   self.assertTrue(created);self.assertFalse(duplicate);self.assertEqual(first.id,again.id)
   self.assertEqual(db.get(RaceFund,1).balance,1000)
   self.assertEqual(db.get(User,2).jera,10000);self.assertEqual(db.get(User,1).jera,25)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)
   self.assertEqual(db.scalar(select(func.count()).select_from(RaceFundTx)),1)
   with self.assertRaises(RaceError):top_up_fund(db,2,2000,'Initial reserve','request-00000001')
 def test_authorization_and_validation(self):
  with self.sessions.begin() as db:
   with self.assertRaises(RaceError):top_up_fund(db,1,1000,'Initial reserve','request-00000001')
   for value in [0,-1,100001,1.5,True]:
    with self.assertRaises(RaceError):top_up_fund(db,2,value,'Initial reserve','request-00000001')
   with self.assertRaises(RaceError):top_up_fund(db,2,1000,'   ','request-00000001')
   self.assertIsNone(db.get(RaceFund,1))
 def test_accounting_shows_topup_without_admin_wallets(self):
  with self.sessions.begin() as db:
   row,_=top_up_fund(db,2,1000,'Initial reserve','request-00000001');when=row.created_at
  with self.sessions() as db:
   report=economy_report(db,30,False,when)
   self.assertEqual(report['wallets']['total'],25)
   self.assertEqual(report['race_fund']['issued_in_period'],1000)
   self.assertEqual(report['race_fund']['topups'][0]['note'],'Initial reserve')
   self.assertEqual(report['race_fund']['topups'][0]['admin_id'],2)
