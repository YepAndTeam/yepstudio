"""Server-owned social game state. Pure functions; injected clock/random for tests."""
import copy,random
from collections import Counter
from bunker_characters import deal_characters
from party_catalog import SCENARIOS,TRAITS,ROLE_LABELS,TRAIT_LABELS
class PartyError(ValueError):pass
DURATIONS={'night':45,'discussion':120,'vote':45,'runoff':30,'reveal':40,'last_words':30}

def log(s,text):
 s['log'].append({'text':text,'day':s['day']});s['log']=s['log'][-80:]
def player(s,uid):
 p=next((p for p in s['players'] if p['id']==uid),None)
 if not p:raise PartyError('Сначала войди в комнату')
 return p
def living(s):return [p for p in s['players'] if p['alive']]
def phase(s,name,now):
 s['phase']=name;s['deadline']=now+s.get('timings',{}).get(name,DURATIONS.get(name,60));s['votes']={};s['actions']={}
def new_room(kind,uid,name,now,public=True,capacity=10,seats=1):
 if kind not in ('mafia','bunker'):raise PartyError('Неизвестная игра')
 if not 4<=capacity<=12 or not 1<=seats<capacity:raise PartyError('Неверный размер комнаты')
 s={'kind':kind,'host':uid,'status':'lobby','phase':'lobby','day':0,'deadline':None,'public':public,'capacity':capacity,'seats':seats,'players':[],'votes':{},'actions':{},'log':[],'messages':[],'seen':[],'created':now,'winner':None}
 join(s,uid,name,'classic','dark');return s

def join(s,uid,name,skin,theme):
 if any(p['id']==uid for p in s['players']):return
 if s['status']!='lobby':raise PartyError('Партия уже началась')
 if len(s['players'])>=s['capacity']:raise PartyError('Комната заполнена')
 s['players'].append({'id':uid,'name':name[:60],'skin':skin,'theme':theme,'alive':True,'role':None,'traits':{},'revealed':[]})

