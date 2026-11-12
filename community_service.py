# coding: utf-8
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import select,or_,func
from database import User,Meta
from disc_models import StudioChatMessage,DiscTrade,DiscTradeItem,DiscInstance
from disc_equipment import ensure_inventory,instance_view,EquipmentError
from score_service import lock_scores
from social_models import Friendship

def require_friend(db,uid,target):
 if uid==target:raise EquipmentError(422,'Выбери другого игрока')
 relation=db.get(Friendship,tuple(sorted((uid,target))))
 if not relation or relation.status!='accepted':raise EquipmentError(403,'Обмен доступен между принятыми друзьями')

def chat_state(db):
 rows=db.execute(select(StudioChatMessage,User).join(User,User.id==StudioChatMessage.user_id).where(StudioChatMessage.deleted.is_(False)).order_by(StudioChatMessage.id.desc()).limit(60)).all()
 return {'messages':[{'id':m.id,'user_id':m.user_id,'name':u.first_name,'body':m.body,'created_at':m.created_at.isoformat()+'Z'} for m,u in reversed(rows)],'server_now':datetime.utcnow().isoformat()+'Z'}

def post_chat(db,uid,body,now=None):
 now=now or datetime.utcnow();body=body.strip()
 if not body or len(body)>800:raise EquipmentError(422,'Сообщение должно содержать от 1 до 800 символов')
 lock_scores(db);key='studio-chat:'+str(uid);last=db.get(Meta,key)
 if last and (now-datetime.fromisoformat(last.value)).total_seconds()<3:raise EquipmentError(429,'Между сообщениями нужно подождать 3 секунды')
 db.merge(Meta(key=key,value=now.isoformat()));db.add(StudioChatMessage(user_id=uid,body=body,created_at=now));db.flush()
 return chat_state(db)

def remove_chat(db,uid,identity):
 lock_scores(db);row=db.get(StudioChatMessage,identity);user=db.get(User,uid)
 if not row:raise EquipmentError(404,'Сообщение не найдено')
 if row.user_id!=uid and user.role not in ('admin','moderator'):raise EquipmentError(403,'Нельзя удалить чужое сообщение')
 row.deleted=True;db.flush();return chat_state(db)

def trade_inventory(db,uid,target):
 require_friend(db,uid,target);ensure_inventory(db,target)
 rows=db.scalars(select(DiscInstance).where(DiscInstance.user_id==target,DiscInstance.status=='ready').order_by(DiscInstance.created_at.desc()).limit(300)).all()
 return {'user':{'id':target,'name':db.get(User,target).first_name},'instances':[instance_view(row) for row in rows]}

def trade_view(db,row):
 from disc_models import DiscListingReply
 link=db.get(DiscListingReply,row.id)
 items=db.execute(select(DiscTradeItem,DiscInstance).join(DiscInstance,DiscInstance.id==DiscTradeItem.instance_id).where(DiscTradeItem.trade_id==row.id)).all()
 names={uid:db.get(User,uid).first_name for uid in (row.sender_id,row.recipient_id)}
 status='expired' if row.status=='pending' and row.expires_at<=datetime.utcnow() else row.status
 return {'listing_id':link.listing_id if link else None,'id':row.id,'sender_id':row.sender_id,'recipient_id':row.recipient_id,'sender_name':names[row.sender_id],'recipient_name':names[row.recipient_id],'status':status,'created_at':row.created_at.isoformat()+'Z','expires_at':row.expires_at.isoformat()+'Z','items':[dict(instance_view(disc),offered_by=item.offered_by) for item,disc in items]}

def trades_state(db,uid):
 rows=db.scalars(select(DiscTrade).where(or_(DiscTrade.sender_id==uid,DiscTrade.recipient_id==uid)).order_by(DiscTrade.created_at.desc()).limit(40)).all()
 if not rows:return {'trades':[]}
 ids=[row.id for row in rows];users={uid for row in rows for uid in (row.sender_id,row.recipient_id)}
 names=dict(db.execute(select(User.id,User.first_name).where(User.id.in_(users))).all());items={key:[] for key in ids}
 for item,disc in db.execute(select(DiscTradeItem,DiscInstance).join(DiscInstance,DiscInstance.id==DiscTradeItem.instance_id).where(DiscTradeItem.trade_id.in_(ids))):items[item.trade_id].append(dict(instance_view(disc),offered_by=item.offered_by))
 from disc_models import DiscListingReply
 links={link.trade_id:link.listing_id for link in db.scalars(select(DiscListingReply).where(DiscListingReply.trade_id.in_(ids)))}
 now=datetime.utcnow()
 return {'trades':[{'listing_id':links.get(row.id),'id':row.id,'sender_id':row.sender_id,'recipient_id':row.recipient_id,'sender_name':names[row.sender_id],'recipient_name':names[row.recipient_id],'status':'expired' if row.status=='pending' and row.expires_at<=now else row.status,'created_at':row.created_at.isoformat()+'Z','expires_at':row.expires_at.isoformat()+'Z','items':items[row.id]} for row in rows]}

