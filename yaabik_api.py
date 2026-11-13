from typing import Any,Literal,Optional
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from yaabik_service import open_companion,apply_actions,YaabikError
class LegacyIn(BaseModel):
    prefs:dict=Field(default_factory=dict)
    battery:dict=Field(default_factory=dict)
    shelf_ids:list[str]=Field(default_factory=list,max_length=5)
class OpenIn(BaseModel):
    request_id:str=Field(pattern='^[a-f0-9]{32}$')
    legacy:Optional[LegacyIn]=None
class ActionIn(BaseModel):
    id:str=Field(pattern='^[a-f0-9]{32}$')
    kind:Literal['prefs','shelf','dock','pet','hello','play','song','stars','disc','tap','grumble','rest']
    value:Any=None
class ActionsIn(BaseModel):
    commands:list[ActionIn]=Field(min_length=1,max_length=30)
def make_yaabik_router(get_user,get_db):
    router=APIRouter(prefix='/api/yaabik')
    @router.post('/open')
    def opening(body:OpenIn,user=Depends(get_user),db=Depends(get_db)):
        result=open_companion(db,user.id,body.request_id,body.legacy.model_dump() if body.legacy else None);db.commit();return result
    @router.post('/actions')
    def action(body:ActionsIn,user=Depends(get_user),db=Depends(get_db)):
        try:
            result=apply_actions(db,user.id,[c.model_dump() for c in body.commands]);db.commit();return result
        except YaabikError as error:
            db.rollback();raise HTTPException(409,str(error))
    return router
