from typing import Literal,Optional
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from garden_service import garden_state,garden_action,GardenError
class GardenIn(BaseModel):
 request_id:str=Field(pattern='^[a-f0-9]{32}$')
 kind:Literal['plant','harvest','upgrade','buy','water','auto','sell','sell_all']
 plot:Optional[int]=Field(default=None,ge=0,le=5)
 crop:Optional[str]=Field(default=None,max_length=30)
 shop_hour:Optional[int]=Field(default=None,ge=0)
 quantity:int=Field(default=1,ge=1,le=1000000)
 auto_water:Optional[bool]=None
 variant:Literal['normal','shiny','golden']='normal'

def make_garden_router(get_user,get_db):
 router=APIRouter(prefix='/api/garden')
 @router.get('')
 def state(user=Depends(get_user),db=Depends(get_db)):
  result=garden_state(db,user.id);db.commit();return result
 @router.post('/action')
 def action(body:GardenIn,user=Depends(get_user),db=Depends(get_db)):
  try:
   result=garden_action(db,user.id,body.request_id,body.kind,body.plot,body.crop,shop_hour=body.shop_hour,quantity=body.quantity,auto_water=body.auto_water,variant=body.variant);db.commit();return result
  except GardenError as error:
   db.rollback();raise HTTPException(409,str(error))
 return router
