import os,json,unittest,copy
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,Meta,JeraTx,ThemeBoxPurchase,Tournament
from score_service import initialize_score_state
from race_models import Race,RaceBet,RaceFund,RaceFundTx,RaceChat,RaceReminder,RaceTournamentFunding
from race_service import (make_race,accept_bet,apply_beacon,treasury,tick,seed_from_shop,fund_tournament,close_tournament_funding,post_chat,state,RaceError,refund_race)
from race_fairness import verify_beacon,draw,commitment,round_timestamp
FIXTURE=json.loads((Path(__file__).parents[1]/'frontend/src/raceDemoProof.json').read_text(encoding='utf-8'))
class RaceTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  self.open=datetime(2026,11,11,7)
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='One',jera=100),User(id=2,first_name='Two',jera=100),User(id=3,first_name='Admin',role='admin',jera=10000)]);db.add(RaceFund(id=1,balance=10000));db.add(Meta(key='races_enabled',value='1'));db.flush();race=make_race(db,self.open);self.id=race.id
 def tearDown(self):self.engine.dispose()
 def horse(self,db):return max(json.loads(db.get(Race,self.id).rules_json)['horses'],key=lambda h:h['weight'])
 def bet(self,db,request='first',user=1,amount=10):return accept_bet(db,user,self.id,self.horse(db)['number'],amount,request,self.open+timedelta(minutes=5))
 def proof(self,db):return {**FIXTURE['beacon'],'round':db.get(Race,self.id).beacon_round}
 def test_exact_retry_not_double_debited(self):
  with self.sessions.begin() as db:
   first=self.bet(db);again=self.bet(db);self.assertEqual(first.id,again.id);self.assertEqual(db.get(User,1).jera,90)
   self.assertEqual(db.get(RaceFund,1).balance,10010);self.assertEqual(db.get(Race,self.id).reserved,first.payout)
 def test_bets_above_old_limit_work_but_cannot_exceed_wallet(self):
  with self.sessions.begin() as db:
   bet=self.bet(db,amount=100)
   self.assertEqual(bet.amount,100);self.assertEqual(db.get(User,1).jera,0)
   self.assertEqual(self.bet(db,amount=100).id,bet.id)
  with self.sessions.begin() as db:
   with self.assertRaises(RaceError):self.bet(db,user=2,amount=101)
 def test_api_schema_accepts_large_bets(self):
  from race_api import BetIn
  self.assertEqual(BetIn(horse=1,amount=1000000,request_id='request-00000001',commitment='a'*64).amount,1000000)
 def test_amount_must_be_a_positive_integer(self):
  for amount in [0,-1,True,1.5]:
   with self.sessions.begin() as db:
    with self.assertRaises(RaceError):self.bet(db,amount=amount)
 def test_reused_request_cannot_change_bet(self):
  with self.sessions.begin() as db:
   self.bet(db)
   with self.assertRaises(RaceError):self.bet(db,amount=5)
 def test_admin_and_late_bets_rejected(self):
  with self.sessions.begin() as db:
   with self.assertRaises(RaceError):self.bet(db,user=3)
   with self.assertRaises(RaceError):accept_bet(db,1,self.id,1,1,'late',self.open+timedelta(minutes=30))
 def test_reserve_and_player_cap(self):
  with self.sessions.begin() as db:
   db.get(RaceFund,1).balance=0;db.flush()
   with self.assertRaises(RaceError):self.bet(db)
  with self.sessions.begin() as db:
   db.get(RaceFund,1).balance=10000;self.bet(db,amount=25)
   with self.assertRaises(RaceError):self.bet(db,request='second',amount=1)
 def test_settlement_conserves_currency_and_only_once(self):
  with self.sessions.begin() as db:
   self.bet(db);self.bet(db,request='other',user=2)
  with patch('race_service.verify_beacon',return_value=True):
   with self.sessions.begin() as db:
    beacon=self.proof(db);self.assertFalse(apply_beacon(db,self.id,beacon,self.open+timedelta(minutes=40)))
   with self.sessions.begin() as db:
    self.assertTrue(apply_beacon(db,self.id,self.proof(db),self.open+timedelta(minutes=43)))
    self.assertFalse(apply_beacon(db,self.id,self.proof(db),self.open+timedelta(minutes=43)))
    total=db.scalar(select(func.sum(User.jera)))+db.get(RaceFund,1).balance
    self.assertEqual(total,20200);self.assertEqual(treasury(db)['reserved'],0)
 def test_stored_proof_settles_after_restart_instead_of_refund(self):
  with self.sessions.begin() as db:self.bet(db)
  with patch('race_service.verify_beacon',return_value=True):
   with self.sessions.begin() as db:apply_beacon(db,self.id,self.proof(db),self.open+timedelta(minutes=40))
   with self.sessions.begin() as db:
    tick(db,self.open+timedelta(minutes=47));self.assertEqual(db.get(Race,self.id).status,'scheduled')
    self.assertTrue(apply_beacon(db,self.id,self.proof(db),self.open+timedelta(minutes=47)))
 def test_no_beacon_refunds_once(self):
  with self.sessions.begin() as db:self.bet(db)
  for _ in range(2):
   with self.sessions.begin() as db:tick(db,self.open+timedelta(minutes=45))
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,100);self.assertEqual(db.get(RaceFund,1).balance,10000)
 def test_empty_race_postpones_hour_and_reminders_are_unique(self):
  with self.sessions.begin() as db:tick(db,self.open+timedelta(minutes=30));self.assertEqual(db.get(Race,self.id).status,'skipped');self.assertIsNotNone(db.scalar(select(Race).where(Race.root_slot==self.open,Race.attempt==1)))
  with self.sessions.begin() as db:
   race=make_race(db,self.open+timedelta(days=1));accept_bet(db,1,race.id,self.horse(db)['number'],1,'next',race.opens_at+timedelta(minutes=1));when=race.starts_at-timedelta(minutes=3)
   first=tick(db,when);second=tick(db,when);self.assertEqual(len(first),1);self.assertEqual(second,[])
 def test_shop_funding_excludes_admin_and_is_idempotent(self):
  with self.sessions.begin() as db:
   for uid in [1,3]:db.add(ThemeBoxPurchase(id=str(uid),user_id=uid,request_id=str(uid),runes='abc',theme_id='retro',price=100,refund=25,status='won',is_dupe=True))
  with self.sessions.begin() as db:self.assertEqual(seed_from_shop(db),75);self.assertEqual(seed_from_shop(db),0)
 def test_chat_is_closed_and_deleted(self):
  with self.sessions.begin() as db:
   post_chat(db,1,self.id,'hello',self.open)
   with self.assertRaises(RaceError):post_chat(db,1,self.id,'spam',self.open+timedelta(seconds=1))
   tick(db,self.open+timedelta(minutes=45));self.assertEqual(db.scalar(select(func.count()).select_from(RaceChat)),0)
   with self.assertRaises(RaceError):post_chat(db,1,self.id,'late',self.open+timedelta(minutes=45))
 def test_tournament_allocation_releases_unused_money_once(self):
  with self.sessions.begin() as db:
   db.add(Tournament(id='cup',title='Cup',game='dino',starts_at=self.open,ends_at=self.open+timedelta(days=2),status='active',prize_jera='{"2":150,"3":100,"4":75,"5":50}',duplicate_prize=200));db.flush()
   self.assertEqual(fund_tournament(db,'cup'),575);self.assertEqual(db.get(RaceFund,1).balance,9425)
   close_tournament_funding(db,db.get(Tournament,'cup'),375);close_tournament_funding(db,db.get(Tournament,'cup'),375)
   self.assertEqual(db.get(RaceFund,1).balance,9625)
 def test_real_beacon_and_tampering(self):
  self.assertTrue(verify_beacon(FIXTURE['beacon'],1));bad=copy.deepcopy(FIXTURE['beacon']);bad['randomness']='00'*32;self.assertFalse(verify_beacon(bad,1))
  self.assertFalse(verify_beacon(FIXTURE['beacon'],2));self.assertEqual(draw(FIXTURE['rules'],FIXTURE['beacon']['randomness']),FIXTURE['ranking'])
 def test_future_randomness_and_probability_total(self):
  with self.sessions() as db:
   race=db.get(Race,self.id);rules=json.loads(race.rules_json);self.assertEqual(sum(h['weight'] for h in rules['horses']),10000)
   self.assertGreater(round_timestamp(race.beacon_round),(race.closes_at-datetime(1970,1,1)).total_seconds())
   self.assertEqual(commitment(rules),race.commitment)
