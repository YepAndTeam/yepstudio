import os,unittest,json
from unittest.mock import patch
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base,User
from garden_models import GardenState
from garden_service import garden_state,garden_action,GardenError,CATALOG
from yaabik_service import open_companion
class GardenTest(unittest.TestCase):
 def setUp(self):
  self.roll=patch('garden_service.secrets.randbelow',return_value=0);self.roll.start()
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);self.now=datetime(2026,11,13,12,10)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='One',jera=123),User(id=2,first_name='Two',jera=456)])
 def tearDown(self):self.roll.stop();self.engine.dispose()
 def action(self,db,kind,req='b',**kwargs):
  at=kwargs.pop('now',self.now);start=at-timedelta(seconds=10) if kind=='plant' else at
  result=garden_action(db,1,req*32,kind,now=start,**kwargs)
  if kind in ('plant','water'):return garden_state(db,1,at if kind=='plant' else at+timedelta(seconds=10))
  return result
 def test_start_is_once_and_private(self):
  with self.sessions.begin() as db:
   value=garden_state(db,1,self.now);self.assertEqual(value['parts'],50);self.assertEqual(value['seeds'],{'carrot':2,'sunflower':1});self.assertEqual(len(value['plots']),4);self.assertEqual(len(value['catalog']),12)
   self.action(db,'plant',plot=0,crop='carrot');self.assertEqual(garden_state(db,1,self.now)['seeds']['carrot'],1);self.assertEqual(garden_state(db,2,self.now)['seeds']['carrot'],2)
 def test_seed_consumption_growth_and_harvest_follow_server_time(self):
  with self.sessions.begin() as db:
   value=self.action(db,'plant',plot=0,crop='carrot');self.assertEqual(value['parts'],50);self.assertEqual(value['seeds']['carrot'],1)
   with self.assertRaises(GardenError):self.action(db,'harvest',req='c',plot=0,now=self.now+timedelta(minutes=9,seconds=59))
   value=self.action(db,'harvest',req='d',plot=0,now=self.now+timedelta(days=30));self.assertEqual(value['parts'],50);self.assertEqual(value['warehouse']['carrot'],1);self.assertEqual(value['harvests'],1);self.assertIsNone(value['plots'][0]);self.assertEqual(db.get(User,1).jera,123)
 def test_retries_do_not_duplicate_seeds_cost_or_harvest(self):
  with self.sessions.begin() as db:
   shop=garden_state(db,1,self.now)['shop'];one=self.action(db,'buy',crop='carrot',shop_hour=shop['hour']);two=self.action(db,'buy',crop='carrot',shop_hour=shop['hour']);self.assertEqual(one['parts'],two['parts']);self.assertEqual(two['seeds']['carrot'],3)
   self.action(db,'plant',req='c',plot=0,crop='carrot');self.action(db,'water',req='e',plot=0,now=self.now+timedelta(minutes=2));one=self.action(db,'harvest',req='d',plot=0,now=self.now+timedelta(minutes=10));two=self.action(db,'harvest',req='d',plot=0,now=self.now+timedelta(minutes=10));self.assertEqual(one['parts'],two['parts']);self.assertEqual(two['harvests'],1)
 def test_shop_stable_within_hour_and_has_personal_stock(self):
  with self.sessions.begin() as db:
   shop=garden_state(db,1,self.now)['shop'];again=garden_state(db,1,self.now+timedelta(minutes=20))['shop'];self.assertEqual(shop,again);self.assertEqual(len(shop['offers']),4)
   offer=next(o for o in shop['offers'] if o['crop']=='carrot');value=self.action(db,'buy',crop='carrot',shop_hour=shop['hour'],quantity=offer['stock']);self.assertEqual(next(o for o in value['shop']['offers'] if o['crop']=='carrot')['remaining'],0)
   with self.assertRaises(GardenError):self.action(db,'buy',req='c',crop='carrot',shop_hour=shop['hour'])
   other=garden_state(db,2,self.now);self.assertEqual(next(o for o in other['shop']['offers'] if o['crop']=='carrot')['remaining'],offer['stock'])
 def test_hour_boundary_rejects_stale_checkout_and_resets_stock(self):
  with self.sessions.begin() as db:
   old=garden_state(db,1,self.now)['shop'];future=self.now.replace(hour=13,minute=0)
   with self.assertRaises(GardenError):self.action(db,'buy',crop='carrot',shop_hour=old['hour'],now=future)
   new=garden_state(db,1,future)['shop'];self.assertNotEqual(new['hour'],old['hour']);self.assertTrue(all(o['remaining']==o['stock'] for o in new['offers']));self.assertNotEqual(new,old)
 def test_inventory_required_and_invalid_plots_rejected(self):
  with self.sessions.begin() as db:
   with self.assertRaises(GardenError):self.action(db,'plant',plot=0,crop='mushroom')
   with self.assertRaises(GardenError):self.action(db,'plant',plot=4,crop='carrot')
   self.action(db,'plant',plot=0,crop='carrot')
   with self.assertRaises(GardenError):self.action(db,'plant',req='c',plot=0,crop='carrot')
 def test_upgrade_once_adds_two_plots_and_starter_seeds(self):
  with self.sessions.begin() as db:
   garden_state(db,1,self.now);row=db.get(GardenState,1);data=json.loads(row.data_json);data['parts']=100;data['seeds']={};row.data_json=json.dumps(data);db.flush()
   value=self.action(db,'upgrade');self.assertEqual(len(value['plots']),6);self.assertEqual(value['parts'],0);self.assertEqual(value['seeds']['carrot'],2)
   with self.assertRaises(GardenError):self.action(db,'upgrade',req='c')
 def test_harvest_teaches_existing_yaabik_without_creating_or_charging_pet(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,now=self.now);self.action(db,'plant',plot=0,crop='carrot');self.action(db,'harvest',req='c',plot=0,now=self.now+timedelta(minutes=20));pet=open_companion(db,1,'d'*32,now=self.now+timedelta(minutes=20));self.assertEqual(pet['habits']['gardens'],1);self.assertEqual(pet['battery']['level'],65)
 def test_api_validation_and_failed_purchase_roll_back(self):
  from pydantic import ValidationError
  from fastapi import HTTPException
  from garden_api import make_garden_router,GardenIn
  with self.assertRaises(ValidationError):GardenIn(request_id='b'*32,kind='buy',quantity=0)
  router=make_garden_router(lambda:None,lambda:None);read=next(r.endpoint for r in router.routes if r.path=='/api/garden');action=next(r.endpoint for r in router.routes if r.path=='/api/garden/action')
  with self.sessions() as db:
   user=db.get(User,1);value=read(user,db)
   with self.assertRaises(HTTPException):action(GardenIn(request_id='b'*32,kind='buy',crop='nope',shop_hour=value['shop']['hour']),user,db)
   self.assertEqual(read(user,db)['parts'],50)

 def test_unaffordable_offer_does_not_charge_or_grant_seed(self):
  with self.sessions.begin() as db:
   value=garden_state(db,1,self.now);offer=next(o for o in value['shop']['offers'] if o['price']>50)
   with self.assertRaises(GardenError):self.action(db,'buy',crop=offer['crop'],shop_hour=value['shop']['hour'])
   after=garden_state(db,1,self.now);self.assertEqual(after['parts'],50);self.assertNotIn(offer['crop'],after['seeds'])
 def test_v1_upgrade_keeps_existing_crops_and_grants_starter_only_once(self):
  with self.sessions.begin() as db:
   old={'parts':17,'expanded':False,'plots':[{'crop':'carrot','planted_at':0,'ready_at':1},None,None,None],'harvests':2,'grown':{'carrot':2},'seen':[]};db.add(GardenState(user_id=1,data_json=json.dumps(old)));db.flush()
   first=garden_state(db,1,self.now);again=garden_state(db,1,self.now);self.assertEqual(first['parts'],43);self.assertEqual(again['parts'],43);self.assertEqual(again['harvests'],2);self.assertEqual(again['seeds']['carrot'],2);self.assertEqual(again['plots'][0]['crop'],'carrot')

 def test_dry_growth_is_exactly_twice_catalogue_time(self):
  with self.sessions.begin() as db:
   value=self.action(db,'plant',plot=0,crop='sunflower');plant=value['plots'][0];self.assertEqual(plant['ready_at']-plant['planted_at'],7200000)
   with self.assertRaises(GardenError):self.action(db,'harvest',req='c',plot=0,now=self.now+timedelta(hours=1))
   value=self.action(db,'harvest',req='d',plot=0,now=self.now+timedelta(hours=2));self.assertEqual(value['warehouse']['sunflower'],1);self.assertEqual(value['parts'],50)
 def test_timely_water_gives_catalogue_time_and_late_water_never_restarts_growth(self):
  with self.sessions.begin() as db:
   self.action(db,'plant',plot=0,crop='sunflower')
   with self.assertRaises(GardenError):self.action(db,'water',req='c',plot=0,now=self.now+timedelta(seconds=119))
   wet=self.action(db,'water',req='d',plot=0,now=self.now+timedelta(minutes=2));self.assertEqual(wet['plots'][0]['ready_at']-wet['plots'][0]['planted_at'],3600000)
   with self.assertRaises(GardenError):self.action(db,'water',req='e',plot=0,now=self.now+timedelta(minutes=3))
   self.action(db,'plant',req='f',plot=1,crop='carrot');late=self.action(db,'water',req='1',plot=1,now=self.now+timedelta(minutes=6));duration=late['plots'][1]['ready_at']-late['plots'][1]['planted_at'];self.assertEqual(duration,720000)
 def test_auto_water_works_offline_at_due_time(self):
  with self.sessions.begin() as db:
   self.action(db,'auto',auto_water=True);self.action(db,'plant',req='c',plot=0,crop='sunflower');value=garden_state(db,1,self.now+timedelta(hours=1));plant=value['plots'][0];self.assertTrue(plant['ready']);self.assertEqual(plant['watered_at'],plant['planted_at']+130000);self.assertEqual(value['parts'],50)
 def test_auto_water_disabled_keeps_dry_deadline(self):
  with self.sessions.begin() as db:
   self.action(db,'auto',auto_water=True);self.action(db,'plant',req='c',plot=0,crop='sunflower');self.action(db,'auto',req='d',auto_water=False,now=self.now+timedelta(minutes=1));value=garden_state(db,1,self.now+timedelta(hours=1));self.assertFalse(value['plots'][0]['ready']);self.assertIsNone(value['plots'][0]['watered_at'])
 def test_warehouse_sale_is_explicit_and_idempotent(self):
  with self.sessions.begin() as db:
   self.action(db,'plant',plot=0,crop='carrot');self.action(db,'harvest',req='c',plot=0,now=self.now+timedelta(minutes=20));value=garden_state(db,1,self.now+timedelta(days=30));self.assertEqual(value['warehouse']['carrot'],1);self.assertEqual(value['parts'],50)
   sold=self.action(db,'sell',req='d',crop='carrot');again=self.action(db,'sell',req='d',crop='carrot');self.assertEqual(sold['parts'],58);self.assertEqual(again['parts'],58);self.assertEqual(again['warehouse']['carrot'],0)
   with self.assertRaises(GardenError):self.action(db,'sell',req='e',crop='carrot')
 def test_bulk_sale_does_not_touch_jera_or_seeds(self):
  with self.sessions.begin() as db:
   garden_state(db,1,self.now);row=db.get(GardenState,1);data=json.loads(row.data_json);data['warehouse']={'carrot':2,'sunflower':1};row.data_json=json.dumps(data);db.flush();sold=self.action(db,'sell_all');self.assertEqual(sold['parts'],86);self.assertEqual(sold['warehouse'],{});self.assertEqual(sold['seeds']['carrot'],2);self.assertEqual(db.get(User,1).jera,123)
 def test_shop_four_offers_with_exact_rarity_limits(self):
  with self.sessions.begin() as db:
   value=garden_state(db,1,self.now);self.assertEqual(len(value['shop']['offers']),4)
   crops={c['id']:c for c in value['catalog']}
   for offer in value['shop']['offers']:self.assertEqual(offer['stock'],{'common':4,'rare':2,'epic':1}[crops[offer['crop']]['rarity']])

 def test_planting_is_a_persistent_ten_second_job_with_reserved_seed(self):
  with self.sessions.begin() as db:
   initial=garden_action(db,1,'1'*32,'plant',plot=0,crop='carrot',now=self.now);self.assertIsNone(initial['plots'][0]);self.assertEqual(initial['seeds']['carrot'],1);self.assertEqual(initial['job']['ends_at']-initial['job']['started_at'],10000)
  with self.sessions.begin() as db:
   early=garden_state(db,1,self.now+timedelta(seconds=9));self.assertIsNone(early['plots'][0]);self.assertIsNotNone(early['job'])
   retry=garden_action(db,1,'1'*32,'plant',plot=0,crop='carrot',now=self.now+timedelta(seconds=9));self.assertEqual(retry['seeds']['carrot'],1)
   with self.assertRaises(GardenError):garden_action(db,1,'2'*32,'plant',plot=1,crop='carrot',now=self.now+timedelta(seconds=9))
   done=garden_state(db,1,self.now+timedelta(seconds=10));self.assertIsNone(done['job']);self.assertEqual(done['plots'][0]['planted_at'],initial['job']['ends_at']);self.assertEqual(done['plots'][0]['water_due'],initial['job']['ends_at']+120000)
 def test_water_is_not_applied_until_ten_seconds_finish(self):
  with self.sessions.begin() as db:
   self.action(db,'plant',plot=0,crop='carrot');start=self.now+timedelta(minutes=2)
   pending=garden_action(db,1,'3'*32,'water',plot=0,now=start);self.assertIsNone(pending['plots'][0]['watered_at']);self.assertEqual(pending['job']['kind'],'water')
   early=garden_state(db,1,start+timedelta(seconds=9));self.assertIsNone(early['plots'][0]['watered_at'])
   done=garden_state(db,1,start+timedelta(seconds=10));self.assertIsNone(done['job']);self.assertEqual(done['plots'][0]['watered_at'],pending['job']['ends_at']);self.assertEqual(done['plots'][0]['ready_at']-done['plots'][0]['planted_at'],600000)
 def test_offline_auto_water_jobs_are_serial_and_keep_results(self):
  with self.sessions.begin() as db:
   self.action(db,'plant',plot=0,crop='carrot');self.action(db,'plant',req='c',plot=1,crop='carrot');self.action(db,'auto',req='d',auto_water=True)
  with self.sessions.begin() as db:
   value=garden_state(db,1,self.now+timedelta(hours=1));one,two=value['plots'][:2];self.assertTrue(one['ready'] and two['ready']);self.assertEqual(two['watered_at']-one['watered_at'],10000);self.assertIsNone(value['job'])

 def test_variant_boundaries_and_prices(self):
  from garden_service import variant_for_roll,harvest_price,VARIANTS
  self.assertEqual(sum(v['chance'] for v in VARIANTS),100)
  for roll,expected in [(0,'normal'),(8999,'normal'),(9000,'shiny'),(9799,'shiny'),(9800,'golden'),(9999,'golden')]:self.assertEqual(variant_for_roll(roll),expected)
  self.assertEqual(harvest_price('carrot','shiny'),12);self.assertEqual(harvest_price('carrot','golden'),24);self.assertEqual(harvest_price('radish','shiny'),8)
 def test_variant_fixed_on_first_plant_and_hidden_until_ripe(self):
  with self.sessions.begin() as db:
   with patch('garden_service.secrets.randbelow',return_value=9900) as roll:
    begun=garden_action(db,1,'9'*32,'plant',plot=0,crop='carrot',now=self.now);self.assertNotIn('variant',begun['job']);garden_action(db,1,'9'*32,'plant',plot=0,crop='carrot',now=self.now);self.assertEqual(roll.call_count,1)
   young=garden_state(db,1,self.now+timedelta(seconds=10));self.assertIsNone(young['plots'][0]['variant'])
  with self.sessions.begin() as db:
   grown=garden_state(db,1,self.now+timedelta(hours=1));self.assertEqual(grown['plots'][0]['variant'],'golden')
 def test_variant_warehouse_separates_sales_and_prevents_wrong_variant_spending(self):
  with self.sessions.begin() as db:
   garden_state(db,1,self.now);row=db.get(GardenState,1);data=json.loads(row.data_json);data['warehouse']={'carrot':1,'carrot@shiny':1,'carrot@golden':1};row.data_json=json.dumps(data);db.flush()
   value=self.action(db,'sell',crop='carrot',variant='golden');self.assertEqual(value['parts'],74);self.assertEqual(value['warehouse']['carrot'],1);self.assertEqual(value['warehouse']['carrot@shiny'],1);self.assertEqual(value['warehouse']['carrot@golden'],0)
   again=self.action(db,'sell',crop='carrot',variant='golden');self.assertEqual(again['parts'],74)
   with self.assertRaises(GardenError):self.action(db,'sell',req='c',crop='carrot',variant='golden')
   sold=self.action(db,'sell_all',req='d');self.assertEqual(sold['parts'],94);self.assertEqual(sold['warehouse'],{})
 def test_golden_harvest_keeps_its_variant_and_price(self):
  with self.sessions.begin() as db:
   with patch('garden_service.secrets.randbelow',return_value=9900):self.action(db,'plant',plot=0,crop='carrot')
   value=self.action(db,'harvest',req='c',plot=0,now=self.now+timedelta(hours=1));self.assertEqual(value['parts'],50);self.assertEqual(value['warehouse']['carrot@golden'],1);self.assertEqual(value['harvest_items'][0]['price'],24)
