"""Character catalog imported as data from the user-supplied Bunker generator."""
import json
from pathlib import Path
DATA=json.loads(Path(__file__).with_name('bunker_traits.json').read_text(encoding='utf-8'))
CATEGORIES={'profession':'prof','health':'health','hobby':'hobby','phobia':'phobia','baggage':'bag','fact':'fact','trait':'trait'}
LABELS={'biography':'Биография','profession':'Профессия','health':'Здоровье','hobby':'Хобби','phobia':'Фобия','baggage':'Багаж','fact':'Факт','trait':'Черта характера','skill':'Навык','secret':'Особенность'}
def deal_characters(count,rng):
 used={cat:set() for cat in CATEGORIES};characters=[]
 for _ in range(count):
  age=rng.randint(8,99);sex=rng.choice(['Мужчина','Женщина']);traits={'biography':f'{sex}, {age} г.'}
  for key,cat in CATEGORIES.items():
   if key=='profession' and age<18:traits[key]='Школьник';continue
   eligible=[x for x in DATA[cat] if age>=18 or not x.get('a')]
   pool=[x for x in eligible if x['n'] not in used[key]] or eligible
   entry=rng.choice(pool);used[key].add(entry['n'])
   traits[key]=entry['n']+(' — '+entry['d'] if entry.get('d') else '')
  characters.append(traits)
 return characters
