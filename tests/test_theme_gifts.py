# coding: utf-8
import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from uuid import uuid4
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,UserTheme,JeraTx
from disc_models import ThemeUsbGift
from score_service import initialize_score_state
from shop_service import buy_box,unlock_box,ShopError
from theme_gift_service import theme_gifts,update_theme_gift
from disc_service import claim_launch_gift,activate_launch_gift,open_disc

class ThemeGiftTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='Owner',jera=100),User(id=2,first_name='New',jera=0)])
 def tearDown(self):self.engine.dispose()
 def own(self,db,theme):db.add(UserTheme(user_id=1,theme_id=theme,source='test'));db.flush()
 def test_only_owned_themes_qualify_and_later_acquisition_is_supported(self):
  with self.sessions.begin() as db:
   self.assertEqual(theme_gifts(db,1),[])
   with self.assertRaises(ShopError):update_theme_gift(db,1,'poop')
   with self.assertRaises(ShopError):update_theme_gift(db,1,'unknown')
   self.own(db,'neon');self.assertEqual(theme_gifts(db,1)[0]['total'],1)
   self.own(db,'poop');self.assertEqual([g['total'] for g in theme_gifts(db,1)],[1,5])
   self.assertEqual(db.scalar(select(func.count()).select_from(ThemeUsbGift)),0)
 def test_six_free_boxes_pending_retry_and_no_refund_mint(self):
  with self.sessions.begin() as db:
   for key in ('neon','poop'):
    self.own(db,key);update_theme_gift(db,1,key);update_theme_gift(db,1,key,True)
  for left in range(5,-1,-1):
   with self.sessions.begin() as db:
    request=uuid4().hex;box=buy_box(db,1,request);self.assertEqual(box['price'],0);self.assertEqual(box['balance'],100)
    self.assertEqual(buy_box(db,1,request)['box_id'],box['box_id'])
    self.assertEqual(sum(g['remaining'] for g in theme_gifts(db,1)),left)
    result=unlock_box(db,1,box['box_id'],box['runes']);self.assertEqual(result['refund'],0);self.assertEqual(result['balance'],100)
    for key in ('neon','poop'):update_theme_gift(db,1,key);update_theme_gift(db,1,key,True)
    self.assertEqual(sum(g['remaining'] for g in theme_gifts(db,1)),left)
  with self.sessions.begin() as db:
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)
   paid=buy_box(db,1,uuid4().hex);self.assertEqual(paid['price'],100);self.assertEqual(paid['balance'],0)
 def test_theme_and_dvd_balances_are_separate(self):
  with self.sessions.begin() as db:
   self.own(db,'poop');update_theme_gift(db,1,'poop');update_theme_gift(db,1,'poop',True)
   claim_launch_gift(db,1);activate_launch_gift(db,1)
   dvd=open_disc(db,1,uuid4().hex);self.assertEqual(dvd['launch_gift']['remaining'],9)
   self.assertEqual(theme_gifts(db,1)[0]['remaining'],5)
   box=buy_box(db,1,uuid4().hex);self.assertEqual(box['price'],0)
   self.assertEqual(theme_gifts(db,1)[0]['remaining'],4)
 def test_activation_requires_claim_and_rollback_restores_coupon(self):
  with self.sessions.begin() as db:
   self.own(db,'neon')
   with self.assertRaises(ShopError):update_theme_gift(db,1,'neon',True)
   update_theme_gift(db,1,'neon');update_theme_gift(db,1,'neon',True)
  with self.assertRaises(RuntimeError):
   with self.sessions.begin() as db:buy_box(db,1,uuid4().hex);raise RuntimeError('rollback')
  with self.sessions() as db:self.assertEqual(theme_gifts(db,1)[0]['remaining'],1)
