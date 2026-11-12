from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from disc_service import disc_state,open_disc,reveal_disc,claim_launch_gift,activate_launch_gift,DiscError

class DiscOpenIn(BaseModel):
 request_id:str=Field(min_length=32,max_length=40)

def make_disc_router(get_user,get_db):
 router=APIRouter(prefix='/api/discs',tags=['discs'])
 @router.get('')
 def state(user=Depends(get_user),db=Depends(get_db)):return disc_state(db,user.id)
 @router.post('/open')
 def open_one(body:DiscOpenIn,user=Depends(get_user),db=Depends(get_db)):
  try:
   data=open_disc(db,user.id,body.request_id);db.commit();return data
  except DiscError as error:
   db.rollback();raise HTTPException(error.status,str(error))
 @router.post('/gift/claim')
 def claim(user=Depends(get_user),db=Depends(get_db)):
  data=claim_launch_gift(db,user.id);db.commit();return data
 @router.post('/gift/activate')
 def activate(user=Depends(get_user),db=Depends(get_db)):
  try:
   data=activate_launch_gift(db,user.id);db.commit();return data
  except DiscError as error:
   db.rollback();raise HTTPException(error.status,str(error))
 @router.post('/{draw_id}/reveal')
 def reveal(draw_id:str,user=Depends(get_user),db=Depends(get_db)):
  try:
   data=reveal_disc(db,user.id,draw_id);db.commit();return data
  except DiscError as error:
   db.rollback();raise HTTPException(error.status,str(error))
 return router
