"""Permanent rarity sets: ownership, sealing and reward share one transaction."""
import json
from datetime import datetime
from sqlalchemy import select
from disc_models import DiscShelfSlot,DiscShelfReward,DiscInstance,DiscEquipment,DiscTrade,DiscTradeItem,DiscListing
from disc_equipment import EquipmentError,ensure_inventory,settle_expired,instance_view,iso
from score_service import lock_scores
from database import Meta
REWARD=1000

def shelf_state(db,uid):
 from disc_service import CATALOG,balance
 slots=db.execute(select(DiscShelfSlot,DiscInstance).join(DiscInstance,DiscInstance.id==DiscShelfSlot.instance_id).where(DiscShelfSlot.user_id==uid)).all()
 rewards=set(db.scalars(select(DiscShelfReward.disc_id).where(DiscShelfReward.user_id==uid)))
 return {'reward':REWARD,'balance':balance(db,uid),'rarities':[{k:v for k,v in r.items() if k!='weight'} for r in CATALOG['rarities']],
  'shelves':[{'item':item,'rewarded':item['id'] in rewards,'secret_gift':'locked','slots':[{**instance_view(row),'cracked':slot.was_cracked,'sealed_at':iso(slot.sealed_at)} for slot,row in slots if slot.disc_id==item['id']]} for item in CATALOG['discs']]}

def seal_disc(db,uid,identity,now=None):
 from disc_service import RARITIES
 from weekly import grant
 now=now or datetime.utcnow();lock_scores(db);ensure_inventory(db,uid);settle_expired(db,uid,now)
 if db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise EquipmentError(503,'Идёт обновление. Попробуй позже.')
 row=db.get(DiscInstance,identity,populate_existing=True)
 if not row or row.user_id!=uid:raise EquipmentError(404,'Этот диск тебе не принадлежит')
 key=(uid,row.disc_id,row.rarity);slot=db.get(DiscShelfSlot,key)
 if slot:
  if slot.instance_id==identity:return shelf_state(db,uid)
  raise EquipmentError(409,'Ячейка этой редкости уже заполнена')
 if row.status not in ('ready','active','cracked'):raise EquipmentError(409,'Этот диск нельзя отправить на полку')
 equipped=db.get(DiscEquipment,uid)
 if equipped and equipped.instance_id==identity:raise EquipmentError(409,'Сначала сними диск с аватарки')
 pending=db.scalar(select(DiscTradeItem.instance_id).join(DiscTrade,DiscTrade.id==DiscTradeItem.trade_id).where(DiscTradeItem.instance_id==identity,DiscTrade.status=='pending',DiscTrade.expires_at>now).limit(1))
 listings=db.scalars(select(DiscListing).where(DiscListing.user_id==uid,DiscListing.status=='open',DiscListing.expires_at>now)).all()
 if pending or any(identity in json.loads(l.offered_json) for l in listings):raise EquipmentError(409,'Сначала закрой обмен или объявление с этим диском')
 was_cracked=row.status=='cracked';row.status='sealed';db.add(DiscShelfSlot(user_id=uid,disc_id=row.disc_id,rarity=row.rarity,instance_id=row.id,sealed_at=now,was_cracked=was_cracked));db.flush()
 collected=set(db.scalars(select(DiscShelfSlot.rarity).where(DiscShelfSlot.user_id==uid,DiscShelfSlot.disc_id==row.disc_id)))
 if set(RARITIES).issubset(collected) and not db.get(DiscShelfReward,(uid,row.disc_id)):
  db.add(DiscShelfReward(user_id=uid,disc_id=row.disc_id,created_at=now));grant(db,uid,REWARD,'disc:shelf:'+row.disc_id,now);db.flush()
 return shelf_state(db,uid)
