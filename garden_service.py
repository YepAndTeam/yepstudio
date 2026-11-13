"""Private greenhouse. Parts never enter the Jera economy."""
import json,hashlib,secrets
from pathlib import Path
from datetime import datetime
from sqlalchemy import select
from database import User
from garden_models import GardenState
from yaabik_models import YaabikState
from yaabik_service import timestamp
CATALOG=json.loads((Path(__file__).parent/'garden_catalog.json').read_text(encoding='utf-8'))
CROPS={c['id']:c for c in CATALOG}
VARIANTS=json.loads((Path(__file__).parent/'garden_variants.json').read_text(encoding='utf-8'))
VARIANT_MAP={v['id']:v for v in VARIANTS}
UPGRADE_COST=100
WATER_DELAY=120000
JOB_DURATION=10000
class GardenError(ValueError):pass

def variant_for_roll(roll):
 if not isinstance(roll,int) or not 0<=roll<10000:raise GardenError('Некорректный вариант урожая')
 threshold=0
 for variant in VARIANTS:
  threshold+=variant['chance']*100
  if roll<threshold:return variant['id']

def harvest_key(crop,variant='normal'):
 return crop if variant=='normal' else crop+'@'+variant

def harvest_price(crop,variant='normal'):
 multiplier=VARIANT_MAP[variant];value=CROPS[crop]['yield']*multiplier['numerator'];return (value+multiplier['denominator']//2)//multiplier['denominator']

def harvest_items(data):
 items=[]
 for key,count in data['warehouse'].items():
  if count<=0:continue
  crop,_,variant=key.partition('@');variant=variant or 'normal'
  items.append({'key':key,'crop':crop,'variant':variant,'quantity':count,'price':harvest_price(crop,variant)})
 return sorted(items,key=lambda x:(x['crop'],list(VARIANT_MAP).index(x['variant'])))

def plot_view(plant,at):
 if not plant:return None
 ready=at>=plant['ready_at'];value=dict(plant,ready=ready,needs_water=plant.get('watered_at') is None and at>=plant['water_due'] and not ready)
 value['variant']=plant.get('variant','normal') if ready else None
 return value

def water_plant(plant,at,started=None):
 plant['watered_at']=at
 effective=at if started is None else started
 plant['ready_at']=min(plant['ready_at'],max(at,plant['planted_at']+plant['base_ms']+max(0,effective-plant['water_due'])/2))

def settle_water(data,now):
 # At most six automatic beds plus one pending manual job; no background worker.
 at=timestamp(now);cursor=0
 for _ in range(8):
  job=data.get('job')
  if job:
   if job['ends_at']>at:return
   if job['kind']=='plant':
    crop=CROPS[job['crop']];start=job['ends_at'];data['plots'][job['plot']]={'crop':job['crop'],'variant':job.get('variant','normal'),'planted_at':start,'base_ms':crop['minutes']*60000,'water_due':start+WATER_DELAY,'watered_at':None,'ready_at':start+crop['minutes']*120000}
   else:
    plant=data['plots'][job['plot']]
    if plant and plant.get('watered_at') is None:water_plant(plant,job['ends_at'],job['started_at'])
   cursor=job['ends_at'];data['job']=None
  if not data['auto_water']:return
  candidates=[]
  for index,plant in enumerate(data['plots']):
   if plant and plant.get('watered_at') is None:
    due=max(plant['water_due'],data.get('auto_since',0),cursor)
    if due<=at and due<plant['ready_at']:candidates.append((due,index))
  if not candidates:return
  start,index=min(candidates);data['job']={'kind':'water','plot':index,'started_at':start,'ends_at':start+JOB_DURATION,'auto':True}


def load(db,uid,now):
 db.execute(select(User.id).where(User.id==uid).with_for_update()).scalar_one()
 row=db.get(GardenState,uid)
 if not row:
  data={'version':5,'job':None,'warehouse':{},'auto_water':False,'auto_since':0,'seeds':{'carrot':2,'sunflower':1},'shop_bought':{},'shop_hour':None,'parts':50,'expanded':False,'plots':[None]*4,'harvests':0,'grown':{},'seen':[]};row=GardenState(user_id=uid,data_json=json.dumps(data));db.add(row);db.flush()
 else:
  data=json.loads(row.data_json)
  if data.get('version',1)<2:
   data.update({'version':2,'seeds':{'carrot':2,'sunflower':1},'shop_bought':{},'shop_hour':None});data['parts']+=26;row.data_json=json.dumps(data)
 if data.get('version',1)<3:
  data.update({'version':3,'warehouse':{},'auto_water':False,'auto_since':0})
  for plant in data['plots']:
   if plant:plant.update({'base_ms':CROPS[plant['crop']]['minutes']*60000,'water_due':plant['planted_at']+WATER_DELAY,'watered_at':plant['planted_at']})
 if data.get('version',1)<4:data['version']=4;data['job']=None
 if data.get('version',1)<5:
  data['version']=5
  for plant in data['plots']:
   if plant:plant.setdefault('variant','normal')
 settle_water(data,now);row.data_json=json.dumps(data,separators=(',',':'))
 return row,data

def shop_view(data,now):
 hour=int(timestamp(now)//3600000)
 def rank(crop):return hashlib.sha256(f'yab-garden-v1:{hour}:{crop["id"]}'.encode()).hexdigest()
 common=sorted([c for c in CATALOG if c['rarity']=='common' and c['id']!='carrot'],key=rank)
 rare=sorted([c for c in CATALOG if c['rarity']=='rare'],key=rank)
 epic=sorted([c for c in CATALOG if c['rarity']=='epic'],key=rank)
 offers=[CROPS['carrot']]+common[:1]+rare[:1]+epic[:1]
 bought=data['shop_bought'] if data['shop_hour']==hour else {}
 result=[]
 for crop in offers:
  stock=4 if crop['rarity']=='common' else 2 if crop['rarity']=='rare' else 1
  result.append({'crop':crop['id'],'stock':stock,'remaining':max(0,stock-bought.get(crop['id'],0)),'price':crop['cost']})
 return {'hour':hour,'ends_at':(hour+1)*3600000,'offers':result,'personal_stock':True}

def view(data,now):
 at=timestamp(now)
 return {'variants':VARIANTS,'harvest_items':harvest_items(data),'job':{k:v for k,v in data['job'].items() if k!='variant'} if data.get('job') else None,'job_duration_ms':JOB_DURATION,'warehouse':data['warehouse'],'auto_water':data['auto_water'],'water_delay_ms':WATER_DELAY,'seeds':data['seeds'],'shop':shop_view(data,now),'starting_balance':50,'parts':data['parts'],'expanded':data['expanded'],'plots':[plot_view(p,at) for p in data['plots']],'harvests':data['harvests'],'grown':data['grown'],'catalog':CATALOG,'upgrade_cost':UPGRADE_COST,'server_now':at}

def garden_state(db,uid,now=None):
 now=now or datetime.utcnow();_,data=load(db,uid,now);return view(data,now)

def garden_action(db,uid,request_id,kind,plot=None,crop=None,now=None,shop_hour=None,quantity=1,auto_water=None,variant='normal'):
 now=now or datetime.utcnow();row,data=load(db,uid,now)
 if request_id in data['seen']:return view(data,now)
 if kind=='auto':
  if not isinstance(auto_water,bool):raise GardenError('Некорректный автополив')
  data['auto_water']=auto_water;data['auto_since']=timestamp(now);settle_water(data,now)
 elif kind in ('sell','sell_all'):
  if kind=='sell_all':
   for item in harvest_items(data):data['parts']+=item['price']*item['quantity']
   data['warehouse']={}
  else:
   key=harvest_key(crop,variant) if isinstance(crop,str) and variant in VARIANT_MAP else ''
   if crop not in CROPS or variant not in VARIANT_MAP or not isinstance(quantity,int) or isinstance(quantity,bool) or quantity<1 or data['warehouse'].get(key,0)<quantity:raise GardenError('Не хватает урожая на складе')
   data['warehouse'][key]-=quantity;data['parts']+=harvest_price(crop,variant)*quantity
 elif kind=='buy':
  shop=shop_view(data,now)
  if shop_hour!=shop['hour']:raise GardenError('Магазин обновился. Обнови ассортимент')
  if not isinstance(quantity,int) or isinstance(quantity,bool) or not 1<=quantity<=10:raise GardenError('Некорректное количество')
  offer=next((o for o in shop['offers'] if o['crop']==crop),None)
  if not offer or offer['remaining']<quantity:raise GardenError('В этой поставке семена закончились')
  price=offer['price']*quantity
  if data['parts']<price:raise GardenError('Не хватает ростков')
  if data['shop_hour']!=shop['hour']:data['shop_hour']=shop['hour'];data['shop_bought']={}
  data['parts']-=price;data['seeds'][crop]=data['seeds'].get(crop,0)+quantity;data['shop_bought'][crop]=data['shop_bought'].get(crop,0)+quantity
 elif kind=='upgrade':
  if data['expanded']:raise GardenError('Теплица уже расширена')
  if data['parts']<UPGRADE_COST:raise GardenError('Для расширения нужно 100 ростков')
  data['parts']-=UPGRADE_COST;data['expanded']=True;data['plots']+=[None,None];data['seeds']['carrot']=data['seeds'].get('carrot',0)+2
 elif kind in ('plant','harvest','water'):
  if not isinstance(plot,int) or isinstance(plot,bool) or not 0<=plot<len(data['plots']):raise GardenError('Грядка недоступна')
  current=data['plots'][plot]
  if kind=='plant':
   if data.get('job'):raise GardenError('Яабик занят другой грядкой')
   if crop not in CROPS:raise GardenError('Неизвестное растение')
   if current:raise GardenError('На этой грядке уже что-то растёт')
   plant=CROPS[crop]
   if data['seeds'].get(crop,0)<=0:raise GardenError('Сначала купи семена в магазине')
   data['seeds'][crop]-=1;data['job']={'kind':'plant','plot':plot,'crop':crop,'variant':variant_for_roll(secrets.randbelow(10000)),'started_at':timestamp(now),'ends_at':timestamp(now)+JOB_DURATION,'auto':False}
  elif kind=='water':
   if data.get('job'):raise GardenError('Яабик занят другой грядкой')
   if not current:raise GardenError('На грядке пока пусто')
   if current.get('watered_at') is not None:raise GardenError('Грядка уже полита')
   if timestamp(now)<current['water_due']:raise GardenError('Полить можно через две минуты после посадки')
   if timestamp(now)>=current['ready_at']:raise GardenError('Урожай уже созрел')
   data['job']={'kind':'water','plot':plot,'started_at':timestamp(now),'ends_at':timestamp(now)+JOB_DURATION,'auto':False}
  else:
   if data.get('job') and data['job']['plot']==plot:raise GardenError('Дождись, пока Яабик закончит')
   if not current:raise GardenError('На этой грядке пока пусто')
   if timestamp(now)<current['ready_at']:raise GardenError('Растение ещё растёт')
   plant=CROPS[current['crop']];harvest_variant=current.get('variant','normal');key=harvest_key(plant['id'],harvest_variant);data['warehouse'][key]=data['warehouse'].get(key,0)+1;data['harvests']+=1;data['grown'][plant['id']]=data['grown'].get(plant['id'],0)+1;data['plots'][plot]=None
   pet=db.get(YaabikState,uid)
   if pet:
    memory=json.loads(pet.data_json);memory['habits']['gardens']=memory['habits'].get('gardens',0)+1;pet.data_json=json.dumps(memory,ensure_ascii=False)
 else:raise GardenError('Неизвестное действие')
 data['seen']=(data['seen']+[request_id])[-128:];row.data_json=json.dumps(data,separators=(',',':'));return view(data,now)
