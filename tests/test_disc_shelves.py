import unittest,json
from datetime import timedelta
from sqlalchemy import select,func
import test_disc_equipment as fixture
from disc_shelves import seal_disc,shelf_state
from disc_equipment import equip,EquipmentError,settle_expired
from disc_models import DiscShelfSlot,DiscShelfReward
from database import User,JeraTx
from disc_service import disc_state,RARITIES
from community_service import create_trade
class ShelfTest(unittest.TestCase):
 setUp=fixture.EquipmentTest.setUp
 tearDown=fixture.EquipmentTest.tearDown
 disc=fixture.EquipmentTest.disc
 def test_full_set_reward_is_once_and_sealed_discs_leave_inventory(self):
  with self.sessions.begin() as db:
   rows=[self.disc(db,rarity=rarity) for rarity in RARITIES]
   for row in rows:seal_disc(db,1,row.id,self.now)
   self.assertEqual(db.get(User,1).jera,1000)
   seal_disc(db,1,rows[-1].id,self.now)
   self.assertEqual(db.get(User,1).jera,1000)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx).where(JeraTx.reason=='disc:shelf:minecraft')),1)
   shelf=next(s for s in shelf_state(db,1)['shelves'] if s['item']['id']=='minecraft')
   self.assertTrue(shelf['rewarded']);self.assertEqual(len(shelf['slots']),6);self.assertEqual(shelf['secret_gift'],'locked')
   self.assertEqual(disc_state(db,1)['instances'],[])
   with self.assertRaises(EquipmentError):equip(db,1,rows[0].id,self.now)
   duplicate=self.disc(db)
   with self.assertRaises(EquipmentError):seal_disc(db,1,duplicate.id,self.now)
   self.assertEqual(duplicate.status,'ready')
 def test_ownership_active_and_trade_checks(self):
  with self.sessions.begin() as db:
   row=self.disc(db);foreign=self.disc(db,uid=2)
   with self.assertRaises(EquipmentError):seal_disc(db,1,foreign.id,self.now)
   equip(db,1,row.id,self.now)
   with self.assertRaises(EquipmentError):seal_disc(db,1,row.id,self.now)
   equip(db,1,None,self.now);seal_disc(db,1,row.id,self.now)
   other=self.disc(db,disc='doom');wanted=self.disc(db,uid=2,disc='doom')
   from uuid import uuid4
   create_trade(db,1,2,[other.id],[wanted.id],uuid4().hex,self.now)
   with self.assertRaises(EquipmentError):seal_disc(db,1,other.id,self.now)
 def test_cracked_stays_cracked_and_sealed_does_not_expire(self):
  with self.sessions.begin() as db:
   row=self.disc(db);row.status='cracked';seal_disc(db,1,row.id,self.now)
   settle_expired(db,1,self.now+timedelta(days=30))
   self.assertEqual(row.status,'sealed')
   shelf=next(s for s in shelf_state(db,1)['shelves'] if s['item']['id']=='minecraft')
   self.assertTrue(shelf['slots'][0]['cracked']);self.assertEqual(db.get(User,1).jera,0)
