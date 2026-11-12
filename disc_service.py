"""Server chooses and charges once; flipping reveals an already persisted result."""
import json,secrets
from datetime import datetime
from pathlib import Path
from uuid import UUID,uuid4
from sqlalchemy import select,update
from database import User,JeraTx,Meta
from disc_models import DiscCopy,DiscDraw,DiscRequest,DiscLaunchGift
from score_service import lock_scores

CATALOG=json.loads(Path(__file__).with_name('disc_catalog.json').read_text(encoding='utf-8-sig'))
PRICE=CATALOG['price']
DISCS={item['id']:item for item in CATALOG['discs']}
RARITIES={item['id']:item for item in CATALOG['rarities']}

class DiscError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

GIFT_ID='dvd-launch-usb-v1'
GIFT_OPENS=10

def launch_gift_state(db,user_id):
 row=db.get(DiscLaunchGift,user_id)
 return {'id':GIFT_ID,'total':GIFT_OPENS,'claimed':row is not None,'activated':bool(row and row.activated_at),'remaining':row.remaining if row else 0}

def claim_launch_gift(db,user_id):
 lock_scores(db)
 if db.get(DiscLaunchGift,user_id) is None:db.add(DiscLaunchGift(user_id=user_id,remaining=0));db.flush()
 return {'launch_gift':launch_gift_state(db,user_id),'balance':balance(db,user_id)}

def activate_launch_gift(db,user_id):
 lock_scores(db)
 row=db.get(DiscLaunchGift,user_id)
 if row is None:raise DiscError(409,'Сначала забери подарочную флешку из письма')
 if row.activated_at is None:row.activated_at=datetime.utcnow();row.remaining=GIFT_OPENS;db.flush()
 return {'launch_gift':launch_gift_state(db,user_id),'balance':balance(db,user_id)}

def choose_disc(luck_percent=0):
 disc=secrets.choice(tuple(DISCS))
 from disc_odds import boosted_chances
 chances=boosted_chances(list(RARITIES.values()),luck_percent)
 weights={key:round(chances[key]*100) for key in RARITIES} if luck_percent else {key:value['weight'] for key,value in RARITIES.items()}
 draw=secrets.randbelow(sum(weights.values()))
 for rarity in RARITIES.values():
  draw-=weights[rarity['id']]
  if draw<0:return disc,rarity['id']
 raise RuntimeError('Invalid disc distribution')

def balance(db,user_id):return db.scalar(select(User.jera).where(User.id==user_id)) or 0

def draw_view(row):
 data={'id':row.id,'item':DISCS[row.disc_id],'serial':row.id[:8].upper(),'price':row.price,'free':row.price==0,'created_at':row.created_at.isoformat()+'Z','revealed':row.revealed_at is not None}
 if row.revealed_at is not None:data.update(rarity=row.rarity,copy_number=row.copy_number,is_dupe=row.copy_number>1,revealed_at=row.revealed_at.isoformat()+'Z')
 return data

def open_disc(db,user_id,request_id):
 try:request_id=UUID(request_id).hex
 except (ValueError,AttributeError,TypeError):raise DiscError(422,'Нужен корректный номер открытия')
 lock_scores(db)
 existing=db.get(DiscRequest,(user_id,request_id))
 if existing:return {'draw':draw_view(db.get(DiscDraw,existing.draw_id)),'balance':balance(db,user_id),'launch_gift':launch_gift_state(db,user_id)}
 pending=db.scalar(select(DiscDraw).where(DiscDraw.user_id==user_id,DiscDraw.revealed_at.is_(None)).order_by(DiscDraw.created_at,DiscDraw.id).limit(1))
 if pending is None:
  if db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise DiscError(503,'Идёт обновление балансов. Попробуй немного позже.')
  gift=db.get(DiscLaunchGift,user_id)
  price=0 if gift and gift.activated_at and gift.remaining>0 else PRICE
  if price:
   changed=db.execute(update(User).where(User.id==user_id,User.jera>=price).values(jera=User.jera-price))
   if changed.rowcount!=1:raise DiscError(409,'Не хватает Йер для DVD-диска')
  else:gift.remaining-=1
  from disc_equipment import luck_for
  disc,rarity=choose_disc(luck_for(db,user_id))
  pending=DiscDraw(id=uuid4().hex,user_id=user_id,disc_id=disc,rarity=rarity,price=price)
  db.add(pending);db.flush()
  if price:db.add(JeraTx(user_id=user_id,amount=-price,reason='disc:open:'+pending.id))
 # Alias recovery requests too, so retrying after a reveal cannot charge again.
 db.add(DiscRequest(user_id=user_id,request_id=request_id,draw_id=pending.id));db.flush()
 return {'draw':draw_view(pending),'balance':balance(db,user_id),'launch_gift':launch_gift_state(db,user_id)}

