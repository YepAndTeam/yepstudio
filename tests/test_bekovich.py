import os
os.environ['DATABASE_URL']='sqlite:///:memory:'
import json,unittest
from datetime import datetime,timedelta
from uuid import uuid4
from unittest.mock import patch
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,JeraTx,Meta
import garden_models
import race_models
from disc_models import DiscInstance,DiscTrade,DiscTradeItem,DiscShelfSlot
from disc_equipment import create_instance
from score_service import initialize_score_state
from bekovich_models import BekovichOffer,BekovichDeal,BekovichItem,StudioBadge
from bekovich_service import quote,accept,state,item_action,credits,consume_open,consume_ticket,BekovichError

class BekovichTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add_all([User(id=1,first_name='One',jera=500),User(id=2,first_name='Two',jera=500)])
 def tearDown(self):self.engine.dispose()
 def disc(self,db,rarity='rare',uid=1,game='minecraft'):
  row=create_instance(db,uid,game,rarity,uuid4().hex);db.flush();return row
 def offer(self,db,kind='coins',**payload):
  discs=[self.disc(db),self.disc(db)];q=quote(db,1,[d.id for d in discs]);row=db.get(BekovichOffer,q['id']);row.refused=False;row.chest='reserve';row.reward_json=json.dumps(dict(kind=kind,**payload));db.flush();return q,[d.id for d in discs]
 def test_quote_has_no_reward_and_identical_copies_do_not_reroll(self):
  with self.sessions.begin() as db:
   one=self.disc(db,'common');q=quote(db,1,[one.id]);two=self.disc(db,'common')
   with patch('bekovich_service.roll_reward',side_effect=AssertionError('reroll')):again=quote(db,1,[two.id])
   self.assertEqual(q['id'],again['id']);self.assertTrue(again['reused']);self.assertNotIn('kind',q);self.assertNotIn('reward',q);self.assertEqual(one.status,'ready')
 def test_coin_accept_is_atomic_and_retry_safe(self):
  with self.sessions.begin() as db:
   q,ids=self.offer(db,amount=50);request=uuid4().hex
   result=accept(db,1,q['id'],ids,request);again=accept(db,1,q['id'],ids,request)
   self.assertEqual(result['entry']['id'],again['entry']['id']);self.assertEqual(again['balance'],550)
   self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
   self.assertTrue(all(db.get(DiscInstance,i).status=='traded' for i in ids));self.assertFalse(state(db,1)['inventory'])
   with self.assertRaises(BekovichError):accept(db,1,q['id'],ids,uuid4().hex)
   with self.assertRaises(BekovichError):accept(db,2,q['id'],ids,uuid4().hex)
 def test_rollback_restores_discs_and_does_not_issue_item(self):
  with self.sessions.begin() as db:q,ids=self.offer(db,amount=20)
  with self.assertRaises(RuntimeError):
   with self.sessions.begin() as db:
    with patch('bekovich_service.grant_reward',side_effect=RuntimeError('failure')):accept(db,1,q['id'],ids,uuid4().hex)
  with self.sessions() as db:
   self.assertTrue(all(db.get(DiscInstance,i).status=='ready' for i in ids));self.assertEqual(db.scalar(select(func.count()).select_from(BekovichDeal)),0);self.assertEqual(db.get(User,1).jera,500)
 def test_busy_foreign_used_and_sealed_discs_are_rejected(self):
  with self.sessions.begin() as db:
   foreign=self.disc(db,uid=2);active=self.disc(db);active.status='active';sealed=self.disc(db);sealed.status='sealed';cracked=self.disc(db);cracked.status='cracked'
   for row in [foreign,active,sealed,cracked]:
    with self.assertRaises(BekovichError):quote(db,1,[row.id])
   fresh=self.disc(db);trade=DiscTrade(id=uuid4().hex,sender_id=1,recipient_id=2,request_id=uuid4().hex,status='pending',expires_at=datetime.utcnow()+timedelta(hours=1));db.add(trade);db.flush();db.add(DiscTradeItem(trade_id=trade.id,instance_id=fresh.id,offered_by=1));db.flush()
   with self.assertRaises(BekovichError):quote(db,1,[fresh.id])
 def test_quote_revalidates_ownership_and_content_at_accept(self):
  with self.sessions.begin() as db:
   q,ids=self.offer(db,amount=5);db.get(DiscInstance,ids[0]).user_id=2;db.flush()
   with self.assertRaises(BekovichError):accept(db,1,q['id'],ids,uuid4().hex)
 def test_usb_is_hidden_until_read_and_credits_only_once(self):
  for target in ['dvd','themes']:
   with self.sessions.begin() as db:
    q,ids=self.offer(db,'usb',usb={'player':target,'opens':10});result=accept(db,1,q['id'],ids,uuid4().hex);identity=result['entry']['id'];self.assertNotIn('usb',result['entry'])
    read=item_action(db,1,identity,'read');self.assertEqual(read['entry']['usb']['opens'],10)
    item_action(db,1,identity,'read');self.assertEqual(credits(db,1)[target],10)
    with self.assertRaises(BekovichError):item_action(db,2,identity,'read')
    self.assertTrue(consume_open(db,1,target));self.assertEqual(credits(db,1)[target],9)
 def test_epic_seed_is_in_garden_and_not_duplicated(self):
  from garden_models import GardenState
  with self.sessions.begin() as db:
   q,ids=self.offer(db,'epic_seed',seed='aurora',amount=1);key=uuid4().hex;accept(db,1,q['id'],ids,key);accept(db,1,q['id'],ids,key)
   self.assertEqual(json.loads(db.get(GardenState,1).data_json)['seeds']['aurora'],1)
 def test_badge_is_owned_unique_and_equips(self):
  from bekovich_rules import roll_badge
  with self.sessions.begin() as db:
   q,ids=self.offer(db,'badge',badge=roll_badge());result=accept(db,1,q['id'],ids,uuid4().hex);identity=result['entry']['id'];badge=result['entry']['badge']
   item_action(db,1,identity,'wear');self.assertEqual(state(db,1)['worn']['item_id'],identity)
   q,ids=self.offer(db,'badge',badge=badge);accept(db,1,q['id'],ids,uuid4().hex)
   self.assertEqual(db.scalar(select(func.count(func.distinct(StudioBadge.name_key)))),2)

 def test_same_title_cannot_be_issued_to_another_player_in_another_finish(self):
  from bekovich_rules import roll_badge
  with self.sessions.begin() as db:
   q,ids=self.offer(db,'badge',badge=roll_badge());first=accept(db,1,q['id'],ids,uuid4().hex)['entry']['badge']
   rows=[self.disc(db,uid=2),self.disc(db,uid=2)];q=quote(db,2,[r.id for r in rows]);offer=db.get(BekovichOffer,q['id'])
   duplicate=dict(first,frame='#000',finish='night',prefix=first['prefix'].upper(),title=first['title'].upper())
   offer.refused=False;offer.reward_json=json.dumps({'kind':'badge','badge':duplicate});db.flush()
   result=accept(db,2,offer.id,[r.id for r in rows],uuid4().hex)['entry']['badge']
   self.assertNotEqual((first['prefix']+' '+first['title']).casefold(),(result['prefix']+' '+result['title']).casefold())
   self.assertEqual(db.scalar(select(func.count(func.distinct(StudioBadge.name_key)))),2)
 def test_coupon_only_consumes_once(self):
  with self.sessions.begin() as db:
   q,ids=self.offer(db,'ticket');accept(db,1,q['id'],ids,uuid4().hex)
   self.assertTrue(consume_ticket(db,1,'event'));self.assertFalse(consume_ticket(db,1,'other'))
 def test_refusal_cannot_be_accepted(self):
  with self.sessions.begin() as db:
   q,ids=self.offer(db,amount=5);db.get(BekovichOffer,q['id']).refused=True;db.flush()
   with self.assertRaises(BekovichError):accept(db,1,q['id'],ids,uuid4().hex)

 def test_dvd_and_theme_usb_pay_for_actual_player_without_jera(self):
  from disc_service import open_disc,reveal_disc
  from shop_service import buy_box,unlock_box
  with self.sessions.begin() as db:
   q,ids=self.offer(db,'usb',usb={'player':'dvd','opens':1});result=accept(db,1,q['id'],ids,uuid4().hex);item_action(db,1,result['entry']['id'],'read')
   key=uuid4().hex;opened=open_disc(db,1,key);self.assertEqual(opened['draw']['price'],0);self.assertEqual(opened['balance'],500)
   self.assertEqual(open_disc(db,1,key)['draw']['id'],opened['draw']['id']);self.assertEqual(credits(db,1)['dvd'],0);reveal_disc(db,1,opened['draw']['id'])
   self.assertEqual(open_disc(db,1,uuid4().hex)['balance'],450)
   q,ids=self.offer(db,'usb',usb={'player':'themes','opens':1});result=accept(db,1,q['id'],ids,uuid4().hex);item_action(db,1,result['entry']['id'],'read')
   box=buy_box(db,1,uuid4().hex);self.assertEqual(box['price'],0);self.assertEqual(box['balance'],450);self.assertEqual(credits(db,1)['themes'],0)
   unlock_box(db,1,box['box_id'],box['runes']);self.assertEqual(db.get(User,1).jera,450)

 def test_paid_tournament_uses_coupon_and_cancellation_does_not_mint_refund(self):
  from tournament_service import create_event,register,cancel_event
  from database import Tournament
  with self.sessions.begin() as db:
   first=create_event(db,'First');first.status='finished';first.settled_at=datetime.utcnow();db.flush();event=create_event(db,'Paid','dino',24,50)
   q,ids=self.offer(db,'ticket');result=accept(db,1,q['id'],ids,uuid4().hex)
   entry=register(db,event.id,1);self.assertEqual(entry.paid,0);self.assertEqual(db.get(User,1).jera,500);self.assertIsNotNone(db.get(BekovichItem,result['entry']['id']).consumed_at)
   register(db,event.id,1);cancel_event(db,event.id);self.assertEqual(db.get(User,1).jera,500)
   self.assertIsNone(db.get(BekovichItem,result['entry']['id']).consumed_at)

if __name__=='__main__':unittest.main()
