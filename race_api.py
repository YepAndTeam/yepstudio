from typing import Optional
from fastapi import APIRouter,Depends,HTTPException,BackgroundTasks
from pydantic import BaseModel,Field,StrictInt
from race_service import (RaceError,tick,race_list,state,get_race,accept_bet,post_chat,seed_from_shop,top_up_fund,fund_tournament,enabled,treasury,is_test_account,update_schedule)
from race_fairness import commitment,verify_beacon,draw
from database import Meta,User
from score_service import lock_scores
import json
class BetIn(BaseModel):
 horse:StrictInt=Field(ge=1,le=10)
 amount:StrictInt=Field(ge=1,le=25)
 request_id:str=Field(min_length=16,max_length=64)
 replaces_id:Optional[str]=Field(default=None,max_length=40)
 commitment:str=Field(min_length=64,max_length=64)
class ChatIn(BaseModel):
 text:str=Field(min_length=1,max_length=240)
class EnabledIn(BaseModel):enabled:bool
class ScheduleIn(BaseModel):times:list[str]
class FundTopUpIn(BaseModel):
 amount:StrictInt=Field(ge=1,le=100000)
 note:str=Field(min_length=3,max_length=120)
 request_id:str=Field(min_length=16,max_length=64)

def make_race_router(get_user,get_admin,get_db,deliver):
 router=APIRouter(prefix='/api')
 def advance(db,bg):
  notices=tick(db);db.commit()
  if notices:bg.add_task(deliver,notices)
 def fail(error):raise HTTPException(error.status,str(error))
 @router.get('/races')
 def listing(bg:BackgroundTasks,user=Depends(get_user),db=Depends(get_db)):
  advance(db,bg);return {**race_list(db,user.id),'can_bet':not is_test_account(db,user)}
 @router.get('/races/{race_id}')
 def detail(race_id:str,bg:BackgroundTasks,user=Depends(get_user),db=Depends(get_db)):
  advance(db,bg)
  try:return state(db,get_race(db,race_id),user.id)
  except RaceError as error:fail(error)
 @router.post('/races/{race_id}/bet')
 def bet(race_id:str,body:BetIn,user=Depends(get_user),db=Depends(get_db)):
  try:
   accept_bet(db,user.id,race_id,body.horse,body.amount,body.request_id,expected_commitment=body.commitment,replaces_id=body.replaces_id)
   result=state(db,get_race(db,race_id),user.id);db.commit();db.refresh(user)
   return {'race':result,'balance':user.jera}
  except RaceError as error:fail(error)
 @router.post('/races/{race_id}/chat')
 def chat(race_id:str,body:ChatIn,user=Depends(get_user),db=Depends(get_db)):
  try:
   post_chat(db,user.id,race_id,body.text);result=state(db,get_race(db,race_id),user.id);db.commit();return result
  except RaceError as error:fail(error)
 @router.get('/races/{race_id}/proof')
 def proof(race_id:str,user=Depends(get_user),db=Depends(get_db)):
  try:race=get_race(db,race_id)
  except RaceError as error:fail(error)
  if race.status!='finished' or not race.proof_json:raise HTTPException(409,'Доказательство доступно после финиша')
  rules=json.loads(race.rules_json);beacon=json.loads(race.proof_json);ranking=json.loads(race.result_json)
  return {'rules':rules,'commitment':race.commitment,'beacon':beacon,'ranking':ranking}
 @router.post('/admin/races/schedule')
 def change_schedule(body:ScheduleIn,admin=Depends(get_admin),db=Depends(get_db)):
  try:
   result=update_schedule(db,body.times);db.commit();return {'schedule':result}
  except RaceError as error:fail(error)
 @router.post('/admin/races/enabled')
 def enable(body:EnabledIn,admin=Depends(get_admin),db=Depends(get_db)):
  lock_scores(db)
  if body.enabled and treasury(db)['available']<25:raise HTTPException(409,'Сначала пополни фонд (нужно минимум 25 свободных Йер)')
  db.merge(Meta(key='races_enabled',value='1' if body.enabled else '0'));db.commit();return {'enabled':body.enabled}
 @router.post('/admin/races/fund-shop')
 def seed(admin=Depends(get_admin),db=Depends(get_db)):
  try:
   amount=seed_from_shop(db);result={'added':amount,'fund':treasury(db)};db.commit();return result
  except RaceError as error:fail(error)
 @router.post('/admin/races/fund-topup')
 def topup(body:FundTopUpIn,admin=Depends(get_admin),db=Depends(get_db)):
  try:
   row,created=top_up_fund(db,admin.id,body.amount,body.note,body.request_id)
   result={'id':row.id,'added':row.amount if created else 0,'amount':row.amount,'note':row.note,'fund':treasury(db)}
   db.commit();return result
  except RaceError as error:fail(error)
 @router.post('/admin/races/fund-tournament/{event_id}')
 def allocate(event_id:str,admin=Depends(get_admin),db=Depends(get_db)):
  try:
   amount=fund_tournament(db,event_id);result={'allocated':amount,'fund':treasury(db)};db.commit();return result
  except RaceError as error:fail(error)
 return router
