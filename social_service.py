from datetime import datetime,timedelta
from sqlalchemy import select,or_,func,case
from database import User,Notification,Meta
from social_models import Friendship,SocialPresence
from widget_service import lock_widgets,WidgetError,create_invitation
from widget_models import BoardWidgetSession,BoardInvitation

def pair(uid,target):
 if uid==target:raise WidgetError('Нельзя добавить себя в друзья')
 return tuple(sorted((uid,target)))

def change_friend(db,uid,target,action,now=None):
 now=now or datetime.utcnow();lock_widgets(db);key=pair(uid,target)
 if not db.get(User,target):raise WidgetError('Игрок не найден')
 row=db.get(Friendship,key)
 if action=='request':
  if row:return row.status
  cooldown=db.get(Meta,'friend_send:'+str(uid))
  if cooldown and now-datetime.fromisoformat(cooldown.value)<timedelta(seconds=10):raise WidgetError('Подожди 10 секунд перед следующей заявкой')
  db.merge(Meta(key='friend_send:'+str(uid),value=now.isoformat()))
  recent=db.scalar(select(func.count()).select_from(Friendship).where(Friendship.requested_by==uid,Friendship.status=='pending'))
  if recent>=20:raise WidgetError('У тебя уже 20 ожидающих заявок')
  row=Friendship(low_id=key[0],high_id=key[1],requested_by=uid,status='pending',created_at=now);db.add(row)
  sender=db.get(User,uid);db.add(Notification(user_id=target,kind='friend',text=sender.first_name+' хочет добавить тебя в друзья',ref='friends'))
 elif action=='accept':
  if not row or row.requested_by==uid:raise WidgetError('Принять можно только входящую заявку')
  if row.status!='accepted':
   row.status='accepted';db.add(Notification(user_id=target,kind='friend',text=db.get(User,uid).first_name+' принял заявку в друзья',ref='friends'))
 elif action=='remove':
  if row:db.delete(row)
 else:raise WidgetError('Неизвестное действие')
 db.flush();return row.status if row and action!='remove' else 'none'

def heartbeat(db,uid,active=True,visible=None,now=None):
 now=now or datetime.utcnow();values={'user_id':uid,'last_seen':now,'active':active}
 if visible is not None:values['visible']=visible
 if db.bind.dialect.name=='postgresql':from sqlalchemy.dialects.postgresql import insert
 else:from sqlalchemy.dialects.sqlite import insert
 updates={k:v for k,v in values.items() if k!='user_id'}
 db.execute(insert(SocialPresence).values(**values).on_conflict_do_update(index_elements=['user_id'],set_=updates))

def friend_state(db,uid,now=None):
 now=now or datetime.utcnow();other=case((Friendship.low_id==uid,Friendship.high_id),else_=Friendship.low_id)
 rows=db.execute(select(Friendship,User,SocialPresence).join(User,User.id==other).outerjoin(SocialPresence,SocialPresence.user_id==User.id).where(or_(Friendship.low_id==uid,Friendship.high_id==uid)).order_by(User.first_name,User.id)).all()
 result={'friends':[],'incoming':[],'outgoing':[]}
 for relation,user,presence in rows:
  accepted=relation.status=='accepted'
  online=bool(accepted and presence and presence.visible and presence.active and presence.last_seen>=now-timedelta(seconds=90))
  item={'id':user.id,'name':user.first_name,'username':user.username,'online':online}
  result['friends' if accepted else 'outgoing' if relation.requested_by==uid else 'incoming'].append(item)
 result['friends'].sort(key=lambda u:(not u['online'],u['name']))
 own=db.get(SocialPresence,uid);result['show_online']=own.visible if own else True
 return result

def search_players(db,uid,query):
 query=query.strip().lstrip('@')[:50]
 if len(query)<2:return []
 # Escape wildcard characters: a search is a name fragment, not a table dump.
 value='%'+query.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
 users=db.scalars(select(User).where(User.id!=uid,or_(User.first_name.ilike(value,escape='\\'),User.username.ilike(value,escape='\\'))).order_by(User.first_name,User.id).limit(20)).all()
 return [{'id':u.id,'name':u.first_name,'username':u.username} for u in users]

def invite_friend(db,uid,target,kind,request_id):
 lock_widgets(db)
 friendship=db.get(Friendship,pair(uid,target))
 if not friendship or friendship.status!='accepted':raise WidgetError('Сначала нужно стать друзьями')
 sid='f'+request_id;source=db.get(BoardWidgetSession,sid)
 if source:
  invitation=db.get(BoardInvitation,source.invitation_id)
  if source.user_id!=uid or not invitation or (invitation.recipient_id,invitation.kind)!=(target,kind):raise WidgetError('Запрос уже использован')
  return invitation,None
 invitation=create_invitation(db,uid,target,kind)
 db.add(BoardWidgetSession(id=sid,user_id=uid,chat_id=uid,kind=kind,invitation_id=invitation.id,page=0))
 db.flush();return invitation,invitation.id