def create_trade(db,uid,target,offered,wanted,request_id,now=None,listing_id=None):
 now=now or datetime.utcnow();lock_scores(db)
 if listing_id:
  from disc_market import validate_listing_reply
  validate_listing_reply(db,uid,target,offered,wanted,listing_id,now)
 else:require_friend(db,uid,target)
 previous=db.scalar(select(DiscTrade).where(DiscTrade.sender_id==uid,DiscTrade.request_id==request_id))
 if previous:
  old_items=db.scalars(select(DiscTradeItem).where(DiscTradeItem.trade_id==previous.id)).all()
  if previous.recipient_id!=target or {r.instance_id for r in old_items if r.offered_by==uid}!=set(offered) or {r.instance_id for r in old_items if r.offered_by==target}!=set(wanted):raise EquipmentError(409,'Этот номер предложения уже использован')
  return trade_view(db,previous)
 if not 1<=len(offered)<=5 or not 1<=len(wanted)<=5 or len(set(offered+wanted))!=len(offered+wanted):raise EquipmentError(422,'Выбери от 1 до 5 разных дисков с каждой стороны')
 ensure_inventory(db,uid);ensure_inventory(db,target)
 pending=db.scalar(select(func.count()).select_from(DiscTrade).where(DiscTrade.sender_id==uid,DiscTrade.status=='pending',DiscTrade.expires_at>now))
 if pending>=10:raise EquipmentError(409,'У тебя уже 10 активных предложений')
 for owner,identities in ((uid,offered),(target,wanted)):
  for identity in identities:
   disc=db.get(DiscInstance,identity)
   if not disc or disc.user_id!=owner or disc.status!='ready':raise EquipmentError(409,'Для обмена подходят только неактивированные рабочие диски владельца')
 row=DiscTrade(id=uuid4().hex,sender_id=uid,recipient_id=target,request_id=request_id,status='pending',created_at=now,expires_at=now+timedelta(hours=24));db.add(row);db.flush()
 for owner,identities in ((uid,offered),(target,wanted)):
  for identity in identities:db.add(DiscTradeItem(trade_id=row.id,instance_id=identity,offered_by=owner))
 db.flush();return trade_view(db,row)

def resolve_trade(db,uid,identity,action,now=None):
 now=now or datetime.utcnow();lock_scores(db);row=db.get(DiscTrade,identity)
 if not row or uid not in (row.sender_id,row.recipient_id):raise EquipmentError(404,'Предложение не найдено')
 if action not in ('accept','decline','cancel'):raise EquipmentError(422,'Неизвестное действие')
 if action=='cancel' and uid!=row.sender_id:raise EquipmentError(403,'Отменить предложение может отправитель')
 if action in ('accept','decline') and uid!=row.recipient_id:raise EquipmentError(403,'Подтвердить обмен может только получатель')
 if row.status!='pending':return trade_view(db,row)
 if row.expires_at<=now:row.status='expired';row.resolved_at=now;db.flush();return trade_view(db,row)
 if action=='accept':
  from disc_models import DiscListingReply,DiscListing
  link=db.get(DiscListingReply,row.id)
  if link:
   listing=db.get(DiscListing,link.listing_id)
   if not listing or listing.status!='open' or listing.expires_at<=now:
    row.status='invalid';row.resolved_at=now;db.flush();return trade_view(db,row)
  else:require_friend(db,row.sender_id,row.recipient_id)
  items=db.scalars(select(DiscTradeItem).where(DiscTradeItem.trade_id==identity)).all()
  discs=[]
  for item in items:
   disc=db.get(DiscInstance,item.instance_id)
   if not disc or disc.user_id!=item.offered_by or disc.status!='ready':
    row.status='invalid';row.resolved_at=now;db.flush();return trade_view(db,row)
   discs.append((disc,item.offered_by))
  for disc,owner in discs:disc.user_id=row.recipient_id if owner==row.sender_id else row.sender_id
  row.status='accepted'
  if link:
   listing.status='completed'
   others=db.scalars(select(DiscTrade).join(DiscListingReply,DiscListingReply.trade_id==DiscTrade.id).where(DiscListingReply.listing_id==link.listing_id,DiscTrade.id!=row.id,DiscTrade.status=='pending')).all()
   for other in others:other.status='invalid';other.resolved_at=now
 else:row.status='declined' if action=='decline' else 'cancelled'
 row.resolved_at=now;db.flush();return trade_view(db,row)
