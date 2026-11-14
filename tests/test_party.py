import unittest,random,copy
import party_engine as g
class PartyTest(unittest.TestCase):
 def room(self,kind='mafia',n=8,seats=1):
  s=g.new_room(kind,1,'One',0,seats=seats)
  for uid in range(2,n+1):g.join(s,uid,str(uid),'mint','nyan')
  g.start(s,1,100,random.Random(9));return s
 def test_bunker_dossier_survives_rejoin_and_reload(self):
  s=self.room('bunker',4);before=copy.deepcopy(g.player(s,1)['traits'])
  g.join(s,1,'One','classic','dark')
  restored=copy.deepcopy(s)
  self.assertEqual(next(p for p in g.view(restored,1,101)['players'] if p['id']==1)['traits'],before)
  with self.assertRaises(g.PartyError):g.start(restored,1,102,random.Random(77))
  self.assertEqual(g.player(restored,1)['traits'],before)
 def test_four_to_twelve_players(self):
  for n in range(4,13):
   s=g.new_room('mafia',1,'one',0,capacity=12)
   for i in range(2,n+1):g.join(s,i,str(i),'classic','dark')
   g.start(s,1,0,random.Random(n));roles=[p['role'] for p in s['players']]
   self.assertGreater(roles.count('civilian'),roles.count('mafia'))
   self.assertEqual(roles.count('doctor'),int(n>=6));self.assertEqual(roles.count('detective'),int(n>=6))
 def test_secret_views_are_detached_and_scoped(self):
  for kind in ['mafia','bunker']:
   s=self.room(kind);v=g.view(s,1,100)
   for p in v['players']:
    if p['id']!=1:self.assertIsNone(p['role']);self.assertNotIn('investigation',p);self.assertNotIn('allies',p);self.assertTrue(set(p['traits'])<=set(p['revealed']))
   v['players'][0]['revealed'].append('secret');self.assertNotIn('secret',s['players'][0]['revealed'])
 def test_detective_cannot_probe_multiple_targets(self):
  s=self.room();d=next(p for p in s['players'] if p['role']=='detective');targets=[p for p in s['players'] if p['id']!=d['id']]
  g.act(s,d['id'],'night',targets[0]['id'],115)
  with self.assertRaises(g.PartyError):g.act(s,d['id'],'night',targets[1]['id'],116)
  other=next(p for p in s['players'] if p['id']!=d['id']);self.assertNotIn('investigation',next(p for p in g.view(s,other['id'],100)['players'] if p['id']==d['id']))
 def test_doctor_saves_and_night_is_once(self):
  s=self.room();m=next(p for p in s['players'] if p['role']=='mafia');d=next(p for p in s['players'] if p['role']=='doctor');target=next(p for p in s['players'] if p['role']=='civilian')
  for p in s['players']:
   if p['role']=='mafia':g.act(s,p['id'],'night',target['id'],100)
  g.act(s,d['id'],'night',target['id'],130)
  self.assertFalse(g.advance(s,144,random.Random(1)));self.assertTrue(g.advance(s,145,random.Random(1)));self.assertTrue(target['alive']);self.assertFalse(g.advance(s,145,random.Random(1)))
 def test_vote_tie_runoff_no_random_expulsion(self):
  s=self.room('bunker',4);g.advance(s,220,random.Random());g.act(s,1,'vote',2,220);g.act(s,2,'vote',1,220);g.advance(s,265,random.Random());self.assertEqual(s['phase'],'runoff')
  with self.assertRaises(g.PartyError):g.act(s,1,'vote',3,266)
  g.advance(s,295,random.Random());self.assertEqual(len(g.living(s)),4)
 def test_bunker_one_seat_and_reveal_only_one(self):
  s=self.room('bunker',4);s['phase']='reveal';s['deadline']=140
  g.act(s,1,'reveal','baggage',100)
  with self.assertRaises(g.PartyError):g.act(s,1,'reveal','skill',100)
  g.advance(s,140,random.Random());self.assertEqual(len(s['players'][0]['revealed']),2);self.assertEqual(len(s['players'][1]['revealed']),2)
  for p in s['players'][1:]:p['alive']=False
  self.assertTrue(g.check_end(s));self.assertEqual(s['winner'],'survivors')
 def test_no_ghost_chat_or_votes_and_chat_limit(self):
  s=self.room();p=s['players'][0];p['alive']=False;s['phase']='vote'
  for action in ['vote','night']:
   with self.assertRaises(g.PartyError):g.act(s,1,action,2,200)
  with self.assertRaises(g.PartyError):g.chat(s,1,'spoiler',200)
  g.chat(s,2,'hello',200)
  with self.assertRaises(g.PartyError):g.chat(s,2,'spam',201)
  s['phase']='night'
  with self.assertRaises(g.PartyError):g.chat(s,2,'night',203)
 def test_lobby_leave_transfers_host(self):
  s=g.new_room('bunker',1,'one',0);g.join(s,2,'two','mint','light');g.act(s,1,'leave',None,1);self.assertEqual(s['host'],2)
 def test_host_only_start_and_private_spectator(self):
  s=g.new_room('bunker',1,'one',0,public=False)
  with self.assertRaises(g.PartyError):g.view(s,99,0)
  g.join(s,2,'two','mint','light')
  with self.assertRaises(g.PartyError):g.start(s,2,0,random.Random())
 def test_resigning_removes_actions_and_can_finish(self):
  s=self.room('mafia',4);mafia=next(p for p in s['players'] if p['role']=='mafia');g.act(s,mafia['id'],'leave',None,100);self.assertEqual(s['winner'],'civilian');self.assertFalse(mafia['alive'])
 def test_bunker_full_games_finish_for_every_size(self):
  for n in range(4,13):
   s=g.new_room('bunker',1,'one',0,capacity=12,seats=1)
   for i in range(2,n+1):g.join(s,i,str(i),'classic','dark')
   g.start(s,1,0,random.Random(n))
   for _ in range(100):
    if s['status']=='finished':break
    if s['phase']=='vote':
     target=g.living(s)[-1]['id']
     for p in g.living(s):
      if p['id']!=target:g.act(s,p['id'],'vote',target,s['deadline']-1)
    g.advance(s,s['deadline'],random.Random(n))
   self.assertEqual(s['status'],'finished');self.assertEqual(len(g.living(s)),1)
 def test_night_roles_act_in_order_and_do_not_leak_actions(self):
  s=self.room();d=next(p for p in s['players'] if p['role']=='detective');doctor=next(p for p in s['players'] if p['role']=='doctor');target=next(p for p in s['players'] if p['role']=='civilian')
  with self.assertRaises(g.PartyError):g.act(s,d['id'],'night',target['id'],114)
  with self.assertRaises(g.PartyError):g.act(s,doctor['id'],'night',target['id'],129)
  g.act(s,d['id'],'night',target['id'],115)
  self.assertEqual(g.view(s,d['id'],115)['my_action_kind'],'check')
  self.assertIsNone(g.view(s,target['id'],115)['my_action_kind'])
  self.assertEqual(g.view(s,target['id'],130)['night_turn'],'doctor')
  with self.assertRaises(g.PartyError):g.act(s,doctor['id'],'night',target['id'],145)
 def test_commissar_shot_or_check_once_and_doctor_protects(self):
  for protected in (True,False):
   s=self.room();d=next(p for p in s['players'] if p['role']=='detective');doctor=next(p for p in s['players'] if p['role']=='doctor');target=next(p for p in s['players'] if p['role']=='civilian')
   with self.assertRaises(g.PartyError):g.act(s,doctor['id'],'night_kill',target['id'],130)
   g.act(s,d['id'],'night_kill',target['id'],115)
   self.assertNotIn('investigation',d)
   with self.assertRaises(g.PartyError):g.act(s,d['id'],'night',target['id'],116)
   if protected:g.act(s,doctor['id'],'night',target['id'],130)
   g.advance(s,145,random.Random());self.assertEqual(target['alive'],protected)
 def test_two_night_victims_both_get_last_words(self):
  s=self.room();d=next(p for p in s['players'] if p['role']=='detective');targets=[p for p in s['players'] if p['role']=='civilian'][:2]
  for p in s['players']:
   if p['role']=='mafia':g.act(s,p['id'],'night',targets[0]['id'],100)
  g.act(s,d['id'],'night_kill',targets[1]['id'],115);g.advance(s,145,random.Random())
  self.assertEqual(s['last_words_id'],targets[0]['id']);g.chat(s,targets[0]['id'],'one',146)
  g.advance(s,175,random.Random());self.assertEqual(s['last_words_id'],targets[1]['id']);g.chat(s,targets[1]['id'],'two',176)
  g.advance(s,205,random.Random());self.assertEqual(s['phase'],'discussion');self.assertNotIn('pending_night_victims',s)
 def test_last_words_once_only_by_victim_after_night(self):
  s=self.room();target=next(p for p in s['players'] if p['role']=='civilian')
  for p in s['players']:
   if p['role']=='mafia':g.act(s,p['id'],'night',target['id'],100)
  g.advance(s,145,random.Random());self.assertEqual(s['phase'],'last_words');self.assertFalse(target['alive']);self.assertEqual(s['deadline'],175)
  self.assertTrue(g.view(s,target['id'],146)['can_send_last_words'])
  other=next(p for p in s['players'] if p['alive'])
  with self.assertRaises(g.PartyError):g.chat(s,other['id'],'interrupt',146)
  with self.assertRaises(g.PartyError):g.chat(s,target['id'],' ',146)
  g.chat(s,target['id'],'Моё последнее слово',146);self.assertTrue(s['messages'][-1]['last_words']);self.assertFalse(g.view(s,target['id'],147)['can_send_last_words'])
  with self.assertRaises(g.PartyError):g.chat(s,target['id'],'second',149)
  g.advance(s,175,random.Random());self.assertEqual(s['phase'],'discussion')
  with self.assertRaises(g.PartyError):g.chat(s,target['id'],'late',176)
 def test_last_mafia_gets_last_words_before_game_finishes(self):
  s=self.room('mafia',4);victim=next(p for p in s['players'] if p['role']=='mafia');s['phase']='vote';s['deadline']=150
  for p in s['players']:
   if p['id']!=victim['id']:g.act(s,p['id'],'vote',victim['id'],149)
  g.advance(s,150,random.Random());self.assertEqual(s['phase'],'last_words');self.assertEqual(s['status'],'active')
  self.assertTrue(g.view(s,victim['id'],151)['can_send_last_words']);g.chat(s,victim['id'],'Раскусили',151)
  g.advance(s,180,random.Random());self.assertEqual(s['winner'],'civilian');self.assertEqual(s['status'],'finished')
 def test_last_words_timeout_and_vote_resume_day(self):
  s=self.room();victim=next(p for p in s['players'] if p['role']=='civilian');g.begin_last_words(s,victim,'night',200,True);victim['alive']=False
  with self.assertRaises(g.PartyError):g.chat(s,victim['id'],'too late',230)
  g.advance(s,230,random.Random());self.assertEqual(s['phase'],'night');self.assertEqual(s['day'],2);self.assertNotIn('last_words_id',s)
if __name__=='__main__':unittest.main()
