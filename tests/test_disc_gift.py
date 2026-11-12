import os,unittest,tempfile
os.environ['DATABASE_URL']='sqlite:///:memory:'
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx
from disc_models import DiscDraw,DiscLaunchGift
from disc_service import claim_launch_gift,activate_launch_gift,launch_gift_state,open_disc,reveal_disc,DiscError
from score_service import initialize_score_state

class DiscGiftTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='Existing',jera=500),User(id=2,first_name='New',jera=0)])
 def tearDown(self):self.engine.dispose()
 def test_gift_is_available_to_existing_and_new_users_without_get_writes(self):
  with self.sessions() as db:
   for uid in (1,2):self.assertEqual(launch_gift_state(db,uid),{'id':'dvd-launch-usb-v1','total':10,'claimed':False,'activated':False,'remaining':0})
   self.assertEqual(db.scalar(select(func.count()).select_from(DiscLaunchGift)),0)
 def test_claim_activation_and_replays_do_not_refill_consumed_credits(self):
  with self.sessions.begin() as db:
   first=claim_launch_gift(db,1);self.assertEqual(first['balance'],500);self.assertFalse(first['launch_gift']['activated'])
   self.assertEqual(claim_launch_gift(db,1),first)
   active=activate_launch_gift(db,1);self.assertEqual(active['launch_gift']['remaining'],10)
  request=uuid4().hex
  with self.sessions.begin() as db:draw=open_disc(db,1,request);self.assertTrue(draw['draw']['free']);self.assertEqual(draw['draw']['price'],0)
  with self.sessions.begin() as db:
   self.assertEqual(open_disc(db,1,request)['launch_gift']['remaining'],9)
   self.assertEqual(open_disc(db,1,uuid4().hex)['draw']['id'],draw['draw']['id'])
   self.assertEqual(activate_launch_gift(db,1)['launch_gift']['remaining'],9)
   self.assertEqual(claim_launch_gift(db,1)['launch_gift']['remaining'],9)
   reveal_disc(db,1,draw['draw']['id']);self.assertEqual(launch_gift_state(db,1)['remaining'],9)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)
 def test_ten_free_opens_then_paid_price_and_no_negative_credits(self):
  with self.sessions.begin() as db:claim_launch_gift(db,2);activate_launch_gift(db,2)
  for left in range(9,-1,-1):
   with self.sessions.begin() as db:
    result=open_disc(db,2,uuid4().hex);self.assertEqual(result['balance'],0);self.assertEqual(result['launch_gift']['remaining'],left);reveal_disc(db,2,result['draw']['id'])
  with self.sessions.begin() as db:
   with self.assertRaises(DiscError):open_disc(db,2,uuid4().hex)
  with self.sessions.begin() as db:
   self.assertEqual(activate_launch_gift(db,2)['launch_gift']['remaining'],0);db.get(User,2).jera=50
  with self.sessions.begin() as db:
   result=open_disc(db,2,uuid4().hex);self.assertFalse(result['draw']['free']);self.assertEqual(result['draw']['price'],50);self.assertEqual(result['balance'],0)
   self.assertEqual(db.get(DiscLaunchGift,2).remaining,0);self.assertEqual(db.scalar(select(func.sum(JeraTx.amount))),-50)
 def test_activation_requires_owned_usb_and_rollback_restores_free_credit(self):
  with self.sessions.begin() as db:
   with self.assertRaises(DiscError):activate_launch_gift(db,1)
   claim_launch_gift(db,1);activate_launch_gift(db,1)
  with self.assertRaises(RuntimeError):
   with self.sessions.begin() as db:open_disc(db,1,uuid4().hex);raise RuntimeError('rollback')
  with self.sessions() as db:self.assertEqual(launch_gift_state(db,1)['remaining'],10);self.assertEqual(db.scalar(select(func.count()).select_from(DiscDraw)),0)
 def test_activating_usb_does_not_recharge_or_convert_a_paid_pending_draw(self):
  with self.sessions.begin() as db:paid=open_disc(db,1,uuid4().hex)['draw']
  with self.sessions.begin() as db:
   claim_launch_gift(db,1);activate_launch_gift(db,1);recovered=open_disc(db,1,uuid4().hex)
   self.assertEqual(recovered['draw']['id'],paid['id']);self.assertEqual(recovered['draw']['price'],50);self.assertEqual(recovered['balance'],450);self.assertEqual(recovered['launch_gift']['remaining'],10)
 def test_concurrent_activation_and_opening_spend_one_credit(self):
  with tempfile.TemporaryDirectory() as folder:
   engine=create_engine('sqlite:///'+str(Path(folder)/'gifts.db'),connect_args={'check_same_thread':False,'timeout':15});Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
   with sessions.begin() as db:db.add(User(id=1,first_name='One',jera=500))
   def activate(_):
    with sessions.begin() as db:claim_launch_gift(db,1);return activate_launch_gift(db,1)['launch_gift']['remaining']
   with ThreadPoolExecutor(max_workers=4) as pool:self.assertEqual(list(pool.map(activate,range(4))),[10]*4)
   def buy(_):
    with sessions.begin() as db:return open_disc(db,1,uuid4().hex)['draw']['id']
   with ThreadPoolExecutor(max_workers=4) as pool:ids=list(pool.map(buy,range(8)))
   with sessions() as db:
    self.assertEqual(len(set(ids)),1);self.assertEqual(db.get(User,1).jera,500);self.assertEqual(db.get(DiscLaunchGift,1).remaining,9);self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)
   engine.dispose()
