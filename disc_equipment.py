# coding: utf-8
"""Individual disc identities, fixed wear outcomes, and server-issued practice runs."""
import json,secrets
from collections import Counter
from datetime import datetime,timedelta
from uuid import uuid5,NAMESPACE_URL
from sqlalchemy import select,func
from database import GameRun,GameResult,User,Meta
from disc_models import DiscInstance,DiscCopy,DiscDraw,DiscInventoryVersion,DiscEquipment,DiscRun,DiscBonusWallet,DiscBonusReceipt
from score_service import lock_scores
HOURS={'common':1,'rare':3,'epic':12,'legendary':24,'mythic':72,'secret':168}
SURVIVE={'common':10,'rare':30,'epic':50,'mythic':60,'legendary':70,'secret':100}
class EquipmentError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

PROFILES={
 'minecraft':(.95,1,5,0),'terraria':(.95,1,5,0),
 'undertale':(1.15,1,0,0),'hollowknight':(1.15,1,0,0),'soulknight':(1.15,1,0,0),
 'doom':(1.05,1.05,0,0),'portal':(.9,.9,10,10),
 'stardew':(.95,.95,10,0),'halflife':(1.1,1.1,0,0),
 'underground':(1.15,1.15,0,0),'sanandreas':(1.1,1.05,5,0),'skyrim':(.95,1.05,5,0),
}
def effect_for(disc,rarity,previous_tempo=None):
 tempo,score,jera,luck=PROFILES.get(disc,(1,1,0,0))
 if disc=='counterstrike':tempo=previous_tempo if previous_tempo is not None else 1+(5+secrets.randbelow(26))/100;score=1.1
 if rarity=='secret':tempo=previous_tempo if previous_tempo is not None else 1+(5+secrets.randbelow(26))/100;score=1.1;jera=5;luck=10
 return {'tempo':tempo,'score':score,'jera_percent':jera,'luck_percent':luck,'_v':3}

def instance_effects(row,persist=True):
 stored=json.loads(row.effects_json)
 if stored.get('_v',0)<3 and row.status not in ('cracked','lost'):
  stored=effect_for(row.disc_id,row.rarity,stored.get('tempo') if row.disc_id=='counterstrike' or row.rarity=='secret' else None)
  if persist:row.effects_json=json.dumps(stored)
 return {key:value for key,value in stored.items() if not key.startswith('_')}

def luck_for(db,uid,now=None):
 row=active_disc(db,uid,now)
 return int(instance_effects(row).get('luck_percent',0)) if row else 0

def create_instance(db,uid,disc,rarity,identity,created_at=None):
 row=DiscInstance(id=identity,user_id=uid,disc_id=disc,rarity=rarity,status='ready',created_at=created_at or datetime.utcnow(),effects_json=json.dumps(effect_for(disc,rarity)),wear_roll=secrets.randbelow(100))
 db.add(row);return row

def ensure_inventory(db,uid):
 if db.get(DiscInventoryVersion,uid):return
 if db.scalar(select(DiscCopy.user_id).where(DiscCopy.user_id==uid).limit(1)) is None and db.scalar(select(DiscDraw.id).where(DiscDraw.user_id==uid,DiscDraw.revealed_at.is_not(None)).limit(1)) is None:return
 lock_scores(db)
 if db.get(DiscInventoryVersion,uid,populate_existing=True):return
 counts=Counter()
 existing=set(db.scalars(select(DiscInstance.id).where(DiscInstance.user_id==uid)))
 for draw in db.scalars(select(DiscDraw).where(DiscDraw.user_id==uid,DiscDraw.revealed_at.is_not(None))):
  counts[(draw.disc_id,draw.rarity)]+=1
  if draw.id not in existing:create_instance(db,uid,draw.disc_id,draw.rarity,draw.id,draw.revealed_at)
 for stack in db.scalars(select(DiscCopy).where(DiscCopy.user_id==uid)):
  for index in range(counts[(stack.disc_id,stack.rarity)],stack.quantity):
   identity=uuid5(NAMESPACE_URL,f'yab:disc:{uid}:{stack.disc_id}:{stack.rarity}:{index}').hex
   if identity not in existing:create_instance(db,uid,stack.disc_id,stack.rarity,identity,stack.first_found_at)
 db.add(DiscInventoryVersion(user_id=uid));db.flush()

