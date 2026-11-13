"""Race accounting, scheduling and chat. All mutations share the wallet lock."""
import calendar,json,secrets
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import select,func,delete,update,or_,and_
from database import User,JeraTx,Meta,ThemeBoxPurchase,Tournament,Notification
from race_models import RaceMeeting,Race,RaceBet,RaceFund,RaceFundTx,RaceFundTopUp,RaceShopFunding,RaceTournamentFunding,RaceChat,RaceReminder
from race_fairness import CHAIN,ALGORITHM,canonical,commitment,round_at,round_timestamp,draw,verify_beacon
from score_service import lock_scores
from weekly import grant
HORSES=[('Сакура','#ec85a0'),('Турбо','#65b7d0'),('Пломбир','#d8d2b1'),('Комета','#a88ad6'),('Ветер','#83bc80'),('Искра','#dc9a53'),('Тень','#818ba4'),('Пиксель','#b6cc5b'),('Молния','#d5c66b'),('Бублик','#a17c60')]
WEIGHTS=[7500,1000,500,300,200,150,120,100,80,50]
class RaceError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

def fund(db):
 row=db.get(RaceFund,1)
 if row is None:row=RaceFund(id=1,balance=0);db.add(row);db.flush()
 return row

def fund_move(db,amount,reason):
 if db.scalar(select(RaceFundTx.id).where(RaceFundTx.reason==reason)) is not None:return False
 wallet=fund(db)
 if wallet.balance+amount<0:raise RaceError(409,'В резерве недостаточно Йер')
 wallet.balance+=amount;db.add(RaceFundTx(amount=amount,reason=reason));db.flush();return True

def reserve(db):return db.scalar(select(func.coalesce(func.sum(Race.reserved),0)).where(Race.status=='scheduled')) or 0

def treasury(db):
 wallet=db.get(RaceFund,1);balance=wallet.balance if wallet else 0;held=reserve(db)
 return {'balance':balance,'reserved':held,'available':balance-held}

def enabled(db):return db.scalar(select(Meta.value).where(Meta.key=='races_enabled'))=='1'

def schedule_times(db):
 value=db.scalar(select(Meta.value).where(Meta.key=='races_schedule'))
 return json.loads(value) if value else ['12:00','20:00']

def slot_root(day,value):
 hour,minute=map(int,value.split(':'))
 return datetime.combine(day,datetime.min.time())+timedelta(hours=hour-5,minutes=minute)

def next_slot(db,root):
 day=(root+timedelta(hours=5)).date()
 return min([slot_root(day,t) for t in schedule_times(db) if slot_root(day,t)>root]+[datetime.combine(day+timedelta(days=1),datetime.min.time())-timedelta(hours=5)])

def update_schedule(db,times,now=None):
 now=now or datetime.utcnow();lock_scores(db)
 if len(times)!=2 or any(not isinstance(t,str) or len(t)!=5 or t[2]!=':' or not (t[:2]+t[3:]).isascii() or not (t[:2]+t[3:]).isdigit() or int(t[:2])>23 or int(t[3:])>59 for t in times) or len(set(times))!=2:
  raise RaceError(422,'Укажи два разных времени в формате ЧЧ:ММ')
 times=sorted(times)
 if times==schedule_times(db):return times
 # Only unopened meetings without bets can be replaced.
 for meeting in db.scalars(select(RaceMeeting).where(RaceMeeting.status=='scheduled',RaceMeeting.opens_at>now)).all():
  if (meeting.root_slot+timedelta(hours=5)).strftime('%H:%M') in times:continue
  if db.scalar(select(RaceBet.id).join(Race,Race.id==RaceBet.race_id).where(Race.meeting_id==meeting.id).limit(1)):continue
  db.execute(delete(Race).where(Race.meeting_id==meeting.id));db.delete(meeting)
 revision=int(db.scalar(select(Meta.value).where(Meta.key=='races_schedule_revision')) or '0')+1
 db.merge(Meta(key='races_schedule_revision',value=str(revision)))
 db.merge(Meta(key='races_schedule',value=json.dumps(times)));db.flush();schedule(db,now)
 return times
