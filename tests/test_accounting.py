import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import unittest
from datetime import datetime,timedelta
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx,ThemeBoxPurchase
from accounting_service import economy_report
class AccountingTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine)
  self.now=datetime(2026,11,11,20)
  with self.sessions.begin() as db:
   db.add_all([User(id=1,first_name='Player',jera=0),User(id=2,first_name='Admin',role='admin',jera=10000)])
   db.flush()
   entries=[(1,100,'reset:v2:dino'),(1,25,'daily:2026-11-11'),(1,-100,'shop:buy:box'),(1,25,'shop:refund:box'),(1,-50,'tour:entry:cup'),(2,10000,'admin:test:uuid')]
   for uid,amount,reason in entries:db.add(JeraTx(user_id=uid,amount=amount,reason=reason,created_at=self.now))
   db.add(ThemeBoxPurchase(id='box',user_id=1,request_id='req',runes='abc',theme_id='retro',price=100,status='won',is_dupe=True,refund=25,purchased_at=self.now,resolved_at=self.now))
 def tearDown(self):self.engine.dispose()
 def test_flows_exclude_admins_and_separate_refunds(self):
  with self.sessions() as db:
   report=economy_report(db,7,False,self.now)
   self.assertEqual(report['flow']['inflow'],150);self.assertEqual(report['flow']['outflow'],150)
   self.assertEqual(report['flow']['refunds'],25);self.assertEqual(report['flow']['issued_excluding_refunds'],125)
   self.assertEqual(report['flow']['admin_test_issued'],10000)
   self.assertEqual(report['wallets']['players'],1);self.assertEqual(report['wallets']['unexplained_difference'],0)
   self.assertEqual(report['boxes']['duplicates'],1);self.assertEqual(report['boxes']['net_sink'],75)
 def test_admin_toggle_changes_balances_and_period_totals(self):
  with self.sessions() as db:
   report=economy_report(db,0,True,self.now)
   self.assertEqual(report['wallets']['total'],10000)
   self.assertEqual(report['flow']['net'],10000)
   self.assertEqual(len(report['daily']),90)
 def test_kazakhstan_day_and_period_filter(self):
  with self.sessions.begin() as db:
   db.add(JeraTx(user_id=1,amount=7,reason='daily:old',created_at=self.now-timedelta(days=20)))
  with self.sessions() as db:
   report=economy_report(db,7,False,self.now)
   self.assertEqual(report['daily'][-1]['day'],'2026-11-12')
   self.assertEqual(report['daily'][-1]['inflow'],150)
   self.assertEqual(report['flow']['inflow'],150)
   self.assertEqual(report['wallets']['unexplained_difference'],-7)
 def test_report_does_not_write_or_settle_anything(self):
  statements=[]
  from sqlalchemy import event
  event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:statements.append(statement))
  with self.sessions() as db:economy_report(db,30,False,self.now)
  self.assertTrue(statements)
  self.assertTrue(all(s.lstrip().upper().startswith(('SELECT','PRAGMA')) for s in statements))
 def test_empty_report(self):
  with self.sessions.begin() as db:db.query(JeraTx).delete();db.query(ThemeBoxPurchase).delete();db.query(User).delete()
  with self.sessions() as db:
   report=economy_report(db,7,False,self.now)
   self.assertEqual(report['flow']['transactions'],0);self.assertEqual(report['wallets']['total'],0)
   self.assertEqual(len(report['daily']),7)
