import os,tempfile,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta
from pathlib import Path
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,Meta
from race_models import Race,RaceBet,RaceFund
from race_service import make_meeting,accept_bet,top_up_fund,RaceError
from score_service import initialize_score_state
class RaceConcurrencyTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.engine=create_engine('sqlite:///'+str(Path(self.tmp.name)/'races.db'),connect_args={'check_same_thread':False,'timeout':15});Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions);self.open=datetime(2026,11,11,7)
  with self.sessions.begin() as db:
   db.add(User(id=1,first_name='Player',jera=25));db.add(Meta(key='races_enabled',value='1'));db.add(RaceFund(id=1,balance=1000));db.flush();meeting=make_meeting(db,self.open);self.rid=meeting.id+'_PRE'
 def tearDown(self):self.engine.dispose();self.tmp.cleanup()
 def test_simultaneous_retry_charges_once(self):
  def request(_):
   with self.sessions.begin() as db:return accept_bet(db,1,self.rid,1,25,'same-request',self.open+timedelta(minutes=1)).id
  with ThreadPoolExecutor(max_workers=4) as pool:ids=list(pool.map(request,range(4)))
  self.assertEqual(len(set(ids)),1)
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,0);self.assertEqual(db.get(RaceFund,1).balance,1025);self.assertEqual(db.scalar(select(func.count()).select_from(RaceBet)),1)
 def test_two_competing_bets_cannot_overdraw_wallet(self):
  def request(i):
   try:
    with self.sessions.begin() as db:accept_bet(db,1,self.rid,1,25,'request-'+str(i),self.open+timedelta(minutes=1));return True
   except RaceError:return False
  with ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(request,range(2)))
  self.assertEqual(sum(outcomes),1)
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,0);self.assertEqual(db.get(RaceFund,1).balance,1025)
 def test_competing_edits_replace_the_same_bet_only_once(self):
  when=self.open+timedelta(minutes=1)
  with self.sessions.begin() as db:first=accept_bet(db,1,self.rid,1,10,'first',when).id
  def request(i):
   try:
    with self.sessions.begin() as db:
     accept_bet(db,1,self.rid,i+2,5,'edit-'+str(i),when,replaces_id=first)
     return True
   except RaceError:return False
  with ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(request,range(2)))
  self.assertEqual(sum(outcomes),1)
  with self.sessions() as db:
   self.assertEqual(db.get(User,1).jera,20);self.assertEqual(db.get(RaceFund,1).balance,1005)
   self.assertEqual(db.scalar(select(func.count()).select_from(RaceBet).where(RaceBet.status=='pending')),1)
 def test_simultaneous_fund_topup_retry_mints_once(self):
  with self.sessions.begin() as db:db.add(User(id=2,first_name='Admin',role='admin',jera=10000))
  def request(_):
   with self.sessions.begin() as db:return top_up_fund(db,2,1000,'Initial reserve','request-00000001')[1]
  with ThreadPoolExecutor(max_workers=4) as pool:created=list(pool.map(request,range(4)))
  self.assertEqual(sum(created),1)
  with self.sessions() as db:
   self.assertEqual(db.get(RaceFund,1).balance,2000)
   self.assertEqual(db.get(User,2).jera,10000)
