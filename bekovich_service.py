"""Transactions use the same database lock as disc trades, shelving and payouts."""
import json,secrets
from datetime import datetime
from uuid import UUID,uuid4
from sqlalchemy import select,update,or_,and_
from database import User,Meta,JeraTx
from disc_models import DiscInstance,DiscTrade,DiscTradeItem,DiscListing
from score_service import lock_scores
from bekovich_models import BekovichOffer,BekovichDeal,BekovichItem,StudioBadge,BekovichWallet
from bekovich_rules import assess,roll_reward,roll_badge

class BekovichError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

def available(db):
 if db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise BekovichError(503,'Идёт обслуживание экономики. Загляни немного позже.')

def wallet(db,uid):
 row=db.get(BekovichWallet,uid)
 if row is None:row=BekovichWallet(user_id=uid,dvd_opens=0,theme_opens=0);db.add(row);db.flush()
 return row

def credits(db,uid):
 row=db.get(BekovichWallet,uid)
 return {'dvd':row.dvd_opens if row else 0,'themes':row.theme_opens if row else 0}

def consume_open(db,uid,player):
 row=db.get(BekovichWallet,uid)
 field='dvd_opens' if player=='dvd' else 'theme_opens'
 if not row or getattr(row,field)<=0:return False
 setattr(row,field,getattr(row,field)-1);db.flush();return True

def equipped_badge(db,uid):
 row=db.get(BekovichWallet,uid)
 badge=db.get(StudioBadge,row.badge_id) if row and row.badge_id else None
 return dict(json.loads(badge.data_json),item_id=badge.id) if badge and badge.user_id==uid else None

def public_badges(db,ids):
 ids=list(dict.fromkeys(ids))
 if len(ids)>100 or any(not isinstance(uid,int) or uid<=0 for uid in ids):raise BekovichError(422,'Нужно до 100 корректных ID игроков')
 result={str(uid):None for uid in ids}
 if ids:
  rows=db.execute(select(BekovichWallet.user_id,StudioBadge.id,StudioBadge.data_json).join(StudioBadge,StudioBadge.id==BekovichWallet.badge_id).where(BekovichWallet.user_id.in_(ids),StudioBadge.user_id==BekovichWallet.user_id)).all()
  for uid,identity,data in rows:result[str(uid)]=dict(json.loads(data),item_id=identity)
 return {'badges':result}

def blocked_discs(db,uid,now):
 blocked=set(db.scalars(select(DiscTradeItem.instance_id).join(DiscTrade,DiscTrade.id==DiscTradeItem.trade_id).where(DiscTradeItem.offered_by==uid,DiscTrade.status=='pending',DiscTrade.expires_at>now)))
 for listing in db.scalars(select(DiscListing).where(DiscListing.user_id==uid,DiscListing.status=='open',DiscListing.expires_at>now)):
  blocked.update(json.loads(listing.offered_json))
 return blocked

def offered_discs(db,uid,ids,now):
 if not 1<=len(ids)<=3 or len(set(ids))!=len(ids):raise BekovichError(422,'Выбери от одного до трёх разных дисков')
 from disc_equipment import ensure_inventory
 ensure_inventory(db,uid)
 rows=db.scalars(select(DiscInstance).where(DiscInstance.id.in_(ids))).all()
 blocked=blocked_discs(db,uid,now)
 if len(rows)!=len(ids) or any(d.user_id!=uid or d.status!='ready' or d.activated_at is not None or d.id in blocked for d in rows):raise BekovichError(409,'Подходят только твои новые диски, свободные от обменов, активации и полок')
 return rows

def item_view(row):
 data=json.loads(row.payload_json)
 # USB contents are only disclosed by an idempotent server read.
 if row.kind=='usb' and row.read_at is None:data.pop('usb',None)
 return dict(data,id=row.id,chest=row.chest,kind=row.kind,opened=bool(row.opened_at),read=bool(row.read_at),consumed=bool(row.consumed_at),created_at=row.created_at.isoformat()+'Z')

