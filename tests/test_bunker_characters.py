import unittest,random,copy
from bunker_characters import DATA,CATEGORIES,deal_characters
import party_engine as game
class BunkerCharactersTest(unittest.TestCase):
 def test_source_categories_and_total(self):
  self.assertEqual(sum(map(len,DATA.values())),263)
  self.assertEqual(set(DATA),set(CATEGORIES.values()))
 def test_eight_fields_age_constraints_and_no_duplicate_deck_draws(self):
  saw_minor=False
  for seed in range(40):
   characters=deal_characters(12,random.Random(seed))
   for person in characters:
    self.assertEqual(len(person),8);age=int(person['biography'].split(', ')[1].split()[0]);self.assertTrue(8<=age<=99)
    if age<18:
     saw_minor=True;self.assertEqual(person['profession'],'Школьник')
     for key,cat in CATEGORIES.items():
      if key=='profession':continue
      self.assertNotIn(person[key].split(' — ')[0],{x['n'] for x in DATA[cat] if x.get('a')})
   for key in CATEGORIES:
    values=[p[key] for p in characters if not(key=='profession' and p[key]=='Школьник')]
    self.assertEqual(len(values),len(set(values)))
  self.assertTrue(saw_minor)
 def test_generated_document_is_persisted_private_and_not_rerolled(self):
  s=game.new_room('bunker',1,'one',0)
  for uid in range(2,7):game.join(s,uid,str(uid),'classic','dark')
  game.start(s,1,100,random.Random(14));document=copy.deepcopy(s['players'][0]['traits']);saved=copy.deepcopy(s)
  game.join(saved,1,'one','classic','dark');own=game.view(saved,1,101);other=game.view(saved,2,101)
  self.assertEqual(own['players'][0]['traits'],document);self.assertEqual(set(other['players'][0]['traits']),{'profession'})
 def test_existing_five_field_documents_keep_revealing_their_own_keys(self):
  s=game.new_room('bunker',1,'one',0)
  for uid in range(2,5):game.join(s,uid,str(uid),'classic','dark')
  game.start(s,1,100,random.Random(1))
  for p in s['players']:p['traits']={'profession':'Радист','skill':'Ремонтирую радио','secret':'Помню пароль'};p['revealed']=['profession']
  s['phase']='reveal';s['deadline']=150;game.advance(s,150,random.Random(1))
  self.assertTrue(all(p['revealed']==['profession','skill'] for p in s['players']))

 def test_narrator_choice_is_persisted_enforced_and_auto_revealed(self):
  s=game.new_room('bunker',1,'one',0)
  for uid in range(2,7):game.join(s,uid,str(uid),'classic','dark')
  game.start(s,1,100,random.Random(6));s['phase']='vote';s['deadline']=200
  game.advance(s,200,random.Random(7));self.assertEqual(s['phase'],'reveal');key=s['reveal_trait'];self.assertNotEqual(key,'profession')
  saved=copy.deepcopy(s);game.join(saved,1,'one','classic','dark');self.assertEqual(game.view(saved,1,201)['reveal_trait'],key)
  wrong=next(k for k in s['players'][0]['traits'] if k not in ('profession',key))
  with self.assertRaises(game.PartyError):game.act(s,1,'reveal',wrong,201)
  game.act(s,1,'reveal',key,201);game.advance(s,240,random.Random(9))
  self.assertTrue(all(p['revealed']==['profession',key] for p in s['players']))
  s['phase']='vote';s['deadline']=300;game.advance(s,300,random.Random(7));self.assertNotEqual(s['reveal_trait'],key)
 def test_fully_revealed_room_returns_to_discussion(self):
  s=game.new_room('bunker',1,'one',0)
  for uid in range(2,5):game.join(s,uid,str(uid),'classic','dark')
  game.start(s,1,100,random.Random(6))
  for p in s['players']:p['revealed']=list(p['traits'])
  s['phase']='vote';s['deadline']=200;game.advance(s,200,random.Random(7));self.assertEqual(s['phase'],'discussion');self.assertIsNone(s['reveal_trait'])
