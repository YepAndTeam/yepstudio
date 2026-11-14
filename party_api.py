"""Authenticated, persistent rooms. No wallet writes and no bot notifications."""
import json,secrets,time
from datetime import datetime,timedelta
from typing import Optional,Union
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field,StrictInt,StrictStr
from sqlalchemy import select,update,delete,or_
from party_models import PartyRoom,PartyMember,PartyTiming
from sqlalchemy.exc import IntegrityError
from yaabik_models import YaabikState
from database import User
import party_engine as game

class CreateIn(BaseModel):
 kind:str
 public:bool=True
 capacity:int=Field(default=10,ge=4,le=12)
 seats:int=Field(default=1,ge=1,le=11)
class JoinIn(BaseModel):
 kind:Optional[str]=None
class CommandIn(BaseModel):
 id:str=Field(min_length=16,max_length=64,pattern=r'^[a-zA-Z0-9_-]+$')
 kind:str
 value:Optional[Union[StrictInt,StrictStr]]=None
 phase_token:str=''
class TimingIn(BaseModel):
 discussion_seconds:StrictInt=Field(ge=15,le=1800)
 vote_seconds:StrictInt=Field(ge=15,le=1800)
class TimingsIn(BaseModel):
 mafia:TimingIn
 bunker:TimingIn
class ChatIn(BaseModel):
 id:str=Field(min_length=16,max_length=64,pattern=r'^[a-zA-Z0-9_-]+$')
 text:str=Field(min_length=1,max_length=500)

