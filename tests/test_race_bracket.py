import os,json,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from unittest.mock import patch
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,Meta
from score_service import initialize_score_state
from race_models import RaceMeeting,Race,RaceFund,RaceBet
from race_service import make_meeting,accept_bet,tick,apply_beacon,meeting_bracket,RaceError,update_schedule,schedule_times,schedule,state
class BracketTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions);self.open=datetime(2026,11,11,7)
  with self.sessions.begin() as db:
   db.add(User(id=1,first_name='Player',jera=1000));db.add(Meta(key='races_enabled',value='1'));db.add(RaceFund(id=1,balance=10000));db.flush();self.mid=make_meeting(db,self.open).id
 def tearDown(self):self.engine.dispose()
 def test_full_preliminary_and_seven_duels(self):
  with self.sessions.begin() as db:
   race=db.scalar(select(Race).where(Race.meeting_id==self.mid,Race.node_id=='PRE'));horse=json.loads(race.rules_json)['horses'][0]['number'];accept_bet(db,1,race.id,horse,1,'first',self.open+timedelta(minutes=1))
  settled=0
  with patch('race_service.verify_beacon',return_value=True):
   for _ in range(12):
    with self.sessions.begin() as db:
     race=db.scalar(select(Race).where(Race.meeting_id==self.mid,Race.status=='scheduled').order_by(Race.starts_at,Race.id).limit(1))
     if not race:break
     now=race.starts_at+timedelta(minutes=1)
     self.assertTrue(apply_beacon(db,race.id,{'round':race.beacon_round,'randomness':'aa'*32},now));settled+=1;tick(db,now)
  with self.sessions() as db:
   self.assertEqual(settled,8);self.assertEqual(db.get(RaceMeeting,self.mid).status,'finished')
   nodes=meeting_bracket(db,self.mid);self.assertEqual(len(nodes),8);self.assertEqual(len(nodes[0]['horses']),10);self.assertTrue(all(len(n['horses'])==2 for n in nodes[1:]))
   by_node={n['node']:n for n in nodes}
   self.assertEqual({h['number'] for h in by_node['F']['horses']},{by_node['S1']['winner'],by_node['S2']['winner']})
 def test_each_pair_accepts_its_own_stake(self):
  with self.sessions.begin() as db:
   pre=db.get(Race,self.mid+'_PRE');accept_bet(db,1,pre.id,1,1,'pre',self.open+timedelta(minutes=1))
   start=pre.starts_at
  with patch('race_service.verify_beacon',return_value=True):
   with self.sessions.begin() as db:
    apply_beacon(db,self.mid+'_PRE',{'randomness':'aa'*32},start+timedelta(minutes=1));tick(db,start+timedelta(minutes=1))
  with self.sessions.begin() as db:
   for i,node in enumerate(['Q1','Q2','Q3','Q4']):
    race=db.scalar(select(Race).where(Race.meeting_id==self.mid,Race.node_id==node));horse=json.loads(race.rules_json)['horses'][0]['number'];accept_bet(db,1,race.id,horse,25,str(i),race.opens_at)
   self.assertEqual(db.scalar(select(func.count()).select_from(RaceBet)),5)
 def test_empty_whole_meeting_moves_together(self):
  with self.sessions.begin() as db:
   tick(db,self.open+timedelta(minutes=10));self.assertEqual(db.get(RaceMeeting,self.mid).status,'skipped')
   previous=db.scalars(select(Race).where(Race.meeting_id==self.mid)).all();self.assertTrue(all(r.status=='skipped' for r in previous))
   next_meeting=db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==self.open,RaceMeeting.attempt==1));self.assertEqual(next_meeting.opens_at,self.open+timedelta(hours=1))
 def test_only_one_bet_even_with_different_horse_and_small_amount(self):
  with self.sessions.begin() as db:
   rid=self.mid+'_PRE';when=self.open+timedelta(minutes=1)
   first=accept_bet(db,1,rid,1,1,'once',when)
   self.assertEqual(accept_bet(db,1,rid,1,1,'once',when).id,first.id)
   with self.assertRaises(RaceError):accept_bet(db,1,rid,2,1,'second',when)
   self.assertEqual(db.get(User,1).jera,999)
 def test_schedule_changes_future_only_and_supports_minutes(self):
  with self.sessions.begin() as db:
   now=self.open+timedelta(minutes=1);schedule(db,now)
   active=db.get(Race,self.mid+'_PRE');original=active.commitment
   update_schedule(db,['21:15','13:30'],now)
   self.assertEqual(schedule_times(db),['13:30','21:15'])
   self.assertEqual(db.get(Race,self.mid+'_PRE').commitment,original)
   self.assertIsNotNone(db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==datetime(2026,11,11,8,30))))
   self.assertIsNone(db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==datetime(2026,11,11,15))))
   update_schedule(db,['14:00','21:15'],now)
   self.assertIsNone(db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==datetime(2026,11,11,8,30))))
 def test_invalid_schedule_and_no_backdated_meetings(self):
  with self.sessions.begin() as db:
   for values in [['12:00','12:00'],['24:00','20:00'],['9:00','20:00'],['12:60','20:00']]:
    with self.assertRaises(RaceError):update_schedule(db,values,self.open)
   update_schedule(db,['10:00','22:30'],self.open+timedelta(hours=1))
   self.assertIsNone(db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==datetime(2026,11,11,5))))
 def test_dependent_pair_cannot_be_bet_before_it_exists(self):
  with self.sessions() as db:self.assertIsNone(db.scalar(select(Race).where(Race.meeting_id==self.mid,Race.node_id=='F')))
 def test_edit_replaces_once_and_refunds_difference(self):
  with self.sessions.begin() as db:
   rid=self.mid+'_PRE';now=self.open+timedelta(minutes=1)
   first=accept_bet(db,1,rid,1,20,'first',now)
   second=accept_bet(db,1,rid,2,5,'edit',now,replaces_id=first.id)
   self.assertEqual(accept_bet(db,1,rid,2,5,'edit',now,replaces_id=first.id).id,second.id)
   self.assertEqual(db.get(User,1).jera,995);self.assertEqual(db.get(RaceFund,1).balance,10005)
   self.assertEqual(first.status,'replaced');self.assertEqual(db.get(Race,rid).reserved,5)
   view=state(db,db.get(Race,rid),1,now)
   self.assertEqual(len(view['my_bets']),1);self.assertEqual(view['my_bets'][0]['horse'],2)
   self.assertEqual(view['bracket'][0]['my_bet']['horse'],2);self.assertEqual(view['pool'],5)
   self.assertEqual(len(view['meeting_bets']),1)
   with self.assertRaises(RaceError):accept_bet(db,1,rid,3,7,'stale-edit',now,replaces_id=first.id)
 def test_edits_close_exactly_at_start(self):
  with self.sessions.begin() as db:
   race=db.get(Race,self.mid+'_PRE');first=accept_bet(db,1,race.id,1,10,'first',race.opens_at)
   with self.assertRaises(RaceError):accept_bet(db,1,race.id,2,5,'late-edit',race.starts_at,replaces_id=first.id)
   self.assertEqual(db.get(User,1).jera,990);self.assertEqual(first.status,'pending')
 def test_preliminary_reserves_all_eight_possible_payouts_and_pays_top_eight(self):
  from race_fairness import draw
  with self.sessions.begin() as db:
   race=db.get(Race,self.mid+'_PRE');rules=json.loads(race.rules_json);ranking=draw(rules,'bb'*32)
   for n in range(1,11):
    db.add(User(id=100+n,first_name='Player',jera=25));db.flush()
    accept_bet(db,100+n,race.id,n,10,'bet-'+str(n),race.opens_at)
   self.assertEqual(race.reserved,80)
   self.assertEqual(race.closes_at,race.starts_at)
   self.assertEqual(rules['duration_seconds'],60);self.assertTrue(all(h['odds_bps']==10000 for h in rules['horses']))
   with patch('race_service.verify_beacon',return_value=True):
    self.assertFalse(apply_beacon(db,race.id,{'randomness':'bb'*32},race.starts_at+timedelta(seconds=59)))
    self.assertTrue(apply_beacon(db,race.id,{'randomness':'bb'*32},race.starts_at+timedelta(seconds=60)))
   for n in range(1,11):self.assertEqual(db.get(User,100+n).jera,25 if n in ranking[:8] else 15)
   self.assertEqual(db.get(RaceFund,1).balance,10020);self.assertEqual(race.reserved,0)
 def test_next_stage_waits_for_all_parallel_races(self):
  with self.sessions.begin() as db:
   pre=db.get(Race,self.mid+'_PRE');accept_bet(db,1,pre.id,1,1,'pre',pre.opens_at)
   when=pre.starts_at+timedelta(minutes=1)
   with patch('race_service.verify_beacon',return_value=True):apply_beacon(db,pre.id,{'randomness':'cc'*32},when)
   tick(db,when)
   quarters=db.scalars(select(Race).where(Race.meeting_id==self.mid,Race.node_id.in_(['Q1','Q2','Q3','Q4']))).all()
   self.assertEqual(len(quarters),4);self.assertTrue(all(q.starts_at==when+timedelta(minutes=10) and q.closes_at==q.starts_at for q in quarters))
   with patch('race_service.verify_beacon',return_value=True):
    apply_beacon(db,quarters[0].id,{'randomness':'dd'*32},quarters[0].starts_at+timedelta(minutes=1))
   tick(db,quarters[0].starts_at+timedelta(minutes=1))
   self.assertIsNone(db.scalar(select(Race.id).where(Race.meeting_id==self.mid,Race.node_id=='S1')))
