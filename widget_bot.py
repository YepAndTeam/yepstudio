"""Bot API 10.4 bridge; raw API calls keep compatibility with aiogram 3.22."""
import asyncio,json,logging
from pathlib import Path
from datetime import datetime
from sqlalchemy import select
from widget_models import BoardWidgetSession,BoardInvitation,BotContact
from widget_service import enroll,new_session,session_view,handle_action,lock_widgets,WidgetError

HTML=(Path(__file__).parent/'widgets/board.html').read_text(encoding='utf-8')
APP_LINK='https://t.me/yab_studio_bot'

def packed(value):
 data=json.dumps(value,ensure_ascii=False,separators=(',',':'))
 if len(data.encode())>1024:raise WidgetError('Слишком много данных для виджета')
 return data

def with_link(state):
 if state.get('screen')=='main':state={**state,'app_link':APP_LINK}
 if state.get('game_id'):state={**state,'link':APP_LINK+'?startapp=game_'+state['kind']+'_'+str(state['game_id'])}
 return state

async def api_call(bot,method,payload):
 import aiohttp
 # Never include the token-bearing URL in an exception or application logs.
 try:
  async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as client:
   async with client.post('https://api.telegram.org/bot'+bot.token+'/'+method,json=payload) as response:
    data=await response.json()
    if not data.get('ok'):
     description=str(data.get('description','')).replace(bot.token,'[redacted]')[:180]
     logging.getLogger(__name__).warning('Widget API %s rejected: %s',method,description)
     raise WidgetError('Telegram не принял запрос виджета')
    return data['result']
 except WidgetError:raise
 except Exception:raise WidgetError('Telegram временно недоступен') from None

async def in_db(sessions,fn):
 def run():
  with sessions.begin() as db:return fn(db)
 return await asyncio.to_thread(run)

async def send_session(bot,sessions,session_id):
 def prepare(db):
  row=db.get(BoardWidgetSession,session_id)
  return row.chat_id,with_link(session_view(db,row))
 chat_id,state=await in_db(sessions,prepare)
 result=await api_call(bot,'sendWidget',{'chat_id':chat_id,'html':HTML,'chat_data':packed(state),'allow_queries':True,'caption':'YAB STUDIO' if state.get('screen')=='main' else 'YAB STUDIO · Партия с другом'})
 await in_db(sessions,lambda db:setattr(db.get(BoardWidgetSession,session_id),'message_id',result['message_id']))

async def start_widget(bot,sessions,user,admin=False):
 def create(db):
  enroll(db,user.id,user.first_name,user.username,admin)
  return new_session(db,user.id,menu=True).id
 session_id=await in_db(sessions,create)
 await send_session(bot,sessions,session_id)

async def update_sessions(bot,sessions,session_id):
 def prepare(db):
  row=db.get(BoardWidgetSession,session_id)
  rows=db.scalars(select(BoardWidgetSession).where(BoardWidgetSession.invitation_id==row.invitation_id)).all() if row.invitation_id else [row]
  return [(s.chat_id,s.message_id,packed(with_link(session_view(db,s)))) for s in rows if s.message_id]
 for chat_id,message_id,state in await in_db(sessions,prepare):
  try:await api_call(bot,'editMessageWidgetData',{'chat_id':chat_id,'message_id':message_id,'chat_data':state})
  except WidgetError:logging.getLogger(__name__).warning('Widget state update failed; user may refresh')

async def deliver_invitation(bot,sessions,invitation_id):
 def claim(db):
  lock_widgets(db);inv=db.get(BoardInvitation,invitation_id)
  if inv.status=='pending' and datetime.utcnow()>=inv.expires_at:inv.status='expired'
  if inv.status!='pending' or inv.delivery!='queued':return None
  inv.delivery='sending';inv.delivery_started_at=datetime.utcnow();row=new_session(db,inv.recipient_id);row.invitation_id=inv.id
  return row.id
 sid=await in_db(sessions,claim)
 if not sid:return
 try:
  await send_session(bot,sessions,sid)
  await in_db(sessions,lambda db:setattr(db.get(BoardInvitation,invitation_id),'delivery','sent'))
 except WidgetError:
  await in_db(sessions,lambda db:setattr(db.get(BoardInvitation,invitation_id),'delivery','failed'))

async def handle_widget_query(bot,sessions,query):
 uid=query.get('from',{}).get('id');chat=query.get('chat',{})
 try:
  if not uid or chat.get('type')!='private' or chat.get('id')!=uid:raise WidgetError('Виджет доступен только в личном чате с ботом')
  def process(db):
   state,delivery=handle_action(db,uid,chat['id'],query.get('message_id'),query['id'],query.get('data',''))
   session=db.scalar(select(BoardWidgetSession).where(BoardWidgetSession.chat_id==uid,BoardWidgetSession.message_id==query['message_id']))
   return with_link(state),delivery,session.id
  state,delivery,sid=await in_db(sessions,process)
  try:await api_call(bot,'answerWidgetQuery',{'widget_query_id':query['id'],'data':packed(state)})
  except WidgetError:logging.getLogger(__name__).warning('Widget acknowledgement failed; saved action retained')
  if delivery:await deliver_invitation(bot,sessions,delivery)
  await update_sessions(bot,sessions,sid)
 except WidgetError as error:
  try:await api_call(bot,'answerWidgetQuery',{'widget_query_id':query['id'],'data':packed({'error':str(error)})})
  except WidgetError:logging.getLogger(__name__).warning('Widget query answer failed')
