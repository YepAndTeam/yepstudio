"""Isolated local playtest server. Never imports main/bot or the production database.
Run with YAB_PARTY_LOCAL_DB pointing to an explicit local SQLite path.
"""
import os
from pathlib import Path
path=os.environ.get('YAB_PARTY_LOCAL_DB')
if not path:raise RuntimeError('Set YAB_PARTY_LOCAL_DB to a dedicated test SQLite file')
os.environ['DATABASE_URL']='sqlite:///'+str(Path(path).resolve()).replace('\\','/')
from fastapi import FastAPI,Header,HTTPException,Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from database import Base,User,SessionLocal,engine
from party_models import PartyRoom,PartyMember
from yaabik_models import YaabikState
from party_api import make_party_router
import party_engine as g
import json,time,random
Base.metadata.create_all(engine)
with SessionLocal.begin() as db:
 for i,name in enumerate(['Ты','Айша','Данияр','Мира','Арсен','Соня','Тимур','Луна','Бек','Ника','Рома','Али'],1):
  if not db.get(User,i):db.add(User(id=i,first_name=name,theme=['dark','nyan','neon','tetris'][i%4],jera=0))
  if i==1:db.get(User,i).role='admin'
  if not db.get(YaabikState,i):db.add(YaabikState(user_id=i,data_json=json.dumps({'prefs':{'skin':['classic','mint','sunset'][i%3]}})))
def get_db():
 db=SessionLocal()
 try:yield db
 finally:db.close()
def get_user(x_party_preview_user:int=Header(default=1),db=Depends(get_db)):
 user=db.get(User,x_party_preview_user)
 if not user:raise HTTPException(403,'Только тестовые участники')
 return user
app=FastAPI(title='YAB isolated party playtest')
app.add_middleware(CORSMiddleware,allow_origin_regex=r'http://(127\.0\.0\.1|localhost):[0-9]+',allow_methods=['*'],allow_headers=['*'])
app.include_router(make_party_router(get_user,get_db))
@app.post('/preview/{code}/{command}')
def preview(code:str,command:str,db=Depends(get_db)):
 room=db.get(PartyRoom,code)
 if not room:raise HTTPException(404,'Нет комнаты')
 s=json.loads(room.data_json);now=time.time()
 if command=='fill':
  existing={p['id'] for p in s['players']}
  candidates=[u for u in db.scalars(select(User).where(User.id<=12).order_by(User.id)).all() if u.id not in existing]
  for user in candidates[:s['capacity']-len(existing)]:
   g.join(s,user.id,user.first_name,['classic','mint','sunset'][user.id%3],user.theme)
   if not db.get(PartyMember,(code,user.id)):db.add(PartyMember(room_code=code,user_id=user.id))
 elif command=='next':
  if s['status']!='active':raise HTTPException(422,'Сначала начни партию')
  if s['phase']=='night':
   for p in g.living(s):
    if p['role'] not in ('civilian',None) and str(p['id']) not in s['actions']:
     targets=[q for q in g.living(s) if q['id']!=p['id'] and not(p['role']=='mafia' and q['role']=='mafia')]
     if targets:g.act(s,p['id'],'night',targets[0]['id'],s['deadline']-({'mafia':40,'detective':25,'doctor':10}[p['role']]))
  elif s['phase']=='last_words':
   victim=g.player(s,s['last_words_id'])
   if not victim.get('last_words_used'):g.chat(s,victim['id'],'Это моё последнее слово. Увидимся после партии.',now)
  elif s['phase'] in ('vote','runoff'):
   alive=g.living(s);candidates=s.get('candidates') or [p['id'] for p in alive];target=candidates[-1]
   for p in alive:
    if p['id']!=target and str(p['id']) not in s['votes']:g.act(s,p['id'],'vote',target,now)
  s['deadline']=now;g.advance(s,now,random.SystemRandom())
 else:raise HTTPException(404,'Нет такой команды')
 room.data_json=json.dumps(s,ensure_ascii=False);room.status=s['status'];room.revision+=1;db.commit();return {'ok':True}
