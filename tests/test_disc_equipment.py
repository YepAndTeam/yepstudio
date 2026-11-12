# coding: utf-8
import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from uuid import uuid4
from unittest.mock import patch
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,GameScore,JeraTx,GameResult
from disc_models import DiscInstance,DiscCopy,DiscEquipment,DiscRun
from disc_equipment import *
from score_service import initialize_score_state,submit_result,ScoreError
from community_service import *
from social_models import Friendship
from weekly import grant
class EquipmentTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions);self.now=datetime.utcnow()
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='One',jera=0),User(id=2,first_name='Two',jera=0),User(id=3,first_name='Three',jera=0)]);db.flush();db.add(Friendship(low_id=1,high_id=2,requested_by=1,status='accepted'))
 def tearDown(self):self.engine.dispose()
 def disc(self,db,uid=1,disc='minecraft',rarity='common',roll=0):
  row=create_instance(db,uid,disc,rarity,uuid4().hex,self.now);row.wear_roll=roll;db.flush();return row
 def test_lifetimes_all_rarities_and_idempotent_activation(self):
  with self.sessions.begin() as db:
   for rarity,hours in HOURS.items():
    row=self.disc(db,rarity=rarity);equip(db,1,row.id,self.now);self.assertEqual(row.expires_at,self.now+timedelta(hours=hours));equip(db,1,None,self.now+timedelta(minutes=1));equip(db,1,row.id,self.now+timedelta(days=1) if hours>24 else self.now+timedelta(minutes=2));self.assertEqual(row.expires_at,self.now+timedelta(hours=hours));db.get(DiscEquipment,1).instance_id=None;db.delete(db.get(Meta,'disc_swap_day:1'));db.flush()
 def test_expiry_survival_and_secret_loses_exactly_one_effect_once(self):
  with self.sessions.begin() as db:
   for rarity,chance in SURVIVE.items():
    row=self.disc(db,rarity=rarity,roll=chance-1);equip(db,1,row.id,self.now);before=json.loads(row.effects_json);deadline=row.expires_at
    settle_expired(db,1,deadline);self.assertEqual(row.status,'cracked');self.assertIsNone(active_disc(db,1,deadline))
    if rarity=='secret':self.assertEqual(len(json.loads(row.effects_json)),len(before)-1)
    after=row.effects_json;settle_expired(db,1,deadline+timedelta(days=1));self.assertEqual(row.effects_json,after)
    with self.assertRaises(EquipmentError):equip(db,1,row.id,deadline)
    if chance<100:
     lost=self.disc(db,rarity=rarity,roll=chance);equip(db,1,lost.id,self.now);settle_expired(db,1,lost.expires_at);self.assertEqual(lost.status,'lost')
 def test_legacy_stacks_expand_without_losses_or_double_migration(self):
  with self.sessions.begin() as db:db.add(DiscCopy(user_id=1,disc_id='terraria',rarity='rare',quantity=4));db.flush();ensure_inventory(db,1);ids=set(db.scalars(select(DiscInstance.id)));ensure_inventory(db,1);self.assertEqual(len(ids),4);self.assertEqual(set(db.scalars(select(DiscInstance.id))),ids)
 def test_practice_never_enters_ranked_and_cannot_submit_as_ranked(self):
  with self.sessions.begin() as db:
   row=self.disc(db,disc='counterstrike');equip(db,1,row.id,self.now);run=start_practice(db,1,'dino',self.now)
   self.assertGreaterEqual(run['effects']['tempo'],1.05);self.assertLessEqual(run['effects']['tempo'],1.3)
   result=finish_practice(db,1,'dino',run['run_id'],100,self.now+timedelta(seconds=30));self.assertEqual(result['score'],110);self.assertFalse(result['record'])
   self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)),0)
   with self.assertRaises(ScoreError):submit_result(db,1,'dino',100,self.now+timedelta(seconds=31),run['run_id'])
   self.assertEqual(finish_practice(db,1,'dino',run['run_id'],100,self.now+timedelta(seconds=31))['score'],110)
   self.assertEqual(db.scalar(select(func.count()).select_from(GameResult)),1)
 def test_wallet_bonus_carries_fractions_and_excludes_refunds(self):
  with self.sessions.begin() as db:
   row=self.disc(db);equip(db,1,row.id,self.now)
   for index in range(20):grant(db,1,1,'daily-task:test:'+str(index),self.now)
   self.assertEqual(db.get(User,1).jera,21)
   grant(db,1,100,'shop:refund:test',self.now);self.assertEqual(db.get(User,1).jera,121)
   self.assertEqual(reward_bonus(db,1,1,'daily-task:test:0',self.now),0)
 def test_trade_atomic_idempotent_and_only_recipient_can_accept(self):
  with self.sessions.begin() as db:
   one=self.disc(db);two=self.disc(db,2,disc='terraria');offer=create_trade(db,1,2,[one.id],[two.id],uuid4().hex,self.now)
   with self.assertRaises(EquipmentError):resolve_trade(db,1,offer['id'],'accept',self.now)
   resolve_trade(db,2,offer['id'],'accept',self.now);self.assertEqual(one.user_id,2);self.assertEqual(two.user_id,1)
   resolve_trade(db,2,offer['id'],'accept',self.now);self.assertEqual(one.user_id,2)
 def test_activated_item_invalidates_offer_without_partial_transfer(self):
  with self.sessions.begin() as db:
   one=self.disc(db);two=self.disc(db,2);offer=create_trade(db,1,2,[one.id],[two.id],uuid4().hex,self.now);equip(db,1,one.id,self.now)
   self.assertEqual(resolve_trade(db,2,offer['id'],'accept',self.now)['status'],'invalid');self.assertEqual(two.user_id,2)
 def test_chat_rate_limit_delete_permissions_and_visibility(self):
  with self.sessions.begin() as db:
   state=post_chat(db,1,'hello',self.now);identity=state['messages'][0]['id']
   with self.assertRaises(EquipmentError):post_chat(db,1,'again',self.now)
   with self.assertRaises(EquipmentError):remove_chat(db,2,identity)
   self.assertEqual(remove_chat(db,1,identity)['messages'],[])
 def test_expired_run_and_foreign_run_are_rejected(self):
  with self.sessions.begin() as db:
   disc=self.disc(db);equip(db,1,disc.id,self.now);run=start_practice(db,1,'dino',self.now)
   with self.assertRaises(EquipmentError):finish_practice(db,2,'dino',run['run_id'],10,self.now+timedelta(seconds=2))
   with self.assertRaises(EquipmentError):finish_practice(db,1,'dino',run['run_id'],10,disc.expires_at+timedelta(seconds=1))
 def test_competing_trade_accepts_and_concurrent_expiry_are_atomic(self):
  import tempfile
  from pathlib import Path
  from concurrent.futures import ThreadPoolExecutor
  with tempfile.TemporaryDirectory() as folder:
   engine=create_engine('sqlite:///'+str(Path(folder)/'atomic.db'),connect_args={'check_same_thread':False,'timeout':20});Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
   with sessions.begin() as db:
    db.add_all([User(id=1,first_name='One',jera=0),User(id=2,first_name='Two',jera=0)]);db.flush();db.add(Friendship(low_id=1,high_id=2,requested_by=1,status='accepted'));db.flush()
    first=create_instance(db,1,'minecraft','rare',uuid4().hex);second=create_instance(db,2,'terraria','rare',uuid4().hex);third=create_instance(db,2,'doom','rare',uuid4().hex);db.flush()
    one=create_trade(db,1,2,[first.id],[second.id],uuid4().hex,self.now)['id'];two=create_trade(db,1,2,[first.id],[third.id],uuid4().hex,self.now)['id']
    secret=create_instance(db,1,'portal','secret',uuid4().hex);secret.wear_roll=0;db.flush();equip(db,1,secret.id,self.now);secret_id=secret.id;deadline=secret.expires_at
   def accept(identity):
    with sessions.begin() as db:return resolve_trade(db,2,identity,'accept',self.now)['status']
   with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(accept,[one,two]))
   self.assertEqual(sorted(statuses),['accepted','invalid'])
   def expire(_):
    with sessions.begin() as db:settle_expired(db,1,deadline)
   with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(expire,range(8)))
   with sessions() as db:self.assertEqual(len(json.loads(db.get(DiscInstance,secret_id).effects_json)),len(effect_for('portal','secret'))-1);self.assertEqual(db.scalar(select(func.count()).select_from(DiscInstance)),4)
   engine.dispose()