def inventory(db,uid):
 from disc_equipment import ensure_inventory,instance_view
 ensure_inventory(db,uid);blocked=blocked_discs(db,uid,datetime.utcnow())
 rows=db.scalars(select(DiscInstance).where(DiscInstance.user_id==uid,DiscInstance.status=='ready',DiscInstance.activated_at.is_(None)).order_by(DiscInstance.created_at.desc(),DiscInstance.id)).all()
 return [instance_view(d) for d in rows if d.id not in blocked]

def items_page(db,uid,before=None):
 query=select(BekovichItem).where(BekovichItem.user_id==uid)
 if before:
  cursor=db.get(BekovichItem,before)
  if cursor is None or cursor.user_id!=uid:raise BekovichError(404,'Страница находок не найдена')
  query=query.where(or_(BekovichItem.created_at<cursor.created_at,and_(BekovichItem.created_at==cursor.created_at,BekovichItem.id<cursor.id)))
 rows=db.scalars(query.order_by(BekovichItem.created_at.desc(),BekovichItem.id.desc()).limit(101)).all()
 return dict(stash=[item_view(i) for i in rows[:100]],next_cursor=rows[99].id if len(rows)>100 else None)

def state(db,uid):
 return dict(inventory=inventory(db,uid),**items_page(db,uid),worn=equipped_badge(db,uid),credits=credits(db,uid),balance=db.scalar(select(User.jera).where(User.id==uid)))

def quote(db,uid,ids,now=None):
 lock_scores(db);available(db);now=now or datetime.utcnow();rows=offered_discs(db,uid,ids,now);assessment=assess(rows)
 row=db.scalar(select(BekovichOffer).where(BekovichOffer.user_id==uid,BekovichOffer.signature==assessment['signature']))
 reused=row is not None
 if row is None:
  assessment,chest,reward,refused=roll_reward(rows)
  row=BekovichOffer(id=uuid4().hex,user_id=uid,signature=assessment['signature'],assessment_json=json.dumps(assessment),reward_json=json.dumps(reward),chest=chest,refused=refused,created_at=now);db.add(row);db.flush()
 return dict(id=row.id,assessment=json.loads(row.assessment_json),chest=row.chest,refused=row.refused,reused=reused,discs=ids)

def add_jera(db,uid,amount,reason):
 db.execute(update(User).where(User.id==uid).values(jera=User.jera+amount));db.add(JeraTx(user_id=uid,amount=amount,reason=reason))

def grant_reward(db,uid,row,reward,now):
 kind=reward['kind']
 if kind=='coins':add_jera(db,uid,reward['amount'],'bekovich:coins:'+row.id)
 elif kind=='cassette':
  from shop_service import owned_themes,RARITY,REFUND_PERCENT
  pool=sorted(owned_themes(db,uid)&set(RARITY));theme=secrets.choice(pool) if pool else 'dark'
  refund=REFUND_PERCENT.get(RARITY.get(theme),25)
  reward.update(theme_id=theme,amount=refund);add_jera(db,uid,refund,'bekovich:cassette:'+row.id)
 elif kind=='epic_seed':
  from garden_service import load
  garden,data=load(db,uid,now);crop=reward['seed'];data['seeds'][crop]=data['seeds'].get(crop,0)+1;garden.data_json=json.dumps(data)
 elif kind=='badge':
  badge=reward['badge']
  for _ in range(200):
   name=' '.join((badge['prefix']+' '+badge['title']).split()).casefold()
   if db.scalar(select(StudioBadge.id).where(StudioBadge.name_key==name)) is None:break
   badge=roll_badge()
  else:raise BekovichError(409,'Бекович подбирает свободный титул. Попробуй позже — диски не списаны.')
  badge=dict(badge,serial=row.id[:8].upper(),item_id=row.id,demo=False)
  db.add(StudioBadge(id=row.id,user_id=uid,name_key=name,data_json=json.dumps(badge)));reward['badge']=badge
 row.payload_json=json.dumps(reward)