def reveal_disc(db,user_id,draw_id):
 lock_scores(db)
 row=db.get(DiscDraw,draw_id)
 if row is None or row.user_id!=user_id:raise DiscError(404,'Диск не найден')
 if row.revealed_at is None:
  now=datetime.utcnow();copy=db.get(DiscCopy,(user_id,row.disc_id,row.rarity))
  if copy is None:
   copy=DiscCopy(user_id=user_id,disc_id=row.disc_id,rarity=row.rarity,quantity=1,first_found_at=now,last_found_at=now);db.add(copy)
  else:copy.quantity+=1;copy.last_found_at=now
  row.copy_number=copy.quantity;row.revealed_at=now;db.flush()
  from disc_equipment import ensure_inventory,create_instance
  from disc_models import DiscInstance
  ensure_inventory(db,user_id)
  if not db.get(DiscInstance,row.id):create_instance(db,user_id,row.disc_id,row.rarity,row.id,now)
  db.flush()
 return {'draw':draw_view(row),'balance':balance(db,user_id),'launch_gift':launch_gift_state(db,user_id)}

def disc_state(db,user_id):
 from disc_equipment import ensure_inventory,settle_expired,instance_view,equipment_state,wear_events,luck_for
 from disc_models import DiscInstance
 ensure_inventory(db,user_id);settle_expired(db,user_id)
 instances=db.scalars(select(DiscInstance).where(DiscInstance.user_id==user_id,DiscInstance.status.notin_(('lost','sealed'))).order_by(DiscInstance.created_at.desc(),DiscInstance.id)).all()
 groups={}
 for instance in instances:
  key=(instance.disc_id,instance.rarity)
  if key not in groups:groups[key]={'item':DISCS[instance.disc_id],'rarity':instance.rarity,'quantity':0,'first_found_at':instance.created_at.isoformat()+'Z'}
  groups[key]['quantity']+=1
 copies=db.scalars(select(DiscCopy).where(DiscCopy.user_id==user_id).order_by(DiscCopy.last_found_at.desc(),DiscCopy.disc_id,DiscCopy.rarity)).all()
 pending=db.scalar(select(DiscDraw).where(DiscDraw.user_id==user_id,DiscDraw.revealed_at.is_(None)).order_by(DiscDraw.created_at,DiscDraw.id).limit(1))
 history=db.scalars(select(DiscDraw).where(DiscDraw.user_id==user_id,DiscDraw.revealed_at.is_not(None)).order_by(DiscDraw.revealed_at.desc(),DiscDraw.id).limit(20)).all()
 from disc_odds import boosted_chances
 luck=luck_for(db,user_id);chances=boosted_chances(list(RARITIES.values()),luck)
 return {'wear_events':wear_events(db,user_id),'luck_percent':luck,'price':PRICE,'balance':balance(db,user_id),'launch_gift':launch_gift_state(db,user_id),'catalogue':CATALOG['discs'],'rarities':[{**{k:v for k,v in item.items() if k!='weight'},'chance':chances[item['id']]} for item in RARITIES.values()],
  'pending':draw_view(pending) if pending else None,'collection':list(groups.values()),'instances':[instance_view(row) for row in instances],'equipment':equipment_state(db,user_id),
  'total_copies':len(instances),'unique_editions':len(groups),'total_editions':len(DISCS)*len(RARITIES),'history':[draw_view(row) for row in history]}