def token(s):return f"{s['day']}:{s['phase']}:{s['deadline']}"
def make_party_router(get_user,get_db):
 r=APIRouter(prefix='/api/party',tags=['party'])
 def fail(error):raise HTTPException(422,str(error))
 def load(db,code):
  room=db.scalar(select(PartyRoom).where(PartyRoom.code==code.upper()).with_for_update())
  if not room:raise HTTPException(404,'Комната не найдена')
  return room,json.loads(room.data_json)
 def save(db,room,s):
  revision=room.revision
  changed=db.execute(update(PartyRoom).where(PartyRoom.code==room.code,PartyRoom.revision==revision).values(data_json=json.dumps(s,ensure_ascii=False),status=s['status'],revision=revision+1,updated_at=datetime.utcnow()).execution_options(synchronize_session=False))
  if changed.rowcount!=1:db.rollback();raise HTTPException(409,'Комната обновилась. Повтори действие.')
 def pack(room,s,uid,now):
  data=game.view(s,uid,now);data.update({'code':room.code,'phase_token':token(s)});return data
 def tick(db,room,s,now):
  if game.advance(s,now,secrets.SystemRandom()):save(db,room,s);db.flush();db.refresh(room)
 def appearance(db,user):
  row=db.get(YaabikState,user.id);prefs=json.loads(row.data_json).get('prefs',{}) if row else {}
  return prefs.get('skin','classic'),user.theme or 'dark'
 def active_elsewhere(db,uid,code):
  rows=db.scalars(select(PartyRoom).join(PartyMember,PartyMember.room_code==PartyRoom.code).where(PartyMember.user_id==uid,PartyRoom.status=='active',PartyRoom.code!=code)).all()
  return next((row.code for row in rows if any(p['id']==uid and p['alive'] for p in json.loads(row.data_json)['players'])),None)
 def timing_values(db):
  rows={row.kind:row for row in db.scalars(select(PartyTiming)).all()}
  return {kind:{'discussion_seconds':rows[kind].discussion_seconds if kind in rows else 120,'vote_seconds':rows[kind].vote_seconds if kind in rows else 45} for kind in ('mafia','bunker')}
 @r.get('/settings')
 def read_timings(user=Depends(get_user),db=Depends(get_db)):
  if user.role!='admin':raise HTTPException(403,'Только для администратора')
  return timing_values(db)
 @r.put('/settings')
 def write_timings(body:TimingsIn,user=Depends(get_user),db=Depends(get_db)):
  if user.role!='admin':raise HTTPException(403,'Только для администратора')
  rows={row.kind:row for row in db.scalars(select(PartyTiming).with_for_update()).all()}
  for kind in ('bunker','mafia'):
   row=rows.get(kind);values=getattr(body,kind)
   if row is None:row=PartyTiming(kind=kind);db.add(row)
   row.discussion_seconds=values.discussion_seconds;row.vote_seconds=values.vote_seconds
  try:db.commit()
  except IntegrityError:db.rollback();raise HTTPException(409,'Настройки обновились. Сохрани ещё раз.')
  return timing_values(db)
 @r.get('')
 def rooms(kind:str='mafia',user=Depends(get_user),db=Depends(get_db)):
  if kind not in ('mafia','bunker'):raise HTTPException(422,'Неизвестная игра')
  mine=select(PartyMember.room_code).where(PartyMember.user_id==user.id)
  rows=db.scalars(select(PartyRoom).where(PartyRoom.kind==kind,PartyRoom.status.in_(['lobby','active']),or_(PartyRoom.public==True,PartyRoom.code.in_(mine))).order_by(PartyRoom.updated_at.desc()).limit(50)).all()
  result=[]
  for room in rows:
   s=json.loads(room.data_json)
   member=any(p['id']==user.id for p in s['players'])
   result.append({'code':room.code,'kind':room.kind,'status':room.status,'count':len(s['players']),'capacity':s['capacity'],'mine':member,'host_name':next((p['name'] for p in s['players'] if p['id']==s['host']),'Яабик')})
  return {'rooms':result}
 @r.post('')
 def create(body:CreateIn,user=Depends(get_user),db=Depends(get_db)):
  waiting=db.scalars(select(PartyRoom.code).join(PartyMember,PartyMember.room_code==PartyRoom.code).where(PartyMember.user_id==user.id,PartyRoom.status=='lobby')).all()
  if len(waiting)>=3:raise HTTPException(422,'Сначала покинь лишние комнаты ожидания (максимум 3)')
  if active_elsewhere(db,user.id,''):raise HTTPException(422,'Сначала закончи текущую партию')
  db.execute(select(User.id).where(User.id==user.id).with_for_update())
  try:s=game.new_room(body.kind,user.id,user.first_name,time.time(),body.public,body.capacity,body.seats)
  except game.PartyError as e:fail(e)
  skin,theme=appearance(db,user);s['players'][0].update({'skin':skin,'theme':theme})
  for _ in range(10):
   code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
   if not db.get(PartyRoom,code):break
  else:raise HTTPException(503,'Попробуй создать комнату ещё раз')
  room=PartyRoom(code=code,kind=body.kind,public=body.public,data_json=json.dumps(s,ensure_ascii=False));db.add(room);db.add(PartyMember(room_code=code,user_id=user.id));db.commit();return pack(room,s,user.id,time.time())
 @r.get('/{code}')
 def read(code:str,user=Depends(get_user),db=Depends(get_db)):
  room,s=load(db,code);now=time.time()
  if not room.public and not any(p['id']==user.id for p in s['players']):raise HTTPException(403,'Сначала войди по коду')
  tick(db,room,s,now)
  try:data=pack(room,s,user.id,now)
  except game.PartyError as e:fail(e)
  db.commit();return data
 @r.post('/{code}/join')
 def join(code:str,body:JoinIn,user=Depends(get_user),db=Depends(get_db)):
  room,s=load(db,code)
  if body.kind and body.kind!=room.kind:raise HTTPException(422,'Этот код относится к другой игре')
  if active_elsewhere(db,user.id,room.code):raise HTTPException(422,'Сначала закончи текущую партию')
  skin,theme=appearance(db,user)
  try:game.join(s,user.id,user.first_name,skin,theme)
  except game.PartyError as e:fail(e)
  if not db.get(PartyMember,(room.code,user.id)):db.add(PartyMember(room_code=room.code,user_id=user.id))
  save(db,room,s);db.commit();return pack(room,s,user.id,time.time())
 @r.post('/{code}/action')
 def action(code:str,body:CommandIn,user=Depends(get_user),db=Depends(get_db)):
  room,s=load(db,code);now=time.time();tick(db,room,s,now)
  try:
   game.player(s,user.id)
   key=f'{user.id}:{body.id}'
   if key not in s['seen']:
    previous_status=s['status']
    if body.kind not in ('start','leave') and body.phase_token!=token(s):raise HTTPException(409,'Этап уже сменился. Обнови комнату.')
    if body.kind=='start':
     db.execute(select(User.id).where(User.id.in_([p['id'] for p in s['players']])).order_by(User.id).with_for_update())
     for p in s['players']:
      if active_elsewhere(db,p['id'],room.code):raise game.PartyError('Один из участников уже играет в другой комнате')
    if body.kind=='start':
     values=timing_values(db)[s['kind']];s['timings']={'discussion':values['discussion_seconds'],'vote':values['vote_seconds'],'runoff':values['vote_seconds']}
    game.act(s,user.id,body.kind,body.value,now)
    s['seen']=(s['seen']+[key])[-256:];save(db,room,s)
    if body.kind=='leave' and previous_status=='lobby':db.execute(delete(PartyMember).where(PartyMember.room_code==room.code,PartyMember.user_id==user.id))
   data=pack(room,s,user.id,now) if body.kind!='leave' else {'left':True}
  except game.PartyError as e:fail(e)
  db.commit();return data
 @r.post('/{code}/chat')
 def message(code:str,body:ChatIn,user=Depends(get_user),db=Depends(get_db)):
  room,s=load(db,code);now=time.time();tick(db,room,s,now)
  try:
   game.player(s,user.id);key=f'{user.id}:{body.id}'
   if key not in s['seen']:
    game.chat(s,user.id,body.text,now);s['seen']=(s['seen']+[key])[-256:];save(db,room,s)
   data=pack(room,s,user.id,now)
  except game.PartyError as e:fail(e)
  db.commit();return data
 return r
