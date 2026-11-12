# coding: utf-8
import json
from collections import Counter
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import select,func
from database import User,Notification
from disc_models import DiscListing,DiscListingReply,DiscTrade,DiscTradeItem,DiscInstance,DiscTradeNotice
from disc_equipment import EquipmentError,ensure_inventory,instance_view
from score_service import lock_scores
RARITIES={'common','rare','epic','mythic','legendary','secret'}

def listing_view(db,row,reply_counts=None):
 ids=json.loads(row.offered_json);discs=db.scalars(select(DiscInstance).where(DiscInstance.id.in_(ids))).all()
 count=reply_counts if reply_counts is not None else db.scalar(select(func.count()).select_from(DiscListingReply).where(DiscListingReply.listing_id==row.id))
 return {'id':row.id,'user_id':row.user_id,'name':db.get(User,row.user_id).first_name,'offered':[instance_view(d) for d in discs],'wanted':json.loads(row.wanted_json),'status':'expired' if row.status=='open' and row.expires_at<=datetime.utcnow() else row.status,'created_at':row.created_at.isoformat()+'Z','expires_at':row.expires_at.isoformat()+'Z','reply_count':count}

def market_state(db,uid):
 now=datetime.utcnow()
 rows=db.scalars(select(DiscListing).where(((DiscListing.status=='open')&(DiscListing.expires_at>now))|(DiscListing.user_id==uid)).order_by(DiscListing.created_at.desc()).limit(60)).all()
 if not rows:return {'listings':[]}
 listing_ids=[r.id for r in rows];disc_ids={identity for r in rows for identity in json.loads(r.offered_json)}
 names=dict(db.execute(select(User.id,User.first_name).where(User.id.in_({r.user_id for r in rows}))).all())
 discs={d.id:instance_view(d) for d in db.scalars(select(DiscInstance).where(DiscInstance.id.in_(disc_ids)))}
 counts=dict(db.execute(select(DiscListingReply.listing_id,func.count()).where(DiscListingReply.listing_id.in_(listing_ids)).group_by(DiscListingReply.listing_id)).all())
 return {'listings':[{'id':r.id,'user_id':r.user_id,'name':names[r.user_id],'offered':[discs[i] for i in json.loads(r.offered_json) if i in discs],'wanted':json.loads(r.wanted_json),'status':'expired' if r.status=='open' and r.expires_at<=now else r.status,'created_at':r.created_at.isoformat()+'Z','expires_at':r.expires_at.isoformat()+'Z','reply_count':counts.get(r.id,0)} for r in rows]}

def publish_listing(db,uid,offered,wanted,request_id,now=None):
 now=now or datetime.utcnow();lock_scores(db);ensure_inventory(db,uid)
 if not offered or len(offered)>5 or len(set(offered))!=len(offered):raise EquipmentError(422,'Выбери от 1 до 5 разных дисков')
 if not wanted or any(k not in RARITIES or not isinstance(v,int) or isinstance(v,bool) or v<1 or v>5 for k,v in wanted.items()) or sum(wanted.values())>5:raise EquipmentError(422,'Укажи от 1 до 5 нужных дисков по редкости')
 previous=db.scalar(select(DiscListing).where(DiscListing.user_id==uid,DiscListing.request_id==request_id))
 if previous:
  if set(json.loads(previous.offered_json))!=set(offered) or json.loads(previous.wanted_json)!=wanted:raise EquipmentError(409,'Этот номер объявления уже использован')
  return listing_view(db,previous)
 for identity in offered:
  disc=db.get(DiscInstance,identity)
  if not disc or disc.user_id!=uid or disc.status!='ready':raise EquipmentError(409,'Объявить можно только свои неактивированные диски')
 if db.scalar(select(func.count()).select_from(DiscListing).where(DiscListing.user_id==uid,DiscListing.status=='open',DiscListing.expires_at>now))>=10:raise EquipmentError(409,'У тебя уже 10 открытых объявлений')
 row=DiscListing(id=uuid4().hex,user_id=uid,request_id=request_id,offered_json=json.dumps(offered),wanted_json=json.dumps(wanted),status='open',created_at=now,expires_at=now+timedelta(days=3));db.add(row);db.flush();return listing_view(db,row)

def validate_listing_reply(db,uid,target,offered,wanted,listing_id,now):
 listing=db.get(DiscListing,listing_id)
 if not listing or listing.status!='open' or listing.expires_at<=now:raise EquipmentError(409,'Объявление уже закрыто')
 if listing.user_id!=target or uid==target:raise EquipmentError(403,'Нельзя откликнуться на своё или чужое подменённое объявление')
 if set(json.loads(listing.offered_json))!=set(wanted):raise EquipmentError(422,'Предметы объявления изменены')
 counts=Counter()
 for identity in offered:
  disc=db.get(DiscInstance,identity)
  if not disc or disc.user_id!=uid or disc.status!='ready':raise EquipmentError(409,'Выбранный диск недоступен')
  counts[disc.rarity]+=1
 if dict(counts)!=json.loads(listing.wanted_json):raise EquipmentError(422,'Набор дисков не соответствует запросу объявления')
 return listing

def reply_listing(db,uid,listing_id,offered,request_id,now=None):
 from community_service import create_trade,trade_view
 now=now or datetime.utcnow();lock_scores(db);listing=db.get(DiscListing,listing_id)
 if not listing:raise EquipmentError(404,'Объявление не найдено')
 wanted=json.loads(listing.offered_json)
 previous=db.scalar(select(DiscTrade).where(DiscTrade.sender_id==uid,DiscTrade.request_id==request_id))
 if previous:
  link=db.get(DiscListingReply,previous.id)
  if not link or link.listing_id!=listing_id:raise EquipmentError(409,'Номер отклика уже использован')
  previous_ids=set(db.scalars(select(DiscTradeItem.instance_id).where(DiscTradeItem.trade_id==previous.id,DiscTradeItem.offered_by==uid)))
  if previous_ids!=set(offered):raise EquipmentError(409,'Набор отклика уже изменён')
  return trade_view(db,previous)
 result=create_trade(db,uid,listing.user_id,offered,wanted,request_id,now,listing_id=listing_id)
 db.add(DiscListingReply(trade_id=result['id'],listing_id=listing_id,responder_id=uid,created_at=now))
 db.add(DiscTradeNotice(trade_id=result['id'],user_id=listing.user_id,status='queued',created_at=now))
 db.add(Notification(user_id=listing.user_id,kind='trade',text=(db.get(User,uid).first_name+' откликнулся на объявление об обмене дисками')[:300],ref='community_trading'))
 db.flush();result['listing_id']=listing_id;result['_notify_trade_id']=result['id'];return result

def close_listing(db,uid,identity):
 lock_scores(db);row=db.get(DiscListing,identity)
 if not row or row.user_id!=uid:raise EquipmentError(404,'Объявление не найдено')
 if row.status=='open':row.status='closed'
 db.flush();return listing_view(db,row)

def claim_notice(db,identity):
 lock_scores(db);notice=db.get(DiscTradeNotice,identity)
 if not notice or notice.status!='queued':return None
 user=db.get(User,notice.user_id)
 if not user or not user.notify:notice.status='skipped';return None
 notice.status='sending'
 trade=db.get(DiscTrade,identity);sender=db.get(User,trade.sender_id)
 return notice.user_id,sender.first_name+' откликнулся на твоё объявление об обмене дисками. Посмотри предложение в сообществе.'
