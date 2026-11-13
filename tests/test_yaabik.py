import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User
from disc_models import DiscInstance,DiscShelfSlot
from yaabik_models import YaabikState
from yaabik_service import open_companion,apply_actions,YaabikError,timestamp

class YaabikTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);self.now=datetime(2026,11,13,10)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='One',jera=123),User(id=2,first_name='Two',jera=456)])
 def tearDown(self):self.engine.dispose()
 def slot(self,db,uid=1,index=0):
  identifier=f'{uid:02d}{index:030d}';disc='minecraft' if index%2==0 else 'portal';rarity=['common','rare','epic','mythic','legendary','secret'][index%6]
  db.add(DiscInstance(id=identifier,user_id=uid,disc_id=disc,rarity=rarity,status='sealed',wear_roll=0));db.flush();db.add(DiscShelfSlot(user_id=uid,disc_id=disc,rarity=rarity,instance_id=identifier));db.flush();return identifier
 def test_import_once_then_existing_server_wins_other_device(self):
  with self.sessions.begin() as db:
   own=self.slot(db);other=self.slot(db,uid=2)
   first=open_companion(db,1,'a'*32,{'prefs':{'skin':'mint','room':'night','sounds':False},'battery':{'level':40,'docked':False,'updatedAt':timestamp(self.now)},'shelf_ids':[own,other]},self.now)
   self.assertTrue(first['first_visit']);self.assertEqual(first['shelf_ids'],[own]);self.assertEqual(first['prefs']['skin'],'mint')
   second=open_companion(db,1,'b'*32,{'prefs':{'skin':'sunset'},'battery':{'level':100}},self.now)
   self.assertFalse(second['first_visit']);self.assertEqual(second['battery']['level'],40);self.assertEqual(second['prefs']['skin'],'mint');self.assertEqual(second['habits']['visits'],1)
 def test_server_clock_charges_offline_and_stops_when_undocked(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,{'battery':{'level':20,'docked':True,'updatedAt':timestamp(self.now)}},self.now)
   after=open_companion(db,1,'b'*32,now=self.now+timedelta(minutes=3));self.assertEqual(after['battery']['level'],35)
   apply_actions(db,1,[{'id':'c'*32,'kind':'dock','value':False}],self.now+timedelta(minutes=3))
   later=open_companion(db,1,'d'*32,now=self.now+timedelta(hours=10));self.assertEqual(later['battery']['level'],35)
 def test_action_retry_is_idempotent_and_costs_are_server_owned(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,now=self.now);cmd={'id':'b'*32,'kind':'play'}
   one=apply_actions(db,1,[cmd,cmd],self.now);two=apply_actions(db,1,[cmd],self.now)
   self.assertEqual(two['battery']['level'],64);self.assertEqual(two['habits']['games'],1);self.assertEqual(one['revision'],two['revision']);self.assertEqual(db.get(User,1).jera,123)
 def test_shelves_reject_foreign_unsealed_and_more_than_five(self):
  with self.sessions.begin() as db:
   own=self.slot(db);foreign=self.slot(db,uid=2);open_companion(db,1,'a'*32,now=self.now)
   for values in [[foreign],['missing'],[own]*6,[own,own],[{}]]:
    with self.assertRaises(YaabikError):apply_actions(db,1,[{'id':'b'*32,'kind':'shelf','value':values}],self.now)
   value=apply_actions(db,1,[{'id':'c'*32,'kind':'shelf','value':[own]}],self.now);self.assertEqual(value['shelf_ids'],[own])
 def test_favorite_is_learned_only_from_own_displayed_discs(self):
  with self.sessions.begin() as db:
   own=self.slot(db);open_companion(db,1,'a'*32,{'shelf_ids':[own]},self.now)
   value=apply_actions(db,1,[{'id':'b'*32,'kind':'disc','value':own},{'id':'c'*32,'kind':'pet'}],self.now)
   self.assertEqual(value['favorite_disc'],'minecraft');self.assertEqual(value['habits']['pets'],1)
   value=apply_actions(db,1,[{'id':'d'*32,'kind':'shelf','value':[]}],self.now);self.assertIsNone(value['favorite_disc'])
 def test_empty_battery_autodocks_and_actions_never_spend_below_zero(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,{'battery':{'level':.5}},self.now)
   value=apply_actions(db,1,[{'id':'b'*32,'kind':'play'},{'id':'c'*32,'kind':'play'},{'id':'d'*32,'kind':'dock','value':False}],self.now)
   self.assertEqual(value['battery']['level'],0);self.assertTrue(value['battery']['docked']);self.assertEqual(value['habits']['games'],1)
 def test_fields_merge_across_devices_and_private_data_do_not_leak(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,now=self.now);apply_actions(db,1,[{'id':'b'*32,'kind':'prefs','value':{'skin':'mint'}}],self.now)
   value=apply_actions(db,1,[{'id':'c'*32,'kind':'prefs','value':{'room':'night','sounds':False}}],self.now)
   self.assertEqual(value['prefs'],{'skin':'mint','room':'night','sounds':False})
   other=open_companion(db,2,'a'*32,now=self.now);self.assertEqual(other['prefs']['skin'],'classic');self.assertEqual(other['habits']['visits'],1)
 def test_return_gap_and_visits_use_server_time(self):
  with self.sessions.begin() as db:
   open_companion(db,1,'a'*32,now=self.now);value=open_companion(db,1,'b'*32,now=self.now+timedelta(days=2))
   self.assertEqual(value['away_ms'],172800000);self.assertEqual(value['habits']['visits'],2)
 def test_router_validation_and_rollback_use_test_database_only(self):
  from fastapi import HTTPException
  from pydantic import ValidationError
  from yaabik_api import make_yaabik_router,OpenIn,ActionsIn
  router=make_yaabik_router(lambda:None,lambda:None)
  opening=next(r.endpoint for r in router.routes if r.path=='/api/yaabik/open')
  action=next(r.endpoint for r in router.routes if r.path=='/api/yaabik/actions')
  with self.sessions() as db:
   user=db.get(User,1);self.assertEqual(opening(OpenIn(request_id='a'*32),user,db)['battery']['level'],65)
   with self.assertRaises(ValidationError):ActionsIn(commands=[{'id':'b'*32,'kind':'balance','value':10000}])
   with self.assertRaises(HTTPException) as error:action(ActionsIn(commands=[{'id':'b'*32,'kind':'prefs','value':{'skin':'mint'}},{'id':'c'*32,'kind':'prefs','value':{'skin':'oops'}}]),user,db)
   self.assertEqual(error.exception.status_code,409)
   self.assertEqual(opening(OpenIn(request_id='d'*32),user,db)['prefs']['skin'],'classic')
