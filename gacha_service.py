"""Five draws, one transaction and one idempotency key. No bulk discount."""
import json,secrets
from uuid import UUID,uuid4,uuid5,NAMESPACE_URL
from sqlalchemy import select,update
from database import User,JeraTx,ThemeBoxPurchase
from disc_models import DiscDraw,DiscRequest
from gacha_models import GachaBatch,GachaBatchRequest
from score_service import lock_scores

class GachaError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

def identity(key):
 try:return UUID(key).hex
 except (ValueError,TypeError,AttributeError):raise GachaError(422,'Нужен корректный номер открытия')

def disc_batch_result(db,row):
 from disc_service import draw_view,balance,launch_gift_state
 return dict(batch_id=row.id,draws=[draw_view(db.get(DiscDraw,i)) for i in json.loads(row.items_json)],balance=balance(db,row.user_id),launch_gift=launch_gift_state(db,row.user_id))

def open_five_discs(db,uid,request_id):
 from disc_service import open_disc,reveal_disc,PRICE,launch_gift_state,balance
 from shop_service import check_available
 request_id=identity(request_id);lock_scores(db)
 old=db.scalar(select(GachaBatch).where(GachaBatch.user_id==uid,GachaBatch.kind=='dvd',GachaBatch.request_id==request_id))
 if old:return disc_batch_result(db,old)
 check_available(db)
 if db.get(DiscRequest,(uid,request_id)):raise GachaError(409,'Этот номер уже использован для одиночного открытия')
 if db.scalar(select(DiscDraw.id).where(DiscDraw.user_id==uid,DiscDraw.revealed_at.is_(None)).limit(1)):raise GachaError(409,'Сначала забери нераскрытый диск из плеера')
 gift=launch_gift_state(db,uid);free=gift['remaining']+gift.get('bonus_remaining',0)
 if balance(db,uid)<max(0,5-free)*PRICE:raise GachaError(409,'Не хватает Йер на все пять DVD-открытий')
 ids=[]
 for index in range(5):
  key=request_id if index==0 else uuid5(NAMESPACE_URL,f'yab:dvd-batch:{uid}:{request_id}:{index}').hex
  draw=open_disc(db,uid,key)['draw'];reveal_disc(db,uid,draw['id']);ids.append(draw['id'])
 row=GachaBatch(id=uuid4().hex,user_id=uid,kind='dvd',request_id=request_id,items_json=json.dumps(ids),status='done');db.add(row);db.flush();return disc_batch_result(db,row)

def pending_theme_batch(db,uid):
 return db.scalar(select(GachaBatch).where(GachaBatch.user_id==uid,GachaBatch.kind=='themes',GachaBatch.status=='pending').order_by(GachaBatch.created_at).limit(1))

def theme_batch_buy_result(db,row):
 from shop_service import balance
 from theme_gift_service import theme_gifts
 children=[db.get(ThemeBoxPurchase,i) for i in json.loads(row.items_json)]
 return dict(box_id=row.id,count=5,runes=list(children[0].runes),price=sum(i.price for i in children),balance=balance(db,row.user_id),theme_gifts=theme_gifts(db,row.user_id))

def buy_five_themes(db,uid,request_id):
 from shop_service import check_available,balance,BOX_PRICE,RUNES,choose_theme
 from theme_gift_service import theme_gifts,consume_theme_open
 from disc_equipment import luck_for
 request_id=identity(request_id);lock_scores(db)
 alias=db.get(GachaBatchRequest,(uid,'themes',request_id))
 if alias:return theme_batch_buy_result(db,db.get(GachaBatch,alias.batch_id))
 row=db.scalar(select(GachaBatch).where(GachaBatch.user_id==uid,GachaBatch.kind=='themes',GachaBatch.request_id==request_id))
 if row:return theme_batch_buy_result(db,row)
 check_available(db)
 row=pending_theme_batch(db,uid)
 if row:
  db.add(GachaBatchRequest(user_id=uid,kind='themes',request_id=request_id,batch_id=row.id));db.flush();return theme_batch_buy_result(db,row)
 if db.scalar(select(ThemeBoxPurchase.id).where(ThemeBoxPurchase.user_id==uid,ThemeBoxPurchase.status=='pending').limit(1)):raise GachaError(409,'Сначала открой кассету, которая уже находится в установке')
 if db.scalar(select(ThemeBoxPurchase.id).where(ThemeBoxPurchase.user_id==uid,ThemeBoxPurchase.request_id==request_id).limit(1)):raise GachaError(409,'Этот номер уже использован для одиночного открытия')
 free=sum(g['remaining'] for g in theme_gifts(db,uid));cost=max(0,5-free)*BOX_PRICE
 changed=db.execute(update(User).where(User.id==uid,User.jera>=cost).values(jera=User.jera-cost))
 if changed.rowcount!=1:raise GachaError(409,'Не хватает Йер на все пять кассет')
 runes=''.join(secrets.SystemRandom().sample(RUNES,3));luck=luck_for(db,uid);ids=[]
 for index in range(5):
  price=0 if consume_theme_open(db,uid) else BOX_PRICE
  key=request_id if index==0 else uuid5(NAMESPACE_URL,f'yab:theme-batch:{uid}:{request_id}:{index}').hex
  child=ThemeBoxPurchase(id=uuid4().hex,user_id=uid,request_id=key,runes=runes,theme_id=choose_theme(luck),price=price,status='pending',refund=0,is_dupe=False);db.add(child);ids.append(child.id)
  if price:db.add(JeraTx(user_id=uid,amount=-price,reason='shop:buy:'+child.id))
 row=GachaBatch(id=uuid4().hex,user_id=uid,kind='themes',request_id=request_id,items_json=json.dumps(ids),status='pending');db.add(row);db.flush();return theme_batch_buy_result(db,row)

def unlock_five_themes(db,uid,batch_id,runes):
 from shop_service import unlock_box,owned_themes,shop_state
 lock_scores(db);row=db.get(GachaBatch,batch_id)
 if row is None or row.user_id!=uid or row.kind!='themes':raise GachaError(404,'Набор кассет не найден')
 results=[]
 for child in json.loads(row.items_json):results.append(dict(unlock_box(db,uid,child,runes),id=child))
 row.status='done';db.flush();state=shop_state(db,uid)
 return dict(results[0],batch_id=row.id,batch_results=results,total_refund=sum(i['refund'] for i in results),shop=state,owned_themes=sorted(owned_themes(db,uid)),balance=state['balance'])
