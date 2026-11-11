"""Private-chat invitations. No Telegram I/O and no economy mutations."""
import secrets
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import select,update,delete,func
from database import User,Meta,Notification
from widget_models import BotContact,BoardInvitation,BoardWidgetSession,BoardWidgetQuery
from chess_models import ChessGame
from checkers_models import CheckersGame

class WidgetError(Exception):pass

def initialize_widget_state(sessions):
 with sessions.begin() as db:
  if db.bind.dialect.name=='postgresql':from sqlalchemy.dialects.postgresql import insert
  else:from sqlalchemy.dialects.sqlite import insert
  db.execute(insert(Meta).values(key='board_widget_lock',value='1').on_conflict_do_nothing(index_elements=['key']))

def lock_widgets(db):
 if db.execute(update(Meta).where(Meta.key=='board_widget_lock').values(value=Meta.value)).rowcount!=1:
  raise WidgetError('Виджеты ещё не готовы. Повтори /start чуть позже.')

def enroll(db,uid,name,username=None,admin=False):
 lock_widgets(db);user=db.get(User,uid)
 if not user:user=User(id=uid,first_name=name[:100],username=username);db.add(user);db.flush()
 else:user.first_name=name[:100];user.username=username
 if admin:user.role='admin'
 contact=db.get(BotContact,uid)
 if contact:contact.available=True
 else:db.add(BotContact(user_id=uid))
 db.flush();return user

def new_session(db,uid):
 row=BoardWidgetSession(id=uuid4().hex,user_id=uid,chat_id=uid,page=0)
 db.add(row);db.flush();return row

