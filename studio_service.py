"""Small read-only event card for the studio overview."""
from datetime import datetime,timedelta
import json
from sqlalchemy import select
from database import Tournament
from race_models import Race

def event_summary(db,now=None):
 now=now or datetime.utcnow();options=[]
 tours=db.scalars(select(Tournament).where(Tournament.cancelled.is_(False),Tournament.status.in_(['active','registration'])).order_by(Tournament.ends_at,Tournament.created_at).limit(10)).all()
 for tour in tours:
  if tour.status=='active' and tour.ends_at and tour.ends_at>now:
   options.append((tour.ends_at,{'kind':'tournament','id':tour.id,'title':tour.title,'status':'Турнир идёт','label':'До завершения','ends_at':tour.ends_at.isoformat()+'Z'}))
 races=db.scalars(select(Race).where(Race.status=='scheduled',Race.chat_until>now).order_by(Race.starts_at,Race.id).limit(1)).all()
 for race in races:
  duration=json.loads(race.rules_json).get('duration_seconds',180)
  end=race.starts_at+timedelta(seconds=duration)
  if now<race.opens_at:status,label,target='Скоро скачки','До открытия ставок',race.opens_at
  elif now<race.starts_at:status,label,target='Ставки открыты' if now<race.closes_at else 'Подготовка заезда','До старта',race.starts_at
  elif now<end:status,label,target='Заезд идёт','До финиша',end
  else:status,label,target='Подводим итоги','Результат скоро появится',None
  node=race.node_id or ''
  stage='Предварительный заезд' if node=='PRE' or node.startswith('P') else 'Четвертьфинал' if node.startswith('Q') else 'Полуфинал' if node.startswith('S') else 'Финал' if node=='F' else 'Ближайший заезд'
  title='Скачки · '+stage
  options.append((target or now,{'kind':'races','id':race.id,'title':title,'status':status,'label':label,'ends_at':target.isoformat()+'Z' if target else None}))
 if options:result=min(options,key=lambda item:item[0])[1]
 else:
  tour=next((t for t in tours if t.status=='registration'),None)
  result={'kind':'tournament','id':tour.id,'title':tour.title,'status':'Регистрация открыта','label':str(tour.duration_hours)+' часов после старта','ends_at':None} if tour else None
 if result:result['server_now']=now.isoformat()+'Z'
 return result