def settle_expired(db,uid,now=None):
 now=now or datetime.utcnow()
 query=select(DiscInstance).where(DiscInstance.user_id==uid,DiscInstance.status=='active',DiscInstance.expires_at<=now)
 if db.scalar(select(DiscInstance.id).where(DiscInstance.user_id==uid,DiscInstance.status=='active',DiscInstance.expires_at<=now).limit(1)) is None:return
 lock_scores(db)
 rows=db.scalars(query.execution_options(populate_existing=True)).all()
 for row in rows:
  if row.status!='active':continue
  instance_effects(row)
  row.status='cracked' if row.wear_roll<SURVIVE[row.rarity] else 'lost'
  from disc_models import DiscWearEvent
  if not db.get(DiscWearEvent,row.id):db.add(DiscWearEvent(instance_id=row.id,user_id=uid,outcome=row.status,created_at=now))
  if row.rarity=='secret':
   row.lost_effect=secrets.choice(tuple(k for k in json.loads(row.effects_json) if not k.startswith('_')))
   effects=json.loads(row.effects_json);effects.pop(row.lost_effect,None);row.effects_json=json.dumps(effects)
 equipment=db.get(DiscEquipment,uid)
 if equipment and any(row.id==equipment.instance_id for row in rows):equipment.instance_id=None
 db.flush()

def iso(value):return value.isoformat()+'Z' if value else None

def instance_view(row):
 from disc_service import DISCS
 return {'id':row.id,'item':DISCS[row.disc_id],'rarity':row.rarity,'status':row.status,'created_at':iso(row.created_at),'activated_at':iso(row.activated_at),'expires_at':iso(row.expires_at),'lifetime_seconds':HOURS[row.rarity]*3600,'survival_percent':SURVIVE[row.rarity],'effects':None if row.rarity=='secret' else instance_effects(row,False),'hidden_effects':row.rarity=='secret','lost_effect':row.lost_effect if row.rarity!='secret' else None,'cracked':row.status=='cracked'}

def active_disc(db,uid,now=None):
 now=now or datetime.utcnow();equipment=db.get(DiscEquipment,uid)
 row=db.get(DiscInstance,equipment.instance_id) if equipment and equipment.instance_id else None
 return row if row and row.user_id==uid and row.status=='active' and row.expires_at>now else None

def equipment_state(db,uid,now=None):
 now=now or datetime.utcnow();settle_expired(db,uid,now);row=active_disc(db,uid,now)
 from datetime import timezone
 from daily_service import KZ
 day=now.replace(tzinfo=timezone.utc).astimezone(KZ).date().isoformat();last=db.get(Meta,'disc_swap_day:'+str(uid))
 return {'active':instance_view(row) if row else None,'server_now':iso(now),'can_remove':not last or last.value!=day,'removal_day':last.value if last else None}

def equip(db,uid,identity,now=None):
 now=now or datetime.utcnow();lock_scores(db);ensure_inventory(db,uid);settle_expired(db,uid,now)
 if db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise EquipmentError(503,'Идёт обновление. Попробуй позже.')
 equipment=db.get(DiscEquipment,uid)
 if equipment is None:equipment=DiscEquipment(user_id=uid);db.add(equipment)
 if equipment.instance_id and equipment.instance_id!=identity:
  from datetime import timezone
  from daily_service import KZ
  day=now.replace(tzinfo=timezone.utc).astimezone(KZ).date().isoformat();key='disc_swap_day:'+str(uid);last=db.get(Meta,key)
  if last and last.value==day:raise EquipmentError(409,'Снять или сменить диск можно один раз за день по времени Казахстана')
  # Validate the destination before consuming the daily change.
  if identity:
   target=db.get(DiscInstance,identity)
   if not target or target.user_id!=uid or target.status not in ('ready','active'):raise EquipmentError(409,'Выбранный диск недоступен')
  db.merge(Meta(key=key,value=day))
 if identity is None:equipment.instance_id=None;db.flush();return equipment_state(db,uid,now)
 row=db.get(DiscInstance,identity)
 if row is None or row.user_id!=uid:raise EquipmentError(404,'Этот экземпляр тебе не принадлежит')
 if row.status in ('cracked','lost'):raise EquipmentError(409,'Диск изношен и больше не активируется')
 if row.status=='ready':row.status='active';row.activated_at=now;row.expires_at=now+timedelta(hours=HOURS[row.rarity])
 equipment.instance_id=row.id;db.flush();return equipment_state(db,uid,now)

def reward_bonus(db,uid,amount,reason,now=None):
 if amount<=0 or not reason.startswith(('daily:','daily-task:','achievement:')):return 0
 now=now or datetime.utcnow();row=active_disc(db,uid,now)
 if not row or not instance_effects(row).get('jera_percent'):return 0
 lock_scores(db)
 if db.get(DiscBonusReceipt,(uid,reason),populate_existing=True):return 0
 wallet=db.get(DiscBonusWallet,uid,populate_existing=True)
 if wallet is None:wallet=DiscBonusWallet(user_id=uid,hundredths=0);db.add(wallet)
 value=wallet.hundredths+amount*int(instance_effects(row).get('jera_percent',0));bonus,wallet.hundredths=divmod(value,100)
 db.add(DiscBonusReceipt(user_id=uid,reason=reason,amount=bonus));db.flush();return bonus

