from typing import Optional,List
from fastapi import APIRouter,Depends,HTTPException,BackgroundTasks
from pydantic import BaseModel,Field
from sqlalchemy import select,func
from disc_equipment import equip,equipment_state,start_practice,finish_practice,EquipmentError
from disc_models import DiscRun
from database import GameRun
from score_service import ScoreError
from community_service import chat_state,post_chat,remove_chat,trade_inventory,trades_state,create_trade,resolve_trade

class EquipIn(BaseModel):
 instance_id:Optional[str]=Field(default=None,max_length=32)
class PracticeIn(BaseModel):
 game:str
class PracticeScore(PracticeIn):
 run_id:str=Field(min_length=32,max_length=40)
 score:int=Field(ge=0,le=1_000_000_000)
class ChatIn(BaseModel):
 body:str=Field(min_length=1,max_length=800)
class TradeIn(BaseModel):
 recipient_id:int
 offered:List[str]=Field(min_length=1,max_length=5)
 wanted:List[str]=Field(min_length=1,max_length=5)
 request_id:str=Field(min_length=32,max_length=40)

class ListingIn(BaseModel):
 offered:List[str]=Field(min_length=1,max_length=5)
 wanted:dict[str,int]
 request_id:str=Field(min_length=32,max_length=40)
class ListingReplyIn(BaseModel):
 offered:List[str]=Field(min_length=1,max_length=5)
 request_id:str=Field(min_length=32,max_length=40)

def make_community_router(get_user,get_db,deliver_trade_notice=None):
 router=APIRouter(prefix='/api',tags=['equipment','community'])
 def transaction(db,fn):
  try:value=fn();db.commit();return value
  except (EquipmentError,ScoreError) as error:db.rollback();raise HTTPException(error.status,str(error))
 def game_check(game):
  if game not in ('dino','flappy','snake','tetris','hell','drive'):raise HTTPException(422,'Эта игра не поддерживает диски')
 @router.get('/discs/shelves')
 def shelves(user=Depends(get_user),db=Depends(get_db)):
  from disc_shelves import shelf_state
  return shelf_state(db,user.id)
 @router.post('/discs/shelves/seal')
 def seal(body:EquipIn,user=Depends(get_user),db=Depends(get_db)):
  from disc_shelves import seal_disc
  if not body.instance_id:raise HTTPException(422,'Выбери диск')
  return transaction(db,lambda:seal_disc(db,user.id,body.instance_id))
 @router.get('/discs/equipment')
 def state(user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:equipment_state(db,user.id))
 @router.post('/discs/equip')
 def activate(body:EquipIn,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:equip(db,user.id,body.instance_id))
 @router.post('/disc-play/start')
 def start(body:PracticeIn,user=Depends(get_user),db=Depends(get_db)):
  game_check(body.game);return transaction(db,lambda:start_practice(db,user.id,body.game))
 @router.post('/disc-play/score')
 def score(body:PracticeScore,user=Depends(get_user),db=Depends(get_db)):
  game_check(body.game)
  if body.score>{'dino':20000,'flappy':500,'snake':3000,'tetris':100000,'hell':5000,'drive':1_000_000_000}[body.game]:raise HTTPException(422,'Подозрительный результат')
  return transaction(db,lambda:finish_practice(db,user.id,body.game,body.run_id,body.score))
 @router.get('/disc-play/top')
 def top(game:str,user=Depends(get_user),db=Depends(get_db)):
  game_check(game)
  from disc_equipment import practice_top
  return practice_top(db,user.id,game)
 @router.get('/community/chat')
 def chat(user=Depends(get_user),db=Depends(get_db)):return chat_state(db)
 @router.post('/community/chat')
 def post(body:ChatIn,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:post_chat(db,user.id,body.body))
 @router.delete('/community/chat/{message_id}')
 def remove(message_id:int,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:remove_chat(db,user.id,message_id))
 @router.get('/community/trades')
 def trades(user=Depends(get_user),db=Depends(get_db)):return trades_state(db,user.id)
 @router.get('/community/trades/inventory/{target}')
 def inventory(target:int,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:trade_inventory(db,user.id,target))
 @router.post('/community/trades')
 def offer(body:TradeIn,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:create_trade(db,user.id,body.recipient_id,body.offered,body.wanted,body.request_id))
 @router.post('/community/trades/{trade_id}/{action}')
 def resolve(trade_id:str,action:str,user=Depends(get_user),db=Depends(get_db)):return transaction(db,lambda:resolve_trade(db,user.id,trade_id,action))
 @router.post('/discs/wear/{instance_id}/read')
 def acknowledge(instance_id:str,user=Depends(get_user),db=Depends(get_db)):
  from disc_equipment import acknowledge_wear
  return transaction(db,lambda:acknowledge_wear(db,user.id,instance_id))
 @router.get('/community/market')
 def market(user=Depends(get_user),db=Depends(get_db)):
  from disc_market import market_state
  return market_state(db,user.id)
 @router.post('/community/market')
 def publish(body:ListingIn,user=Depends(get_user),db=Depends(get_db)):
  from disc_market import publish_listing
  return transaction(db,lambda:publish_listing(db,user.id,body.offered,body.wanted,body.request_id))
 @router.post('/community/market/{listing_id}/reply')
 def reply(listing_id:str,body:ListingReplyIn,bg:BackgroundTasks,user=Depends(get_user),db=Depends(get_db)):
  from disc_market import reply_listing
  value=transaction(db,lambda:reply_listing(db,user.id,listing_id,body.offered,body.request_id))
  notice=value.pop('_notify_trade_id',None)
  if notice and deliver_trade_notice:bg.add_task(deliver_trade_notice,notice)
  return value
 @router.post('/community/market/{listing_id}/close')
 def close(listing_id:str,user=Depends(get_user),db=Depends(get_db)):
  from disc_market import close_listing
  return transaction(db,lambda:close_listing(db,user.id,listing_id))
 return router