def accept(db,uid,offer_id,ids,request_id,now=None):
 try:request_id=UUID(request_id).hex
 except (ValueError,TypeError,AttributeError):raise BekovichError(422,'Нужен номер сделки')
 lock_scores(db);available(db);now=now or datetime.utcnow()
 old=db.scalar(select(BekovichDeal).where(BekovichDeal.user_id==uid,BekovichDeal.request_id==request_id))
 if old:
  if old.offer_id!=offer_id or sorted(json.loads(old.discs_json))!=sorted(ids):raise BekovichError(409,'Номер сделки уже занят другим набором')
  return dict(entry=item_view(db.get(BekovichItem,old.id)),**state(db,uid))
 offer=db.get(BekovichOffer,offer_id)
 if not offer or offer.user_id!=uid:raise BekovichError(404,'Предложение не найдено')
 if offer.refused:raise BekovichError(409,'Бекович отказался от этого набора')
 rows=offered_discs(db,uid,ids,now)
 if assess(rows)['signature']!=offer.signature:raise BekovichError(409,'Состав дисков изменился. Попроси новую оценку.')
 identity=uuid4().hex;reward=json.loads(offer.reward_json)
 deal=BekovichDeal(id=identity,user_id=uid,request_id=request_id,offer_id=offer.id,discs_json=json.dumps(sorted(ids)),created_at=now);db.add(deal);db.flush()
 item=BekovichItem(id=identity,user_id=uid,kind=reward['kind'],chest=offer.chest,payload_json=json.dumps(reward),created_at=now);db.add(item);db.flush()
 for disc in rows:disc.status='traded'
 grant_reward(db,uid,item,reward,now);db.flush()
 return dict(entry=item_view(item),**state(db,uid))

def item_action(db,uid,identity,action):
 lock_scores(db);available(db);row=db.get(BekovichItem,identity)
 if row is None or row.user_id!=uid:raise BekovichError(404,'Находка не найдена')
 now=datetime.utcnow()
 if action=='open':row.opened_at=row.opened_at or now
 elif action=='read':
  if row.kind!='usb':raise BekovichError(422,'Компьютер читает только USB')
  if row.read_at is None:
   data=json.loads(row.payload_json)['usb'];cash=wallet(db,uid);field='dvd_opens' if data['player']=='dvd' else 'theme_opens';setattr(cash,field,getattr(cash,field)+data['opens']);row.read_at=now
  row.opened_at=row.opened_at or now
 elif action=='wear':
  if row.kind!='badge':raise BekovichError(422,'Прикрепить можно только жетон')
  wallet(db,uid).badge_id=row.id
 else:raise BekovichError(422,'Неизвестное действие')
 db.flush();return dict(entry=item_view(row),worn=equipped_badge(db,uid),credits=credits(db,uid))

def consume_ticket(db,uid,event_id):
 row=db.scalar(select(BekovichItem).where(BekovichItem.user_id==uid,BekovichItem.kind=='ticket',BekovichItem.consumed_at.is_(None)).order_by(BekovichItem.created_at,BekovichItem.id).limit(1))
 if row is None:return False
 row.consumed_at=datetime.utcnow();data=json.loads(row.payload_json);data['tournament_id']=event_id;row.payload_json=json.dumps(data);db.flush();return True

def restore_tickets(db,event_id):
 for row in db.scalars(select(BekovichItem).where(BekovichItem.kind=='ticket',BekovichItem.consumed_at.is_not(None))):
  data=json.loads(row.payload_json)
  if data.get('tournament_id')==event_id:
   row.consumed_at=None;data.pop('tournament_id',None);row.payload_json=json.dumps(data)