def start_practice(db,uid,game,now=None):
 from score_service import begin_run
 now=now or datetime.utcnow();lock_scores(db);settle_expired(db,uid,now);disc=active_disc(db,uid,now)
 if not disc:raise EquipmentError(409,'Сначала активируй рабочий диск в инвентаре')
 run=begin_run(db,uid,game,now);effects=instance_effects(disc)
 db.add(DiscRun(id=run.id,user_id=uid,instance_id=disc.id,effects_json=json.dumps(effects),expires_at=disc.expires_at));db.flush()
 return {'ok':True,'run_id':run.id,'mode':'disc','effects':effects,'expires_at':iso(disc.expires_at),'server_now':iso(now)}

def finish_practice(db,uid,game,run_id,score,now=None):
 now=now or datetime.utcnow();lock_scores(db)
 if db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise EquipmentError(503,'Идёт обновление, попробуй позже')
 run=db.get(GameRun,run_id);details=db.get(DiscRun,run_id)
 if not run or not details or run.user_id!=uid or run.game!=game:raise EquipmentError(409,'Забег с диском не найден')
 if details.completed_at:
  if details.raw_score!=score:raise EquipmentError(409,'Этот забег уже завершён')
  return {'best':details.score,'score':details.score,'raw_score':score,'mode':'disc','record':False,'rank':None}
 if now>details.expires_at:raise EquipmentError(409,'Срок диска истёк. Этот забег уже закрыт.')
 if run.epoch!=(db.scalar(select(Meta.value).where(Meta.key=='score_epoch')) or 'initial'):raise EquipmentError(409,'Таблица обновлена, начни новый забег')
 effects=json.loads(details.effects_json);elapsed=(now-run.started_at).total_seconds()
 if elapsed<0 or (game=='dino' and score>elapsed*10*effects.get('tempo',1)+50):raise EquipmentError(422,'Результат не соответствует длительности забега')
 details.raw_score=score;details.score=int(score*effects.get('score',1));details.completed_at=now
 # Practice can progress tasks and achievements but must never enter ranked caches.
 from weekly import period_now
 db.add(GameResult(user_id=uid,game=game,score=score,submitted_at=now,period=period_now(now),epoch=run.epoch,valid=True,run_id=run_id));db.flush()
 from achievement_service import accept_achievement
 accept_achievement(db,uid,game,score,run,now)
 from task_service import daily_task_state
 daily_task_state(db,uid,now)
 best=db.scalar(select(func.max(DiscRun.score)).join(GameRun,GameRun.id==DiscRun.id).where(DiscRun.user_id==uid,GameRun.game==game)) or details.score
 return {'best':best,'score':details.score,'raw_score':score,'mode':'disc','record':False,'rank':None}


def valid_dino_score(db,run,score,now,tempo=None):
 if tempo is None:
  details=db.get(DiscRun,run.id)
  tempo=json.loads(details.effects_json).get('tempo',1) if details else 1
 return score<=max(0,(now-run.started_at).total_seconds())*10*tempo+50


def wear_events(db,uid):
 from disc_models import DiscWearEvent
 rows=db.execute(select(DiscWearEvent,DiscInstance).join(DiscInstance,DiscInstance.id==DiscWearEvent.instance_id).where(DiscWearEvent.user_id==uid,DiscWearEvent.seen_at.is_(None)).order_by(DiscWearEvent.created_at).limit(10)).all()
 return [dict(instance_view(disc),outcome=event.outcome) for event,disc in rows]

def acknowledge_wear(db,uid,identity):
 from disc_models import DiscWearEvent
 lock_scores(db);row=db.get(DiscWearEvent,identity)
 if row is None or row.user_id!=uid:raise EquipmentError(404,'Событие износа не найдено')
 if row.seen_at is None:row.seen_at=datetime.utcnow()
 db.flush();return {'ok':True}


def practice_top(db,uid,game):
 from sqlalchemy import desc
 epoch=db.scalar(select(Meta.value).where(Meta.key=='score_epoch')) or 'initial'
 positions=select(DiscRun.user_id.label('user_id'),DiscRun.score.label('score'),DiscRun.completed_at.label('achieved_at'),func.row_number().over(partition_by=DiscRun.user_id,order_by=(DiscRun.score.desc(),DiscRun.completed_at,DiscRun.id)).label('choice')).join(GameRun,GameRun.id==DiscRun.id).join(GameResult,GameResult.run_id==DiscRun.id).where(GameRun.game==game,GameRun.epoch==epoch,GameResult.valid.is_(True),DiscRun.completed_at.is_not(None)).subquery()
 ranked=select(positions.c.user_id,User.first_name.label('name'),positions.c.score.label('best'),func.row_number().over(order_by=(positions.c.score.desc(),positions.c.achieved_at,positions.c.user_id)).label('place')).join(User,User.id==positions.c.user_id).where(positions.c.choice==1).subquery()
 top=[dict(row) for row in db.execute(select(ranked).order_by(ranked.c.place).limit(20)).mappings()]
 own=db.execute(select(ranked).where(ranked.c.user_id==uid)).mappings().first()
 return {'top':top,'my_best':own['best'] if own else 0,'my_rank':own['place'] if own else None,'mode':'disc','ends_at':None}
