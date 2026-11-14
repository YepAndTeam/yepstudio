from typing import Literal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from bekovich_service import state,quote,accept,item_action,items_page,equipped_badge,credits,public_badges,BekovichError
class QuoteIn(BaseModel):
 discs:list[str]=Field(min_length=1,max_length=3)
class AcceptIn(QuoteIn):
 offer_id:str=Field(pattern='^[a-f0-9]{32}$')
 request_id:str=Field(pattern='^[a-f0-9]{32}$')
class BadgeLookupIn(BaseModel):
 ids:list[int]=Field(default_factory=list,max_length=100)
def make_bekovich_router(get_user,get_db):
 router=APIRouter(prefix='/api/bekovich',tags=['bekovich'])
 def execute(db,fn):
  try:result=fn();db.commit();return result
  except BekovichError as error:db.rollback();raise HTTPException(error.status,str(error))
 @router.get('')
 def get_state(user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:state(db,user.id))
 @router.post('/badges/lookup')
 def badges(body:BadgeLookupIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:public_badges(db,body.ids))
 @router.get('/findings')
 def findings(user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:dict(**items_page(db,user.id),worn=equipped_badge(db,user.id),credits=credits(db,user.id)))
 @router.get('/items')
 def more_items(before:str,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:items_page(db,user.id,before))
 @router.post('/quote')
 def get_quote(body:QuoteIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:quote(db,user.id,body.discs))
 @router.post('/accept')
 def do_accept(body:AcceptIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:accept(db,user.id,body.offer_id,body.discs,body.request_id))
 @router.post('/items/{identity}/{action}')
 def action(identity:str,action:Literal['open','read','wear'],user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:item_action(db,user.id,identity,action))
 return router