def start(s,uid,now,rng):
 if uid!=s['host']:raise PartyError('Начать может создатель комнаты')
 if s['status']!='lobby' or len(s['players'])<4:raise PartyError('Для старта нужно от 4 игроков')
 if s['kind']=='bunker' and s['seats']>=len(s['players']):raise PartyError('Участников должно быть больше, чем мест в убежище')
 s['status']='active';s['day']=1
 if s['kind']=='mafia':
  count=len(s['players']);mafia=max(1,count//4)
  roles=['mafia']*mafia
  if count>=6:roles+=['detective','doctor']
  roles+=['civilian']*(count-len(roles));rng.shuffle(roles)
  for p,role in zip(s['players'],roles):p['role']=role
  phase(s,'night',now);log(s,'Яабик-сценарист: город засыпает. Проверь свою тайную роль.')
 else:
  s['scenario']=copy.deepcopy(rng.choice(SCENARIOS))
  for p,traits in zip(s['players'],deal_characters(len(s['players']),rng)):p['traits']=traits;p['revealed']=['profession']
  phase(s,'discussion',now);log(s,'Яабик-сценарист: двери закрыты. Представьтесь: ваши профессии уже на столе.')

def finish(s,winner):
 s['status']='finished';s['phase']='finished';s['deadline']=None;s['winner']=winner;s['votes']={};s['actions']={};log(s,'Яабик-сценарист: '+('победили мирные жители.' if winner=='civilian' else 'город остался за мафией.' if winner=='mafia' else 'совет завершён. Места в убежище распределены.'))
def check_end(s):
 alive=living(s)
 if s['kind']=='bunker':
  if len(alive)<=s['seats']:finish(s,'survivors');return True
 else:
  maf=sum(p['role']=='mafia' for p in alive)
  if maf==0:finish(s,'civilian');return True
  if maf>=len(alive)-maf:finish(s,'mafia');return True
 return False

def begin_last_words(s,p,next_phase,now,advance_day=False):
 p['last_words_used']=False
 phase(s,'last_words',now)
 s['last_words_id']=p['id'];s['after_last_words']=next_phase;s['last_words_advance_day']=advance_day
 s.pop('candidates',None)
 log(s,f"Яабик-сценарист: {p['name']}, у тебя 30 секунд на одно последнее сообщение.")

def tally(values):
 counts=Counter(values)
 if not counts:return []
 high=max(counts.values());return sorted(k for k,v in counts.items() if v==high)

def choose_reveal(s,rng):
 alive=living(s)
 available=[key for p in alive for key in p['traits'] if key not in p['revealed']]
 common=[key for key in dict.fromkeys(available) if all(key in p['traits'] and key not in p['revealed'] for p in alive)]
 key=rng.choice(common or list(dict.fromkeys(available))) if available else None
 s['reveal_trait']=key
 if key:log(s,'Яабик-сценарист: откройте карточку «'+TRAIT_LABELS.get(key,key)+'». У всех один раздел. Чтение остальных карт не раскрывает их совету.')
 else:log(s,'Все характеристики уже раскрыты. Совет продолжает обсуждение.')
 return key

def night_turn(s,now):
 if s['phase']!='night':return None
 remaining=s['deadline']-now
 return 'mafia' if remaining>30 else 'detective' if remaining>15 else 'doctor'

def advance(s,now,rng):
 if s['status']!='active' or now<s['deadline']:return False
 old=s['phase']
 if old=='last_words':
  next_phase=s.pop('after_last_words','discussion');advance_day=s.pop('last_words_advance_day',False)
  s.pop('last_words_id',None)
  pending=s.get('pending_night_victims',[])
  if pending:
   victim=player(s,pending.pop(0));begin_last_words(s,victim,'discussion',now);return True
  s.pop('pending_night_victims',None)
  if not check_end(s):
   if advance_day:s['day']+=1
   phase(s,next_phase,now)
   log(s,'Последнее слово завершено. '+('Город засыпает.' if next_phase=='night' else 'Обсуждение продолжается.'))
  return True
 if old=='night':
  acts=s['actions'];attacks=[a['target'] for uid,a in acts.items() if player(s,int(uid))['role']=='mafia']
  targets=tally(attacks);target=targets[0] if len(targets)==1 else None
  protected={a['target'] for uid,a in acts.items() if player(s,int(uid))['role']=='doctor'}
  shots=([target] if target is not None else [])+[a['target'] for uid,a in acts.items() if player(s,int(uid))['role']=='detective' and a.get('mode')=='shoot']
  victims=[]
  for uid in dict.fromkeys(shots):
   p=player(s,uid)
   if uid not in protected and p['alive']:
    p['alive']=False;victims.append(uid);log(s,f"Ночь закончилась. {p['name']} покидает стол. Роль: {ROLE_LABELS[p['role']]}." )
  if victims:
   s['pending_night_victims']=victims[1:];begin_last_words(s,player(s,victims[0]),'discussion',now);return True
  log(s,'Ночь закончилась. Все вернулись к столу.')
  if not check_end(s):phase(s,'discussion',now)
 elif old in ('discussion','reveal'):
  if old=='reveal':
   for p in living(s):
    hidden=[k for k in p['traits'] if k not in p['revealed']]
    required=s.get('reveal_trait')
    if required:
     if required in hidden and str(p['id']) not in s['actions']:p['revealed'].append(required)
    elif hidden and str(p['id']) not in s['actions']:p['revealed'].append(hidden[0])
   s.pop('reveal_trait',None)
   phase(s,'discussion',now)
  else:phase(s,'vote',now);log(s,'Голосование открыто. Выберите, кто покинет стол.')
 elif old in ('vote','runoff'):
  candidates=tally(s['votes'].values())
  if len(candidates)>1 and old=='vote':
   phase(s,'runoff',now);s['candidates']=candidates;log(s,'Ничья. Повторное голосование только между кандидатами.');return True
  if len(candidates)==1:
   p=player(s,candidates[0]);p['alive']=False
   text=f"Решением совета {p['name']} покидает стол."
   if s['kind']=='mafia':text+=' Роль: '+ROLE_LABELS[p['role']]+'.'
   log(s,text)
   if s['kind']=='mafia':begin_last_words(s,p,'night',now,True);return True
  else:log(s,'Решения нет. Никто не исключён.')
  s.pop('candidates',None)
  if not check_end(s):
   s['day']+=1
   phase(s,'night' if s['kind']=='mafia' else 'reveal',now)
   if s['kind']=='bunker':
    if s['day']==2:log(s,s['scenario']['event'])
    if not choose_reveal(s,rng):phase(s,'discussion',now)
 return True

def act(s,uid,kind,value,now,rng=None):
 rng=rng or random.SystemRandom();p=player(s,uid)
 if kind=='start':start(s,uid,now,rng);return
 if kind=='leave':
  if s['status']=='active':
   if not p['alive']:return
   p['alive']=False
   log(s,p['name']+' покидает партию.'+(' Роль: '+ROLE_LABELS[p['role']]+'.' if s['kind']=='mafia' else ''))
   s['votes'].pop(str(uid),None);s['actions'].pop(str(uid),None)
   s['votes']={k:v for k,v in s['votes'].items() if v!=uid}
   s['actions']={k:v for k,v in s['actions'].items() if v.get('target')!=uid}
   if s['phase']!='last_words':check_end(s)
   return
  if s['status']!='lobby':return
  s['players'].remove(p)
  if s['players'] and uid==s['host']:s['host']=s['players'][0]['id']
  if not s['players']:s['status']='cancelled';s['phase']='cancelled'
  return
 if s['status']!='active':raise PartyError('Партия не активна')
 if not p['alive']:raise PartyError('Ты наблюдаешь за партией')
 if kind=='vote':
  if s['phase'] not in ('vote','runoff'):raise PartyError('Голосование ещё не открыто')
  target=player(s,value)
  if not target['alive'] or value==uid:raise PartyError('Выбери другого участника за столом')
  if s['phase']=='runoff' and value not in s.get('candidates',[]):raise PartyError('Выбери одного из кандидатов')
  s['votes'][str(uid)]=value;return
 if kind=='reveal':
  if s['kind']!='bunker' or s['phase']!='reveal' or value not in p['traits']:raise PartyError('Сейчас нельзя раскрыть эту карточку')
  if s.get('reveal_trait') and value!=s['reveal_trait']:raise PartyError('Сценарист просит открыть: '+TRAIT_LABELS.get(s['reveal_trait'],s['reveal_trait']))
  if str(uid) in s['actions']:raise PartyError('Карточка в этом раунде уже раскрыта')
  if value in p['revealed']:raise PartyError('Эта карточка уже открыта')
  p['revealed'].append(value);s['actions'][str(uid)]={'revealed':value};return
 if kind in ('night','night_kill'):
  if s['kind']!='mafia' or s['phase']!='night' or p['role']=='civilian':raise PartyError('Нет ночного действия')
  if now>=s['deadline'] or night_turn(s,now)!=p['role']:raise PartyError('Сейчас ход другой ночной роли')
  if kind=='night_kill' and p['role']!='detective':raise PartyError('Выстрел доступен комиссару')
  if p['role']=='detective' and str(uid) in s['actions']:raise PartyError('Действие этой ночью уже выполнено')
  target=player(s,value)
  if not target['alive'] or (value==uid and p['role']!='doctor') or (p['role']=='mafia' and target['role']=='mafia'):raise PartyError('Недопустимая цель')
  s['actions'][str(uid)]={'target':value,'mode':'shoot' if kind=='night_kill' else 'check' if p['role']=='detective' else 'heal' if p['role']=='doctor' else 'shoot'}
  if p['role']=='detective' and kind=='night':p['investigation']={'day':s['day'],'target':value,'mafia':target['role']=='mafia'}
  return
 raise PartyError('Неизвестное действие')

def chat(s,uid,text,now):
 p=player(s,uid);text=text.strip()
 if not text or len(text)>500:raise PartyError('Сообщение: от 1 до 500 символов')
 last_words=s['status']=='active' and s['kind']=='mafia' and s['phase']=='last_words'
 final=last_words and not p['alive'] and s.get('last_words_id')==uid and not p.get('last_words_used',False) and now<s['deadline']
 if last_words and not final:raise PartyError('Сейчас последнее слово другого игрока или твоё сообщение уже отправлено')
 if not final and now-p.get('last_chat',-100)<2:raise PartyError('Подожди пару секунд')
 if not final and s['status']=='active' and (not p['alive'] or s['phase']=='night'):raise PartyError('Во время ночи и для выбывших чат доступен только для чтения')
 if s['status']=='cancelled':raise PartyError('Комната закрыта')
 p['last_chat']=now;s['messages'].append({'id':s.get('message_seq',0)+1,'uid':uid,'name':p['name'],'text':text,'at':now,'last_words':bool(final)});
 if final:p['last_words_used']=True
 s['message_seq']=s['messages'][-1]['id'];s['messages']=s['messages'][-100:]

def view(s,uid,now):
 me=next((p for p in s['players'] if p['id']==uid),None)
 if me is None and not s['public']:raise PartyError('Закрытая комната')
 result={k:copy.deepcopy(s[k]) for k in ('kind','host','status','phase','day','deadline','capacity','seats','log','messages','winner','public')}
 result['reveal_trait']=s.get('reveal_trait') if s['phase']=='reveal' else None
 result['night_turn']=night_turn(s,now)
 result['night_turn_deadline']=(s['deadline']-(30 if result['night_turn']=='mafia' else 15 if result['night_turn']=='detective' else 0)) if result['night_turn'] else None
 result['my_action_kind']=s['actions'].get(str(uid),{}).get('mode')
 result['last_words_player_id']=s.get('last_words_id') if s['phase']=='last_words' else None
 result['can_send_last_words']=bool(me and not me['alive'] and s['kind']=='mafia' and s['status']=='active' and s['phase']=='last_words' and s.get('last_words_id')==uid and not me.get('last_words_used',False) and now<s['deadline'])
 result['timings']=copy.deepcopy(s.get('timings',{}))
 result.update({'server_now':now,'players':[],'scenario':s.get('scenario'),'candidates':s.get('candidates',[]),'my_vote':s['votes'].get(str(uid)),'my_action':str(uid) in s['actions'],'votes_cast':len(s['votes'])})
 for p in s['players']:
  own=p['id']==uid;public_role=s['status']=='finished' or not p['alive']
  q={k:p[k] for k in ('id','name','skin','theme','alive')}
  q['role']=p['role'] if own or public_role else None
  q['traits']={k:v for k,v in p['traits'].items() if own or k in p['revealed'] or s['status']=='finished'};q['revealed']=p['revealed'][:]
  if own:
   q['investigation']=copy.deepcopy(p.get('investigation'))
   if p['role']=='mafia':q['allies']=[x['id'] for x in s['players'] if x['role']=='mafia']
  result['players'].append(q)
 return result
