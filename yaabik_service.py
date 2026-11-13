"""Per-user companion only; no score, wallet, or economy writes."""
import json,math
from datetime import datetime
from sqlalchemy import select
from database import User
from disc_models import DiscShelfSlot
from yaabik_models import YaabikState

COSTS={'pet':.1,'hello':.2,'play':1}
COUNTERS={'pet':'pets','hello':'greetings','play':'games','song':'songs','stars':'stars','disc':'discs','tap':'taps','grumble':'grumbles','rest':'rests'}
SKINS={'classic','mint','sunset'}
ROOMS={'theme','studio','night'}
class YaabikError(ValueError):pass

def timestamp(now):return (now-datetime(1970,1,1)).total_seconds()*1000

def charge(data,now):
    battery=data['battery'];at=timestamp(now)
    if battery['docked']:battery['level']=min(100,battery['level']+max(0,at-battery['updatedAt'])/60000*5)
    battery['updatedAt']=at
    if battery['level']<=0:battery['docked']=True

def owned_slots(db,uid):
    return {slot.instance_id:slot.disc_id for slot in db.scalars(select(DiscShelfSlot).where(DiscShelfSlot.user_id==uid))}

def state_row(db,uid,legacy=None,now=None):
    now=now or datetime.utcnow()
    # Per-player lock serializes first import and commands from different devices.
    db.execute(select(User.id).where(User.id==uid).with_for_update()).scalar_one()
    row=db.get(YaabikState,uid)
    if row:return row,json.loads(row.data_json),False
    legacy=legacy or {};prefs=legacy.get('prefs') or {};battery=legacy.get('battery') or {};level=battery.get('level',65)
    if not isinstance(level,(int,float)) or not math.isfinite(level):level=65
    at=battery.get('updatedAt',timestamp(now))
    if not isinstance(at,(int,float)) or not math.isfinite(at):at=timestamp(now)
    data={'prefs':{'skin':prefs.get('skin') if isinstance(prefs.get('skin'),str) and prefs.get('skin') in SKINS else 'classic','room':prefs.get('room') if isinstance(prefs.get('room'),str) and prefs.get('room') in ROOMS else 'theme','sounds':prefs.get('sounds') if isinstance(prefs.get('sounds'),bool) else True},'battery':{'level':max(0,min(100,level)),'updatedAt':min(at,timestamp(now)),'docked':battery.get('docked') is True},'shelf_ids':[],'habits':{'visits':0,'disc_plays':{}},'seen':[],'last_seen':None,'last_visit':None,'revision':0}
    owned=owned_slots(db,uid)
    data['shelf_ids']=list(dict.fromkeys(x for x in legacy.get('shelf_ids',[]) if x in owned))[:5]
    row=YaabikState(user_id=uid,data_json=json.dumps(data));db.add(row);db.flush()
    return row,data,True

def snapshot(db,uid,data,now):
    charge(data,now)
    owned=owned_slots(db,uid);data['shelf_ids']=[x for x in data['shelf_ids'] if x in owned]
    counts=data['habits'].get('disc_plays',{});candidates={owned[x] for x in data['shelf_ids']}
    favorite=max(candidates,key=lambda x:(counts.get(x,0),x),default=None)
    if favorite and not counts.get(favorite):favorite=None
    result={k:data[k] for k in ('prefs','battery','shelf_ids','habits','last_seen','revision')};result.update({'server_now':timestamp(now),'favorite_disc':favorite});return result

def save(row,data):row.data_json=json.dumps(data,separators=(',',':'),ensure_ascii=False)

def open_companion(db,uid,request_id,legacy=None,now=None):
    now=now or datetime.utcnow();row,data,created=state_row(db,uid,legacy,now);charge(data,now);at=timestamp(now)
    away=max(0,at-data['last_seen']) if data['last_seen'] else None
    if request_id not in data['seen']:
        if data['last_visit'] is None or at-data['last_visit']>=900000:
            data['habits']['visits']+=1;data['last_visit']=at
        data['last_seen']=at;data['seen']=(data['seen']+[request_id])[-128:];data['revision']+=1
    result=snapshot(db,uid,data,now);result.update({'away_ms':away,'first_visit':created});save(row,data);return result

def apply_actions(db,uid,commands,now=None):
    now=now or datetime.utcnow();row,data,_=state_row(db,uid,now=now);charge(data,now);owned=None
    for command in commands:
        cid=command['id'];kind=command['kind'];value=command.get('value')
        if cid in data['seen']:continue
        if kind=='prefs':
            if not isinstance(value,dict):raise YaabikError('Некорректные настройки')
            if 'skin' in value:
                if not isinstance(value['skin'],str) or value['skin'] not in SKINS:raise YaabikError('Неизвестный корпус')
                data['prefs']['skin']=value['skin']
            if 'room' in value:
                if not isinstance(value['room'],str) or value['room'] not in ROOMS:raise YaabikError('Неизвестная комната')
                data['prefs']['room']=value['room']
            if 'sounds' in value:
                if not isinstance(value['sounds'],bool):raise YaabikError('Некорректный звук')
                data['prefs']['sounds']=value['sounds']
        elif kind=='shelf':
            if not isinstance(value,list) or len(value)>5 or any(not isinstance(x,str) or len(x)>64 for x in value) or len(set(value))!=len(value):raise YaabikError('На полке до пяти разных дисков')
            owned=owned if owned is not None else owned_slots(db,uid)
            if any(x not in owned for x in value):raise YaabikError('Можно выбрать только свои запечатанные диски')
            data['shelf_ids']=value
        elif kind=='dock':
            if not isinstance(value,bool):raise YaabikError('Некорректная зарядка')
            data['battery']['docked']=value or data['battery']['level']<=0
            if value:data['habits']['docks']=min(1000000,data['habits'].get('docks',0)+1)
        elif kind in COUNTERS:
            allowed=not data['battery']['docked'] or kind in ('rest','tap','grumble')
            if allowed:
                count=COUNTERS[kind];data['habits'][count]=min(1000000,data['habits'].get(count,0)+1)
                data['battery']['level']=max(0,data['battery']['level']-COSTS.get(kind,0))
                if data['battery']['level']<=0:data['battery']['docked']=True
                if kind=='disc':
                    owned=owned if owned is not None else owned_slots(db,uid)
                    if value not in data['shelf_ids'] or value not in owned:raise YaabikError('Диска нет на полке Яабика')
                    disc=owned[value];plays=data['habits']['disc_plays'];plays[disc]=min(1000000,plays.get(disc,0)+1)
        else:raise YaabikError('Неизвестное действие')
        data['seen']=(data['seen']+[cid])[-128:];data['revision']+=1;data['last_seen']=timestamp(now)
    result=snapshot(db,uid,data,now);save(row,data);return result
