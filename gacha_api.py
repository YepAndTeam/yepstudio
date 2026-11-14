from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from gacha_service import open_five_discs,buy_five_themes,unlock_five_themes,GachaError
from disc_service import DiscError
from shop_service import ShopError
class BatchIn(BaseModel):
 request_id:str=Field(pattern='^[a-f0-9]{32}$')
class BatchUnlockIn(BaseModel):
 box_id:str=Field(pattern='^[a-f0-9]{32}$')
 runes:list[str]=Field(min_length=3,max_length=3)
def make_gacha_router(get_user,get_db):
 router=APIRouter(prefix='/api/gacha')
 def execute(db,fn):
  try:result=fn();db.commit();return result
  except (GachaError,DiscError,ShopError) as error:db.rollback();raise HTTPException(error.status,str(error))
 @router.post('/dvd/open-five')
 def dvd(body:BatchIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:open_five_discs(db,user.id,body.request_id))
 @router.post('/themes/buy-five')
 def themes(body:BatchIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:buy_five_themes(db,user.id,body.request_id))
 @router.post('/themes/unlock-five')
 def unlock(body:BatchUnlockIn,user=Depends(get_user),db=Depends(get_db)):return execute(db,lambda:unlock_five_themes(db,user.id,body.box_id,body.runes))
 return router
