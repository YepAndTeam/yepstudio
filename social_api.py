from fastapi import APIRouter,Depends,HTTPException,BackgroundTasks
from pydantic import BaseModel,Field
from database import User
from social_models import SocialPresence
from social_service import change_friend,heartbeat,friend_state,search_players,invite_friend
from widget_service import WidgetError
class PresenceIn(BaseModel):
 active:bool=True
class PrivacyIn(BaseModel):visible:bool
class FriendInviteIn(BaseModel):
 kind:str=Field(pattern='^(chess|checkers)$')
 request_id:str=Field(pattern='^[a-f0-9]{32}$')

def make_social_router(get_user,get_db,deliver):
 router=APIRouter(prefix='/api')
 @router.get('/friends')
 def listing(user=Depends(get_user),db=Depends(get_db)):return friend_state(db,user.id)
 @router.get('/friends/search')
 def search(q:str='',user=Depends(get_user),db=Depends(get_db)):return {'players':search_players(db,user.id,q)}
 @router.get('/friends/player/{target}')
 def player(target:int,user=Depends(get_user),db=Depends(get_db)):
  row=db.get(User,target)
  if not row:raise HTTPException(404,'Игрок не найден')
  return {'id':row.id,'name':row.first_name,'username':row.username}
 @router.post('/friends/{target}/invite-game')
 def invite(target:int,body:FriendInviteIn,bg:BackgroundTasks,user=Depends(get_user),db=Depends(get_db)):
  try:
   row,delivery=invite_friend(db,user.id,target,body.kind,body.request_id);result={'id':row.id,'status':row.status,'delivery':row.delivery};db.commit()
   if delivery:bg.add_task(deliver,delivery)
   return result
  except WidgetError as e:raise HTTPException(409,str(e))
 @router.post('/friends/{target}/{action}')
 def change(target:int,action:str,user=Depends(get_user),db=Depends(get_db)):
  if action not in ('request','accept','remove'):raise HTTPException(404)
  try:
   change_friend(db,user.id,target,action);result=friend_state(db,user.id);db.commit();return result
  except WidgetError as e:raise HTTPException(409,str(e))
 @router.post('/presence')
 def ping(body:PresenceIn,user=Depends(get_user),db=Depends(get_db)):
  heartbeat(db,user.id,body.active);db.commit();return {'ok':True}
 @router.post('/presence/privacy')
 def privacy(body:PrivacyIn,user=Depends(get_user),db=Depends(get_db)):
  heartbeat(db,user.id,visible=body.visible);db.commit();return {'visible':body.visible}
 @router.get('/presence/privacy')
 def privacy_state(user=Depends(get_user),db=Depends(get_db)):
  row=db.get(SocialPresence,user.id);return {'visible':row.visible if row else True}
 return router