def is_test_account(db,user):
 return not user or user.role=='admin' or db.scalar(select(JeraTx.id).where(JeraTx.user_id==user.id,JeraTx.reason.startswith('admin:test:')).limit(1)) is not None

def get_race(db,race_id):
 race=db.get(Race,race_id)
 if not race:raise RaceError(404,'Заезд не найден')
 return race

def make_race(db,root,attempt=0):
 local=root+timedelta(hours=5);race_id=f"r{local:%Y%m%d}_{local.hour}_{attempt}"
 existing=db.get(Race,race_id)
 if existing:return existing
 opening=root+timedelta(hours=attempt);closing=opening+timedelta(minutes=30);start=opening+timedelta(minutes=40)
 weights=WEIGHTS[:];secrets.SystemRandom().shuffle(weights)
 horses=[{'number':i+1,'name':name,'color':color,'weight':weights[i],'odds_bps':90000000//weights[i]} for i,(name,color) in enumerate(HORSES)]
 number=round_at(calendar.timegm((start-timedelta(seconds=30)).utctimetuple()))
 rules={'algorithm':ALGORITHM,'race_id':race_id,'opens_at':opening.isoformat()+'Z','closes_at':closing.isoformat()+'Z','starts_at':start.isoformat()+'Z','chain':CHAIN,'beacon_round':number,'horses':horses,'payout_rule':'floor(stake*odds_bps/10000)','duration_seconds':180}
 race=Race(id=race_id,root_slot=root,attempt=attempt,opens_at=opening,closes_at=closing,starts_at=start,chat_until=opening+timedelta(minutes=45),status='scheduled',rules_json=canonical(rules),commitment=commitment(rules),beacon_round=number,reserved=0)
 db.add(race);db.flush();return race

NEW_NODES=[('PRE','Предварительный заезд',0),('Q1','Четвертьфинал 1',1),('Q2','Четвертьфинал 2',1),('Q3','Четвертьфинал 3',1),('Q4','Четвертьфинал 4',1),('S1','Полуфинал 1',2),('S2','Полуфинал 2',2),('F','Финал',3)]

NODES=[('P1','Предварительный 1',0),('P2','Предварительный 2',0),('Q1','Четвертьфинал 1',1),('Q2','Четвертьфинал 2',1),('Q3','Четвертьфинал 3',1),('Q4','Четвертьфинал 4',1),('S1','Полуфинал 1',2),('S2','Полуфинал 2',2),('F','Финал',3)]

def make_match(db,meeting,node,numbers,opening,closing,start,modern=False):
 race_id=meeting.id+'_'+node
 previous=db.get(Race,race_id)
 if previous:return previous
 weights=[1000]*10 if node=='PRE' else secrets.choice([[7500,2500],[6000,4000],[5000,5000]])[:];secrets.SystemRandom().shuffle(weights)
 horses=[{'number':number,'name':HORSES[number-1][0],'color':HORSES[number-1][1],'weight':weights[i],'odds_bps':10000 if node=='PRE' else 90000000//weights[i]} for i,number in enumerate(numbers)]
 number=round_at(calendar.timegm((start-timedelta(seconds=30)).utctimetuple()))
 rules={'algorithm':ALGORITHM,'race_id':race_id,'opens_at':opening.isoformat()+'Z','closes_at':closing.isoformat()+'Z','starts_at':start.isoformat()+'Z','chain':CHAIN,'beacon_round':number,'horses':horses,'payout_rule':'floor(stake*odds_bps/10000)','duration_seconds':180,'meeting_id':meeting.id,'node_id':node}
 if modern:
  rules.update(format='knockout-v2',duration_seconds=60,winners_count=8 if node=='PRE' else 1)
  number=(calendar.timegm(start.utctimetuple())-CHAIN['genesis_time'])//CHAIN['period']+2
  rules['beacon_round']=number
 race=Race(id=race_id,root_slot=meeting.root_slot,attempt=meeting.attempt,meeting_id=meeting.id,node_id=node,opens_at=opening,closes_at=closing,starts_at=start,chat_until=meeting.chat_until,status='scheduled',rules_json=canonical(rules),commitment=commitment(rules),beacon_round=number,reserved=0)
 db.add(race);db.flush();return race

def make_meeting(db,root,attempt=0):
 local=root+timedelta(hours=5);slot=str(local.hour) if local.minute==0 else local.strftime('%H%M');mid=f"m{local:%Y%m%d}_{slot}_{attempt}"
 existing=db.scalar(select(RaceMeeting).where(RaceMeeting.root_slot==root,RaceMeeting.attempt==attempt))
 if existing:return existing
 revision=db.scalar(select(Meta.value).where(Meta.key=='races_schedule_revision'))
 if revision:mid+='v'+revision
 previous=db.get(RaceMeeting,mid)
 if previous:return previous
 opening=root+timedelta(hours=attempt)
 meeting=RaceMeeting(id=mid,root_slot=root,attempt=attempt,opens_at=opening,status='scheduled',chat_until=opening+timedelta(minutes=49))
 db.add(meeting);db.flush()
 make_match(db,meeting,'PRE',list(range(1,11)),opening,opening+timedelta(minutes=10),opening+timedelta(minutes=10),modern=True)
 return meeting

def schedule(db,now=None):
 now=now or datetime.utcnow()
 if not enabled(db):return
 day=(now+timedelta(hours=5)).date()
 for delta in (0,1):
  for value in schedule_times(db):
   root=slot_root(day+timedelta(days=delta),value)
   if root>=now or db.scalar(select(RaceMeeting.id).where(RaceMeeting.root_slot==root).limit(1)):make_meeting(db,root)

def phase_for(race,now):
 if race.status!='scheduled':return race.status
 if now<race.opens_at:return 'upcoming'
 if now<race.closes_at:return 'betting'
 if now<race.starts_at:return 'waiting'
 rules=json.loads(race.rules_json)
 return 'running' if race.result_json or (rules.get('format')=='knockout-v2' and now<race.starts_at+timedelta(seconds=rules['duration_seconds'])) else 'awaiting_proof'

def meeting_bracket(db,meeting_id,now=None,user_id=None):
 now=now or datetime.utcnow();rows={r.node_id:r for r in db.scalars(select(Race).where(Race.meeting_id==meeting_id)).all()}
 bets={b.race_id:b for b in db.scalars(select(RaceBet).where(RaceBet.race_id.in_([r.id for r in rows.values()]),RaceBet.user_id==user_id,RaceBet.status!='replaced')).all()} if user_id and rows else {}
 result=[]
 for node,title,stage in (NEW_NODES if 'PRE' in rows else NODES):
  r=rows.get(node);phase='unknown'
  if r:phase=phase_for(r,now)
  my_bet=bets.get(r.id) if r else None
  result.append({'my_bet':{'horse':my_bet.horse,'amount':my_bet.amount,'status':my_bet.status} if my_bet else None,'node':node,'title':title,'stage':stage,'id':r.id if r else None,'status':phase,'horses':json.loads(r.rules_json)['horses'] if r else [],'starts_at':r.starts_at.isoformat()+'Z' if r else None,'winner':json.loads(r.result_json)[0] if r and r.result_json else None})
 return result

def advance_meetings(db,now):
 changed=False
 for meeting in db.scalars(select(RaceMeeting).where(RaceMeeting.status=='scheduled',RaceMeeting.opens_at<=now)).all():
  races=db.scalars(select(Race).where(Race.meeting_id==meeting.id)).all();by_node={r.node_id:r for r in races}
  if 'PRE' in by_node:
   changed=advance_modern(db,meeting,by_node,now) or changed;continue
  has_bets=db.scalar(select(RaceBet.id).join(Race,Race.id==RaceBet.race_id).where(Race.meeting_id==meeting.id).limit(1)) is not None
  if now>=meeting.opens_at+timedelta(minutes=30) and not has_bets:
   changed=True
   meeting.status='skipped'
   for r in races:r.status='skipped';r.reserved=0;r.settled_at=now
   next_open=meeting.opens_at+timedelta(hours=1);local=meeting.root_slot+timedelta(hours=5)
   cutoff=next_slot(db,meeting.root_slot)
   if next_open<cutoff:make_meeting(db,meeting.root_slot,meeting.attempt+1)
   db.flush();continue
  if any(r.status=='refunded' for r in races):
   changed=True
   for r in races:refund_race(db,r,now)
   meeting.status='refunded';meeting.chat_until=now;continue
  for target,left,right in [('Q1','P1',5),('Q2','P2',6),('S1','Q1','Q2'),('S2','Q3','Q4'),('F','S1','S2')]:
   if target in by_node:continue
   def winner(node):
    if isinstance(node,int):return node
    race=by_node.get(node)
    return json.loads(race.result_json)[0] if race and race.status=='finished' else None
   a,b=winner(left),winner(right)
   if a and b:
    changed=True
    opening=now;start=opening+timedelta(minutes=15)
    r=make_match(db,meeting,target,[a,b],opening,opening+timedelta(minutes=5),start);by_node[target]=r
    meeting.chat_until=max(meeting.chat_until,start+timedelta(minutes=8))
  final=by_node.get('F')
  if final and final.status=='finished':meeting.status='finished'
  for r in races:r.chat_until=meeting.chat_until
 db.flush()
 return changed

def advance_modern(db,meeting,rows,now):
 pre=rows['PRE']
 has_bets=db.scalar(select(RaceBet.id).join(Race,Race.id==RaceBet.race_id).where(Race.meeting_id==meeting.id,RaceBet.status!='replaced').limit(1)) is not None
 if now>=pre.closes_at and not has_bets:
  meeting.status='skipped'
  for r in rows.values():r.status='skipped';r.reserved=0;r.settled_at=now
  if meeting.opens_at+timedelta(hours=1)<next_slot(db,meeting.root_slot):make_meeting(db,meeting.root_slot,meeting.attempt+1)
  db.flush();return True
 if any(r.status=='refunded' for r in rows.values()):
  for r in rows.values():refund_race(db,r,now)
  meeting.status='refunded';meeting.chat_until=now;return True
 specs=None
 if pre.status=='finished' and 'Q1' not in rows:
  qualified=json.loads(pre.result_json)[:8]
  specs=[('Q'+str(i+1),qualified[i*2:i*2+2]) for i in range(4)]
 elif all(n in rows and rows[n].status=='finished' for n in ['Q1','Q2','Q3','Q4']) and 'S1' not in rows:
  winners=[json.loads(rows[n].result_json)[0] for n in ['Q1','Q2','Q3','Q4']]
  specs=[('S1',winners[:2]),('S2',winners[2:])]
 elif all(n in rows and rows[n].status=='finished' for n in ['S1','S2']) and 'F' not in rows:
  specs=[('F',[json.loads(rows[n].result_json)[0] for n in ['S1','S2']])]
 if specs:
  start=now+timedelta(minutes=10)
  for node,numbers in specs:rows[node]=make_match(db,meeting,node,numbers,now,start,start,modern=True)
  meeting.chat_until=max(meeting.chat_until,start+timedelta(minutes=6))
 if 'F' in rows and rows['F'].status=='finished':meeting.status='finished'
 for r in rows.values():r.chat_until=meeting.chat_until
 db.flush()
 return bool(specs)

def chat_anchor(db,race):
 if not race.meeting_id:return race.id
 return db.scalar(select(Race.id).where(Race.meeting_id==race.meeting_id).order_by(Race.opens_at,Race.id).limit(1))

def meeting_bets(db,race,user_id):
 query=select(RaceBet,Race).join(Race,Race.id==RaceBet.race_id).where(RaceBet.user_id==user_id,RaceBet.status!='replaced')
 query=query.where(Race.meeting_id==race.meeting_id) if race.meeting_id else query.where(Race.id==race.id)
 result=[]
 for bet,row in db.execute(query.order_by(Race.starts_at,Race.id)).all():
  horse=next(h for h in json.loads(row.rules_json)['horses'] if h['number']==bet.horse)
  result.append({'id':bet.id,'race_id':row.id,'node_id':row.node_id,'horse':bet.horse,'name':horse['name'],'amount':bet.amount,'payout':bet.payout,'status':bet.status,'starts_at':row.starts_at.isoformat()+'Z'})
 return result

def refund_race(db,race,now):
 if race.status!='scheduled':return
 for bet in db.scalars(select(RaceBet).where(RaceBet.race_id==race.id,RaceBet.status=='pending')).all():
  fund_move(db,-bet.amount,'refund:'+bet.id);grant(db,bet.user_id,bet.amount,'race:refund:'+bet.id);bet.status='refunded'
 race.status='refunded';race.reserved=0;race.settled_at=now;db.flush()

def tick(db,now=None):
 now=now or datetime.utcnow();lock_scores(db);schedule(db,now)
 for _ in range(9):
  if not advance_meetings(db,now):break
 # bounded retries; no event is moved if any stake was accepted.
 for _ in range(9):
  changed=False
  for race in db.scalars(select(Race).where(Race.status=='scheduled',Race.closes_at<=now)).all():
   if not race.meeting_id and not db.scalar(select(RaceBet.id).where(RaceBet.race_id==race.id).limit(1)):
    race.status='skipped';race.settled_at=now;changed=True
    next_open=race.opens_at+timedelta(hours=1);root_local=race.root_slot+timedelta(hours=5)
    cutoff=datetime.combine(root_local.date(),datetime.min.time())+timedelta(hours=(20 if root_local.hour==12 else 24)-5)
    if next_open<cutoff:make_race(db,race.root_slot,race.attempt+1)
   elif now>=race.starts_at+timedelta(minutes=5) and not race.proof_json:refund_race(db,race,now)
  db.flush()
  if not changed:break
 advance_meetings(db,now)
 db.execute(delete(RaceChat).where(RaceChat.race_id.in_(select(Race.id).where(Race.chat_until<=now))))
 # Reminder is claimed before Telegram delivery: never duplicate on worker restart.
 notices=[]
 for race in db.scalars(select(Race).where(Race.status=='scheduled',Race.starts_at>now,Race.starts_at<=now+timedelta(minutes=3))).all():
  for user in db.scalars(select(User).join(RaceBet,User.id==RaceBet.user_id).where(RaceBet.race_id==race.id).distinct()).all():
   if db.get(RaceReminder,(race.id,user.id)):continue
   db.add(RaceReminder(race_id=race.id,user_id=user.id,claimed_at=now))
   text='Твой заезд начнётся менее чем через 3 минуты. Открой скачки в Студии.'
   db.add(Notification(user_id=user.id,kind='game',text=text,ref='races'))
   if user.notify:notices.append((race.id,user.id,text))
 db.flush();return notices

def accept_bet(db,user_id,race_id,horse,amount,request_id,now=None,expected_commitment=None,replaces_id=None):
 now=now or datetime.utcnow();lock_scores(db)
 previous=db.scalar(select(RaceBet).where(RaceBet.user_id==user_id,RaceBet.request_id==request_id))
 if previous:
  if expected_commitment and previous.commitment!=expected_commitment:raise RaceError(409,'Отметка правил не совпадает с исходной ставкой')
  if (previous.race_id,previous.horse,previous.amount)!=(race_id,horse,amount):raise RaceError(409,'Этот запрос уже использован для другой ставки')
  return previous
 user=db.get(User,user_id)
 if is_test_account(db,user):raise RaceError(403,'Админский тестовый баланс не участвует в ставках')
 if not enabled(db) or db.scalar(select(Meta.value).where(Meta.key=='score_maintenance'))=='1':raise RaceError(409,'Приём ставок временно закрыт')
 race=get_race(db,race_id)
 if expected_commitment and race.commitment!=expected_commitment:raise RaceError(409,'Правила пары изменились. Ставка не принята.')
 if race.status!='scheduled' or not race.opens_at<=now<race.closes_at:raise RaceError(409,'Приём ставок на этот заезд закрыт')
 if type(amount) is not int or amount<1:raise RaceError(422,'Ставка — целое число от 1 Йеры')
 current=db.scalar(select(RaceBet).where(RaceBet.race_id==race.id,RaceBet.user_id==user_id,RaceBet.status!='replaced'))
 if current and (not replaces_id or current.id!=replaces_id or current.status!='pending'):
  raise RaceError(409,'Ставка уже существует или изменилась. Открой её заново для редактирования.')
 if replaces_id and not current:raise RaceError(409,'Ставка для изменения не найдена')
 selected=next((h for h in json.loads(race.rules_json)['horses'] if h['number']==horse),None)
 if not selected:raise RaceError(422,'Лошадь не найдена')
 payout=amount*selected['odds_bps']//10000
 totals=dict(db.execute(select(RaceBet.horse,func.sum(RaceBet.payout)).where(RaceBet.race_id==race.id,RaceBet.status=='pending',RaceBet.id!=(current.id if current else '')).group_by(RaceBet.horse)).all());totals[horse]=totals.get(horse,0)+payout
 winners=json.loads(race.rules_json).get('winners_count',1)
 held=sum(sorted(totals.values(),reverse=True)[:winners]);wallet=fund(db)
 previous_amount=current.amount if current else 0
 delta=amount-previous_amount
 if amount>user.jera+previous_amount:raise RaceError(409,'Недостаточно Йер')
 if wallet.balance+delta>2147483647:raise RaceError(409,'Фонд достиг технической вместимости')
 if wallet.balance+delta-(reserve(db)-race.reserved)-held<0:raise RaceError(409,'Резерв не покрывает эту ставку. Выбери меньшую сумму или другую лошадь.')
 changed=db.execute(update(User).where(User.id==user_id,User.jera>=delta).values(jera=User.jera-delta))
 if changed.rowcount!=1:raise RaceError(409,'Недостаточно Йер')
 if current:
  current.status='replaced';db.add(JeraTx(user_id=user_id,amount=previous_amount,reason='race:refund:'+current.id));fund_move(db,-previous_amount,'replace:'+current.id)
 bet=RaceBet(id=uuid4().hex,race_id=race.id,user_id=user_id,horse=horse,amount=amount,payout=payout,status='pending',request_id=request_id,commitment=race.commitment,created_at=now)
 db.add(bet);db.add(JeraTx(user_id=user_id,amount=-amount,reason='race:bet:'+bet.id));fund_move(db,amount,'bet:'+bet.id);race.reserved=held;db.flush();return bet

def apply_beacon(db,race_id,beacon,now=None):
 now=now or datetime.utcnow();lock_scores(db);race=get_race(db,race_id)
 if race.status!='scheduled':return False
 if now<race.starts_at or (now>=race.starts_at+timedelta(minutes=5) and not race.proof_json):return False
 if commitment(json.loads(race.rules_json))!=race.commitment or not verify_beacon(beacon,race.beacon_round):raise RaceError(422,'Доказательство результата не прошло проверку')
 if round_timestamp(race.beacon_round)<=calendar.timegm(race.closes_at.utctimetuple()):raise RaceError(422,'Раунд должен появиться после закрытия ставок')
 race.proof_json=canonical(beacon);race.result_json=canonical(draw(json.loads(race.rules_json),beacon['randomness']))
 if now<race.starts_at+timedelta(seconds=json.loads(race.rules_json).get('duration_seconds',180)):db.flush();return False
 ranking=json.loads(race.result_json)
 for bet in db.scalars(select(RaceBet).where(RaceBet.race_id==race.id,RaceBet.status=='pending')).all():
  if bet.horse in ranking[:json.loads(race.rules_json).get('winners_count',1)]:
   fund_move(db,-bet.payout,'win:'+bet.id);grant(db,bet.user_id,bet.payout,'race:win:'+bet.id);bet.status='won'
  else:bet.status='lost'
 race.status='finished';race.reserved=0;race.settled_at=now;db.flush();return True

def seed_from_shop(db):
 lock_scores(db);amount=0
 test_users=select(JeraTx.user_id).where(JeraTx.reason.startswith('admin:test:'))
 for box in db.scalars(select(ThemeBoxPurchase).join(User,User.id==ThemeBoxPurchase.user_id).where(User.role!='admin',User.id.not_in(test_users),ThemeBoxPurchase.status.in_(['won','lost']))).all():
  if db.get(RaceShopFunding,box.id):continue
  value=max(0,box.price-box.refund);db.add(RaceShopFunding(box_id=box.id,amount=value));fund_move(db,value,'shop:'+box.id);amount+=value
 db.flush();return amount

def top_up_fund(db,admin_id,amount,note,request_id):
 lock_scores(db)
 admin=db.get(User,admin_id)
 if not admin or admin.role!='admin':raise RaceError(403,'Пополнять фонд может только администратор')
 note=' '.join(note.split())
 if type(amount) is not int or not 1<=amount<=100000:raise RaceError(422,'Сумма — от 1 до 100 000 Йер')
 if not 3<=len(note)<=120:raise RaceError(422,'Причина — от 3 до 120 символов')
 if not 16<=len(request_id)<=64:raise RaceError(422,'Некорректный идентификатор операции')
 previous=db.scalar(select(RaceFundTopUp).where(RaceFundTopUp.admin_id==admin_id,RaceFundTopUp.request_id==request_id))
 if previous:
  if (previous.amount,previous.note)!=(amount,note):raise RaceError(409,'Этот запрос уже использован для другого пополнения')
  return previous,False
 row=RaceFundTopUp(id=uuid4().hex,admin_id=admin_id,amount=amount,note=note,request_id=request_id)
 db.add(row);fund_move(db,amount,'mint:'+row.id);db.flush()
 return row,True

def fund_tournament(db,event_id):
 lock_scores(db);event=db.get(Tournament,event_id)
 if not event or event.status not in ('registration','active') or event.cancelled:raise RaceError(409,'Нужен открытый турнир')
 if db.get(RaceTournamentFunding,event.id):raise RaceError(409,'Турнир уже обеспечен фондом')
 amount=sum(int(v) for v in json.loads(event.prize_jera).values())+event.duplicate_prize
 if amount>treasury(db)['available']:raise RaceError(409,'Недостаточно свободного резерва')
 fund_move(db,-amount,'tour-reserve:'+event.id);db.add(RaceTournamentFunding(tournament_id=event.id,reserved=amount,closed=False));db.flush();return amount

def close_tournament_funding(db,event,paid):
 allocation=db.get(RaceTournamentFunding,event.id)
 if not allocation or allocation.closed:return
 if paid>allocation.reserved:raise RaceError(409,'Призы превышают резерв турнира')
 fund_move(db,allocation.reserved-paid,'tour-return:'+event.id);allocation.closed=True

def post_chat(db,user_id,race_id,message,now=None):
 now=now or datetime.utcnow();lock_scores(db);race=get_race(db,race_id)
 if not race.opens_at<=now<race.chat_until or race.status in ('refunded','skipped'):raise RaceError(409,'Чат заезда закрыт')
 chat_id=chat_anchor(db,race)
 message=' '.join(message.split())
 if not 1<=len(message)<=240:raise RaceError(422,'Сообщение — от 1 до 240 символов')
 last=db.scalar(select(func.max(RaceChat.created_at)).where(RaceChat.user_id==user_id))
 if last and (now-last).total_seconds()<3:raise RaceError(429,'Подожди 3 секунды перед следующим сообщением')
 db.add(RaceChat(race_id=chat_id,user_id=user_id,text=message,created_at=now));db.flush()
 keep=select(RaceChat.id).where(RaceChat.race_id==chat_id).order_by(RaceChat.id.desc()).limit(200)
 db.execute(delete(RaceChat).where(RaceChat.race_id==chat_id,RaceChat.id.not_in(keep)));db.flush()

def state(db,race,user_id,now=None):
 now=now or datetime.utcnow();rules=json.loads(race.rules_json);phase=race.status
 chat_id=chat_anchor(db,race)
 phase=phase_for(race,now)
 bets=db.scalars(select(RaceBet).where(RaceBet.race_id==race.id,RaceBet.user_id==user_id,RaceBet.status!='replaced').order_by(RaceBet.created_at)).all()
 chat=[]
 if race.opens_at<=now<race.chat_until and race.status not in ('skipped','refunded'):
  rows=db.execute(select(RaceChat,User.first_name).join(User,User.id==RaceChat.user_id).where(RaceChat.race_id==chat_id).order_by(RaceChat.id.desc()).limit(80)).all()
  chat=[{'id':m.id,'name':name,'text':m.text,'created_at':m.created_at.isoformat()+'Z'} for m,name in reversed(rows)]
 return {'id':race.id,'meeting_id':race.meeting_id,'node_id':race.node_id,'meeting_bets':meeting_bets(db,race,user_id),'bracket':meeting_bracket(db,race.meeting_id,now,user_id) if race.meeting_id else [],'status':phase,'attempt':race.attempt,'opens_at':race.opens_at.isoformat()+'Z','closes_at':race.closes_at.isoformat()+'Z','starts_at':race.starts_at.isoformat()+'Z','chat_until':race.chat_until.isoformat()+'Z','server_now':now.isoformat()+'Z','horses':rules['horses'],'commitment':race.commitment,'beacon_round':race.beacon_round,'rules':rules,'proof':json.loads(race.proof_json) if race.proof_json else None,'ranking':json.loads(race.result_json) if race.result_json else [],'chat_open':race.opens_at<=now<race.chat_until and race.status not in ('skipped','refunded'),'chat':chat,'my_bets':[{'id':b.id,'horse':b.horse,'amount':b.amount,'payout':b.payout,'status':b.status,'commitment':b.commitment} for b in bets],'pool':db.scalar(select(func.coalesce(func.sum(RaceBet.amount),0)).where(RaceBet.race_id==race.id,RaceBet.status!='replaced')) or 0}

def race_list(db,user_id,now=None):
 now=now or datetime.utcnow()
 rows=db.scalars(select(Race).where(or_(Race.status=='scheduled',and_(Race.status=='finished',Race.chat_until>now))).order_by(Race.opens_at,Race.starts_at,Race.id)).all()
 current=next((r for r in rows if r.status=='scheduled' and r.opens_at<=now<r.closes_at),None) or next((r for r in rows if r.status=='scheduled' and r.opens_at<=now<r.chat_until),None) or next((r for r in reversed(rows) if r.status=='finished' and r.chat_until>now),None) or next((r for r in rows if r.chat_until>now),None)
 past=db.scalars(select(Race).where(Race.status.in_(['finished','refunded','skipped'])).order_by(Race.opens_at.desc()).limit(30)).all()
 view=state(db,current,user_id,now) if current else None
 return {'schedule':schedule_times(db),'enabled':enabled(db),'fund':treasury(db),'current':view,'bracket':view['bracket'] if view else [],'history':[{'id':r.id,'status':r.status,'node_id':r.node_id,'starts_at':r.starts_at.isoformat()+'Z','winner':json.loads(r.result_json)[0] if r.result_json else None,'attempt':r.attempt} for r in past]}
