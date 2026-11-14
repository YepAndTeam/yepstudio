"""Pure server rules; no database access and no client-provided rewards."""
import hashlib,json,math,secrets
from pathlib import Path
CATALOG=json.loads(Path(__file__).with_name('bekovich_catalog.json').read_text(encoding='utf-8'))
GARDEN=json.loads(Path(__file__).with_name('garden_catalog.json').read_text(encoding='utf-8'))
VALUES={'common':1,'rare':2,'epic':3,'mythic':4,'legendary':5,'secret':6}
INFLUENCE={'common':3,'rare':7,'epic':12,'mythic':40,'legendary':65,'secret':100}
REWARDS={'worn':['coins','cassette'],'reserve':['coins','cassette','badge','usb'],'parcel':['accessory','epic_seed','badge','ticket','usb'],'stash':['bait','usb','badge','ticket']}
LOW=[(0,0,0,0),(9,9,0,0),(12,20,2,.3),(21,45,10,1),(26,55,15,2),(36,75,25,4)]

def assess(discs):
 ordered=sorted(discs,key=lambda d:VALUES[d.rarity],reverse=True)
 top=ordered[0].rarity;boost=sum(INFLUENCE[d.rarity] for d in ordered[1:])
 worn=reserve=parcel=stash=0
 if top=='secret':stash=min(85,40+boost*.5);parcel=100-stash
 elif top=='legendary':
  high=min(95,65+boost);stash=min(55,25+boost*.5);parcel=high-stash;reserve=100-high
 elif top=='mythic':
  high=min(95,40+boost);stash=min(35,8+boost*.2);parcel=high-stash;reserve=100-high
 else:
  score=sum(INFLUENCE[d.rarity] for d in discs)
  for low,high in zip(LOW,LOW[1:]):
   if score<=high[0]:
    ratio=(score-low[0])/(high[0]-low[0]);up,better,stash=[low[i]+(high[i]-low[i])*ratio for i in range(1,4)];break
  worn=100-up;reserve=up-better;parcel=better-stash
 weights={k:math.floor(v*100+.5) for k,v in zip(REWARDS,(worn,reserve,parcel,stash))}
 weights['worn']+=10000-sum(weights.values())
 signature=hashlib.sha256(json.dumps(sorted((d.disc_id,d.rarity) for d in discs),separators=(',',':')).encode()).hexdigest()
 return dict(value=sum(VALUES[d.rarity] for d in discs),weights=weights,strongest=top,signature=signature,requiresWarning=any(VALUES[d.rarity]>=5 for d in discs))

def badge_title(rand=secrets.randbelow):
 if rand(2)==0:return '',CATALOG['community_titles'][rand(len(CATALOG['community_titles']))]
 words=CATALOG['words'];noun=words['nouns'][rand(len(words['nouns']))]
 linked=[a for a in words['adjectives'] if set(a['tags'])&set(noun['tags'])] or words['adjectives']
 return linked[rand(len(linked))][noun['gender']],noun['word']

def roll_badge(rand=secrets.randbelow):
 finish=dict(CATALOG['finishes'][rand(len(CATALOG['finishes']))]);prefix,title=badge_title(rand)
 finish.update(prefix=prefix,title=title);return finish

def roll_reward(discs,rand=secrets.randbelow):
 assessment=assess(discs)
 if len(discs)==1 and discs[0].rarity in ('common','secret') and rand(10000)>=500:return assessment,'',{},True
 roll=rand(10000)
 for chest,weight in assessment['weights'].items():
  roll-=weight
  if roll<0:break
 pool=REWARDS[chest];kind=pool[rand(len(pool))];reward={'kind':kind}
 if kind=='coins':
  roll=rand(1081)
  for amount in range(5,51):
   roll-=51-amount
   if roll<0:reward['amount']=amount;break
 elif kind=='usb':
  player='themes' if rand(100)<30 else 'dvd';opens=0
  if rand(100)>=50:
   roll=rand(100);opens=1 if roll<60 else 3 if roll<90 else 5 if roll<99 else 10
  reward['usb']={'player':player,'opens':opens}
 elif kind=='badge':reward['badge']=roll_badge(rand)
 elif kind=='epic_seed':
  plants=[s for s in GARDEN if s['rarity']=='epic'];reward.update(seed=plants[rand(len(plants))]['id'],amount=1)
 return assessment,chest,reward,False
