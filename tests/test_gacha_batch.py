import os,unittest,json,tempfile
os.environ['DATABASE_URL']='sqlite:///:memory:'
from uuid import uuid4
from unittest.mock import patch
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx,ThemeBoxPurchase
from disc_models import DiscDraw,DiscInstance
from bekovich_models import BekovichWallet
from gacha_models import GachaBatch
from gacha_service import open_five_discs,buy_five_themes,unlock_five_themes,GachaError
from score_service import initialize_score_state
class BatchTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='One',jera=1000),User(id=2,first_name='Two',jera=0)])
 def tearDown(self):self.engine.dispose()
 def test_dvd_mixed_free_paid_retries_and_all_instances(self):
  with self.sessions.begin() as db:
   db.add(BekovichWallet(user_id=1,dvd_opens=2,theme_opens=0));db.flush();key=uuid4().hex
   with patch('disc_service.choose_disc',return_value=('minecraft','common')):result=open_five_discs(db,1,key)
   self.assertEqual([r['price'] for r in result['draws']],[0,0,50,50,50]);self.assertEqual(result['balance'],850)
   self.assertEqual([r['copy_number'] for r in result['draws']],[1,2,3,4,5]);self.assertEqual(len({r['id'] for r in result['draws']}),5)
   self.assertEqual(open_five_discs(db,1,key)['batch_id'],result['batch_id']);self.assertEqual(db.scalar(select(func.count()).select_from(DiscInstance)),5)
 def test_insufficient_funds_do_not_consume_free_credits(self):
  with self.sessions.begin() as db:
   db.get(User,1).jera=10;db.add(BekovichWallet(user_id=1,dvd_opens=2,theme_opens=2));db.flush()
   for call in [open_five_discs,buy_five_themes]:
    with self.assertRaises(GachaError):call(db,1,uuid4().hex)
   self.assertEqual(db.get(BekovichWallet,1).dvd_opens,2);self.assertEqual(db.get(BekovichWallet,1).theme_opens,2);self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)
 def test_theme_batch_shared_runes_duplicates_refunds_and_alias_recovery(self):
  from shop_service import shop_state
  with self.sessions.begin() as db:
   db.add(BekovichWallet(user_id=1,dvd_opens=0,theme_opens=2));db.flush();key=uuid4().hex
   with patch('shop_service.choose_theme',return_value='retro'):bought=buy_five_themes(db,1,key)
   self.assertEqual(bought['price'],300);self.assertEqual(bought['balance'],700);self.assertEqual(shop_state(db,1)['active_box']['count'],5)
   alias=uuid4().hex;self.assertEqual(buy_five_themes(db,1,alias)['box_id'],bought['box_id'])
   result=unlock_five_themes(db,1,bought['box_id'],bought['runes']);self.assertEqual(result['balance'],775);self.assertEqual(result['total_refund'],75)
   self.assertEqual([r['isDupe'] for r in result['batch_results']],[False,True,True,True,True])
   self.assertEqual(unlock_five_themes(db,1,bought['box_id'],bought['runes'])['balance'],775)
   self.assertEqual(buy_five_themes(db,1,alias)['box_id'],bought['box_id']);self.assertEqual(db.scalar(select(func.count()).select_from(GachaBatch)),1)
 def test_wrong_runes_refund_half_for_all_paid_boxes(self):
  from shop_service import RUNES
  with self.sessions.begin() as db:
   bought=buy_five_themes(db,1,uuid4().hex);wrong=list(bought['runes']);wrong[0]=next(r for r in RUNES if r!=wrong[0]);result=unlock_five_themes(db,1,bought['box_id'],wrong)
   self.assertEqual(result['total_refund'],250);self.assertEqual(result['balance'],750);self.assertTrue(all(not r['ok'] for r in result['batch_results']))
   with self.assertRaises(GachaError):unlock_five_themes(db,2,bought['box_id'],wrong)
 def test_existing_single_pending_blocks_new_batch(self):
  from disc_service import open_disc
  from shop_service import buy_box
  with self.sessions.begin() as db:
   open_disc(db,1,uuid4().hex)
   with self.assertRaises(GachaError):open_five_discs(db,1,uuid4().hex)
   buy_box(db,1,uuid4().hex)
   with self.assertRaises(GachaError):buy_five_themes(db,1,uuid4().hex)
 def test_failure_rolls_back_whole_dvd_batch(self):
  with self.assertRaises(RuntimeError):
   with self.sessions.begin() as db:
    with patch('disc_service.choose_disc',side_effect=[('minecraft','common'),RuntimeError('failure')]):open_five_discs(db,1,uuid4().hex)
  with self.sessions() as db:self.assertEqual(db.get(User,1).jera,1000);self.assertEqual(db.scalar(select(func.count()).select_from(DiscDraw)),0)

class BatchConcurrencyTest(unittest.TestCase):
 def test_same_dvd_request_spends_only_once(self):
  from concurrent.futures import ThreadPoolExecutor
  from pathlib import Path
  with tempfile.TemporaryDirectory() as directory:
   engine=create_engine('sqlite:///'+str(Path(directory)/'batches.sqlite'),connect_args={'check_same_thread':False,'timeout':20});Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
   with sessions.begin() as db:db.add(User(id=1,first_name='One',jera=1000))
   key=uuid4().hex
   def run(_):
    with sessions.begin() as db:return open_five_discs(db,1,key)['batch_id']
   with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,range(2)))
   self.assertEqual(results[0],results[1])
   with sessions() as db:self.assertEqual(db.get(User,1).jera,750);self.assertEqual(db.scalar(select(func.count()).select_from(DiscDraw)),5);self.assertEqual(db.scalar(select(func.count()).select_from(DiscInstance)),5)
   engine.dispose()

class BatchApiTest(unittest.TestCase):
 def test_http_buy_resume_unlock_and_invalid_key(self):
  from types import SimpleNamespace
  from fastapi import FastAPI
  from fastapi.testclient import TestClient
  from sqlalchemy.pool import StaticPool
  from gacha_api import make_gacha_router
  engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool);Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
  with sessions.begin() as db:db.add(User(id=1,first_name='One',jera=2000))
  def get_db():
   with sessions() as db:yield db
  app=FastAPI();app.include_router(make_gacha_router(lambda:SimpleNamespace(id=1),get_db))
  with TestClient(app) as client:
   self.assertEqual(client.post('/api/gacha/dvd/open-five',json={'request_id':'bad'}).status_code,422)
   body={'request_id':uuid4().hex};dvd=client.post('/api/gacha/dvd/open-five',json=body);self.assertEqual(dvd.status_code,200,dvd.text);self.assertEqual(len(dvd.json()['draws']),5)
   self.assertEqual(client.post('/api/gacha/dvd/open-five',json=body).json()['batch_id'],dvd.json()['batch_id'])
   buy=client.post('/api/gacha/themes/buy-five',json={'request_id':uuid4().hex});self.assertEqual(buy.status_code,200,buy.text);data=buy.json();self.assertEqual(data['count'],5)
   unlock=client.post('/api/gacha/themes/unlock-five',json={'box_id':data['box_id'],'runes':data['runes']});self.assertEqual(unlock.status_code,200,unlock.text);self.assertEqual(len(unlock.json()['batch_results']),5)
  engine.dispose()
