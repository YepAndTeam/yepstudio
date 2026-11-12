# coding: utf-8
from datetime import datetime
from sqlalchemy import select
from database import UserTheme
from disc_models import ThemeUsbGift
from score_service import lock_scores
THEME_USB={'neon':(1,'Неон Токио'),'poop':(5,'Какашечки')}

def theme_gifts(db,user_id):
 owned=set(db.scalars(select(UserTheme.theme_id).where(UserTheme.user_id==user_id)))
 rows={row.theme_id:row for row in db.scalars(select(ThemeUsbGift).where(ThemeUsbGift.user_id==user_id))}
 return [dict(id=key,total=count,title=title,target='themes',claimed=key in rows,activated=bool(rows.get(key) and rows[key].activated_at),remaining=rows[key].remaining if key in rows else 0) for key,(count,title) in THEME_USB.items() if key in owned or key in rows]

def update_theme_gift(db,user_id,key,activate=False):
 from shop_service import ShopError,balance
 lock_scores(db)
 if key not in THEME_USB or not any(g['id']==key for g in theme_gifts(db,user_id)):raise ShopError(403,'Для этой флешки нужна соответствующая тема')
 row=db.get(ThemeUsbGift,(user_id,key))
 if row is None:
  if activate:raise ShopError(409,'Сначала забери флешку из письма')
  row=ThemeUsbGift(user_id=user_id,theme_id=key,remaining=0);db.add(row);db.flush()
 if activate and row.activated_at is None:row.activated_at=datetime.utcnow();row.remaining=THEME_USB[key][0];db.flush()
 return {'theme_gifts':theme_gifts(db,user_id),'balance':balance(db,user_id)}

def consume_theme_open(db,user_id):
 row=db.scalar(select(ThemeUsbGift).where(ThemeUsbGift.user_id==user_id,ThemeUsbGift.activated_at.is_not(None),ThemeUsbGift.remaining>0).order_by(ThemeUsbGift.theme_id).limit(1))
 if row is None:return False
 row.remaining-=1
 return True