def opponents(db,uid,page):
 query=select(User).join(BotContact,BotContact.user_id==User.id).where(User.id!=uid,User.notify.is_(True),BotContact.available.is_(True)).order_by(User.first_name,User.id)
 count=db.scalar(select(func.count()).select_from(query.subquery()))
 page=max(0,min(page,max(0,(count-1)//5)))
 users=db.scalars(query.offset(page*5).limit(5)).all()
 return page,count,[{'id':u.id,'name':u.first_name[:18]} for u in users]

def invitation_view(db,session,now):
 invitation=db.get(BoardInvitation,session.invitation_id)
 status='expired' if invitation.status=='pending' and now>=invitation.expires_at else invitation.status
 delivery='failed' if invitation.delivery=='sending' and invitation.delivery_started_at and now-invitation.delivery_started_at>timedelta(seconds=60) else invitation.delivery
 other=invitation.recipient_id if session.user_id==invitation.sender_id else invitation.sender_id
 user=db.get(User,other)
 return {'screen':'invitation','kind':invitation.kind,'status':status,'delivery':delivery,'incoming':session.user_id==invitation.recipient_id,'name':user.first_name[:30] if user else 'Игрок','game_id':invitation.game_id}

def session_view(db,session,now=None):
 now=now or datetime.utcnow()
 if session.invitation_id:return invitation_view(db,session,now)
 if not session.kind:return {'screen':'choose'}
 page,count,users=opponents(db,session.user_id,session.page);session.page=page
 return {'screen':'players','kind':session.kind,'page':page,'pages':max(1,(count+4)//5),'players':users}


def create_invitation(db,uid,target,kind,now=None):
 now=now or datetime.utcnow()
 if kind not in ('chess','checkers'):raise WidgetError('Неизвестная игра')
 recipient=db.get(User,target);contact=db.get(BotContact,target)
 if target==uid or not recipient or not recipient.notify or not contact or not contact.available:raise WidgetError('Игрок недоступен для приглашений. Он должен нажать /start и включить уведомления.')
 pending=db.scalar(select(func.count()).select_from(BoardInvitation).where(BoardInvitation.sender_id==uid,BoardInvitation.status=='pending',BoardInvitation.expires_at>now))
 if pending>=3:raise WidgetError('У тебя уже три ожидающих приглашения.')
 recent=db.scalar(select(BoardInvitation.id).where(BoardInvitation.sender_id==uid,BoardInvitation.created_at>now-timedelta(seconds=30)).limit(1))
 if recent:raise WidgetError('Подожди 30 секунд перед следующим приглашением.')
 invitation=BoardInvitation(id=uuid4().hex,sender_id=uid,recipient_id=target,kind=kind,status='pending',delivery='queued',created_at=now,expires_at=now+timedelta(minutes=30))
 db.add(invitation);db.flush();return invitation

def handle_action(db,uid,chat_id,message_id,query_id,data,now=None):
 now=now or datetime.utcnow();lock_widgets(db)
 if chat_id!=uid:raise WidgetError('Открой виджет в личном чате с ботом.')
 session=db.scalar(select(BoardWidgetSession).where(BoardWidgetSession.chat_id==chat_id,BoardWidgetSession.message_id==message_id,BoardWidgetSession.user_id==uid))
 if not session:raise WidgetError('Виджет не найден. Нажми /start.')
 if len(data.encode())>64:raise WidgetError('Некорректное действие')
 previous=db.get(BoardWidgetQuery,query_id)
 if previous:
  if (previous.user_id,previous.data,previous.session_id)!=(uid,data,session.id):raise WidgetError('Запрос уже использован')
  return session_view(db,session,now),None
 delivery=None
 if data=='home':session.kind=None;session.invitation_id=None;session.page=0
 elif data.startswith('kind:'):
  kind=data.split(':',1)[1]
  if kind not in ('chess','checkers'):raise WidgetError('Неизвестная игра')
  session.kind=kind;session.invitation_id=None;session.page=0
 elif data.startswith('page:'):
  try:session.page=max(0,min(1000000,int(data.split(':',1)[1])))
  except ValueError:raise WidgetError('Некорректная страница')
 elif data.startswith('invite:'):
  if session.invitation_id:return session_view(db,session,now),None
  if session.kind not in ('chess','checkers'):raise WidgetError('Сначала выбери игру')
  try:target=int(data.split(':',1)[1])
  except ValueError:raise WidgetError('Выбери игрока')
  invitation=create_invitation(db,uid,target,session.kind,now)
  session.invitation_id=invitation.id;delivery=invitation.id
 elif data in ('accept','decline','cancel','retry'):
  invitation=db.get(BoardInvitation,session.invitation_id) if session.invitation_id else None
  if not invitation or uid not in (invitation.sender_id,invitation.recipient_id):raise WidgetError('Приглашение не найдено')
  if invitation.status=='pending' and now>=invitation.expires_at:invitation.status='expired'
  if data=='retry':
   if uid!=invitation.sender_id:raise WidgetError('Только автор может повторить отправку')
   if invitation.delivery=='sending' and invitation.delivery_started_at and now-invitation.delivery_started_at>timedelta(seconds=60):invitation.delivery='failed'
   if invitation.status=='pending' and invitation.delivery=='failed':invitation.delivery='queued';delivery=invitation.id
  elif data=='accept':
   if uid!=invitation.recipient_id:raise WidgetError('Принять может только приглашённый игрок')
   if invitation.status=='pending':
    white,black=(invitation.sender_id,uid) if secrets.randbelow(2) else (uid,invitation.sender_id)
    model=ChessGame if invitation.kind=='chess' else CheckersGame
    game=model(creator_id=invitation.sender_id,white_id=white,black_id=black,status='active',moves='')
    db.add(game);db.flush();invitation.game_id=game.id;invitation.status='accepted'
    db.add(Notification(user_id=invitation.sender_id,kind='game',text=db.get(User,uid).first_name+' принял приглашение. Партия готова в разделе игр.',ref='game'))
   elif invitation.status!='accepted':raise WidgetError('Приглашение уже закрыто или истекло')
  else:
   if data=='decline' and uid!=invitation.recipient_id or data=='cancel' and uid!=invitation.sender_id:raise WidgetError('Это действие недоступно')
   if invitation.status=='pending':invitation.status='declined' if data=='decline' else 'cancelled'
 elif data!='refresh':raise WidgetError('Неизвестное действие')
 db.add(BoardWidgetQuery(id=query_id,user_id=uid,data=data,session_id=session.id,created_at=now))
 db.execute(delete(BoardWidgetQuery).where(BoardWidgetQuery.created_at<now-timedelta(days=7)))
 db.flush();return session_view(db,session,now),delivery
