import json,unittest
from datetime import datetime,timedelta
from uuid import uuid4
from unittest.mock import patch
from sqlalchemy import select,func
import test_disc_equipment as equipment_fixture
from database import User,Notification,GameScore,Meta
from disc_models import DiscInstance,DiscEquipment,DiscListing,DiscTradeNotice
from disc_equipment import effect_for,instance_effects,equip,reward_bonus,settle_expired,wear_events,acknowledge_wear,start_practice,finish_practice,practice_top,EquipmentError
from disc_market import publish_listing,reply_listing,close_listing,claim_notice,market_state
from community_service import resolve_trade
from disc_odds import boosted_chances
from disc_service import CATALOG
class DiscV3Test(unittest.TestCase):
 setUp=equipment_fixture.EquipmentTest.setUp
 tearDown=equipment_fixture.EquipmentTest.tearDown
 disc=equipment_fixture.EquipmentTest.disc
 def test_portal_chances_are_relative_and_round_up_to_tenths(self):
  chances=boosted_chances(CATALOG['rarities'],10)
  self.assertEqual(chances['secret'],.2);self.assertEqual(chances['mythic'],4.4);self.assertEqual(chances['rare'],27.5);self.assertEqual(chances['legendary'],1)
  self.assertAlmostEqual(sum(chances.values()),100)
  themes=boosted_chances([{'key':'common','chance':70},{'key':'rare','chance':25},{'key':'mythic','chance':5}],10)
  self.assertEqual(themes,{'common':67,'rare':27.5,'mythic':5.5})
 def test_all_catalogue_games_have_logical_modifiers_and_cs_stays_fixed(self):
  for game in CATALOG['discs']:
   values=effect_for(game['id'],'common');self.assertTrue(values['tempo']!=1 or values['score']!=1 or values['jera_percent']>0)
  self.assertEqual(effect_for('doom','rare')['score'],1.05);self.assertEqual(effect_for('portal','rare')['luck_percent'],10)
  with self.sessions.begin() as db:
   row=self.disc(db,disc='counterstrike');row.effects_json=json.dumps({'tempo':1.17,'score':1.1,'jera_percent':0});self.assertEqual(instance_effects(row)['tempo'],1.17)
 def test_daily_swap_uses_kazakhstan_midnight_and_replays_are_free(self):
  moment=datetime(2026,11,12,18,59)
  with self.sessions.begin() as db:
   one=self.disc(db);two=self.disc(db,disc='doom');equip(db,1,one.id,moment);equip(db,1,two.id,moment)
   equip(db,1,two.id,moment)
   with self.assertRaises(EquipmentError):equip(db,1,one.id,moment)
   equip(db,1,None,moment+timedelta(minutes=2));equip(db,1,one.id,moment+timedelta(minutes=2))
   with self.assertRaises(EquipmentError):equip(db,1,two.id,moment+timedelta(minutes=2))
 def test_portal_bonus_uses_ten_percent_and_wear_event_is_acknowledged_once(self):
  with self.sessions.begin() as db:
   row=self.disc(db,disc='portal');equip(db,1,row.id,self.now);self.assertEqual(reward_bonus(db,1,100,'daily:test',self.now),10)
   settle_expired(db,1,row.expires_at);events=wear_events(db,1);self.assertEqual(events[0]['outcome'],'cracked')
   with self.assertRaises(EquipmentError):acknowledge_wear(db,2,row.id)
   acknowledge_wear(db,1,row.id);acknowledge_wear(db,1,row.id);self.assertEqual(wear_events(db,1),[])
 def test_market_reply_does_not_require_friendship_and_confirmation_is_atomic(self):
  with self.sessions.begin() as db:
   offered=[self.disc(db).id for _ in range(5)];wanted=[self.disc(db,3,rarity='rare').id for _ in range(2)]
   listing=publish_listing(db,1,offered,{'rare':2},uuid4().hex,self.now);key=uuid4().hex
   with self.assertRaises(EquipmentError):reply_listing(db,3,listing['id'],wanted[:1],uuid4().hex,self.now)
   reply=reply_listing(db,3,listing['id'],wanted,key,self.now);self.assertEqual(reply_listing(db,3,listing['id'],wanted,key,self.now)['id'],reply['id'])
   self.assertEqual(db.scalar(select(func.count()).select_from(Notification)),1);self.assertIsNotNone(claim_notice(db,reply['id']));self.assertIsNone(claim_notice(db,reply['id']))
   with self.assertRaises(EquipmentError):resolve_trade(db,3,reply['id'],'accept',self.now)
   result=resolve_trade(db,1,reply['id'],'accept',self.now);self.assertEqual(result['status'],'accepted')
   self.assertTrue(all(db.get(DiscInstance,i).user_id==3 for i in offered));self.assertTrue(all(db.get(DiscInstance,i).user_id==1 for i in wanted));self.assertEqual(db.get(DiscListing,listing['id']).status,'completed')
 def test_closed_listing_cannot_be_accepted_and_optout_disables_push(self):
  with self.sessions.begin() as db:
   one=self.disc(db);two=self.disc(db,3,rarity='rare');listing=publish_listing(db,1,[one.id],{'rare':1},uuid4().hex,self.now);reply=reply_listing(db,3,listing['id'],[two.id],uuid4().hex,self.now)
   db.get(User,1).notify=False;self.assertIsNone(claim_notice(db,reply['id']));self.assertEqual(db.get(DiscTradeNotice,reply['id']).status,'skipped')
   close_listing(db,1,listing['id']);self.assertEqual(resolve_trade(db,1,reply['id'],'accept',self.now)['status'],'invalid');self.assertEqual(one.user_id,1)
 def test_disc_leaderboard_has_one_best_per_player_and_is_separate(self):
  with self.sessions.begin() as db:
   for uid,score in ((1,100),(2,200)):
    disc=self.disc(db,uid,disc='counterstrike');equip(db,uid,disc.id,self.now);run=start_practice(db,uid,'dino',self.now);finish_practice(db,uid,'dino',run['run_id'],score,self.now+timedelta(seconds=30))
   result=practice_top(db,1,'dino');self.assertEqual(result['my_rank'],2);self.assertEqual(result['top'][0]['user_id'],2);self.assertEqual(result['my_best'],110)
   self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)),0)
 def test_portal_draw_boundaries_and_purchase_snapshots(self):
  from disc_service import choose_disc,open_disc,disc_state
  from shop_service import choose_theme,buy_box,shop_state
  for roll,expected in ((0,'common'),(5589,'common'),(5590,'rare'),(8339,'rare'),(8340,'epic'),(9439,'epic'),(9440,'mythic'),(9879,'mythic'),(9880,'legendary'),(9979,'legendary'),(9980,'secret'),(9999,'secret')):
   with patch('disc_service.secrets.randbelow',return_value=roll):self.assertEqual(choose_disc(10)[1],expected)
  with patch('shop_service.secrets.randbelow',side_effect=[9450,0]):self.assertEqual(choose_theme(10),'poop')
  with self.sessions.begin() as db:
   db.get(User,1).jera=1000;disc=self.disc(db,disc='portal');equip(db,1,disc.id,self.now)
   with patch('disc_service.choose_disc',return_value=('doom','rare')) as choose:open_disc(db,1,uuid4().hex);choose.assert_called_once_with(10)
   with patch('shop_service.choose_theme',return_value='retro') as choose:buy_box(db,1,uuid4().hex);choose.assert_called_once_with(10)
   groups=shop_state(db,1)['rarities'];self.assertEqual(next(g for g in groups if g['key']=='mythic')['chance'],5.5)
   self.assertEqual(next(g for g in disc_state(db,1)['rarities'] if g['id']=='secret')['chance'],.2)
