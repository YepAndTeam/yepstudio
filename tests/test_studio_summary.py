import os,unittest
os.environ['DATABASE_URL']='sqlite:///:memory:'
from datetime import datetime,timedelta
from sqlalchemy import create_engine,event
from sqlalchemy.orm import sessionmaker
from database import Base,Tournament
from race_service import make_meeting
from race_models import Race
from studio_service import event_summary

class StudioSummaryTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);self.now=datetime(2026,11,12,7)
 def tearDown(self):self.engine.dispose()
 def test_empty_and_registration_fallback(self):
  with self.sessions.begin() as db:
   self.assertIsNone(event_summary(db,self.now))
   db.add(Tournament(id='tour',game='dino',title='Dino',status='registration',starts_at=self.now,ends_at=self.now+timedelta(days=2)));db.flush()
   result=event_summary(db,self.now);self.assertEqual(result['kind'],'tournament');self.assertIsNone(result['ends_at'])
 def test_nearest_race_beats_distant_tournament_and_finishes_in_one_minute(self):
  with self.sessions.begin() as db:
   db.add(Tournament(id='tour',game='dino',title='Dino',status='active',starts_at=self.now,ends_at=self.now+timedelta(days=2)))
   meeting=make_meeting(db,self.now);race=db.get(Race,meeting.id+'_PRE')
   result=event_summary(db,self.now);self.assertEqual(result['kind'],'races');self.assertEqual(result['ends_at'],race.starts_at.isoformat()+'Z');self.assertEqual(result['dino_tournament']['id'],'tour');self.assertEqual(result['dino_tournament']['ends_at'],(self.now+timedelta(days=2)).isoformat()+'Z')
   result=event_summary(db,race.starts_at+timedelta(seconds=1));self.assertEqual(result['status'],'Заезд идёт');self.assertEqual(result['ends_at'],(race.starts_at+timedelta(minutes=1)).isoformat()+'Z')
 def test_both_events_remain_visible_when_dino_finishes_first(self):
  with self.sessions.begin() as db:
   db.add(Tournament(id='tour',game='dino',title='Dino',status='active',starts_at=self.now,ends_at=self.now+timedelta(seconds=1)))
   make_meeting(db,self.now)
   result=event_summary(db,self.now);self.assertEqual(result['kind'],'races');self.assertEqual(result['dino_tournament']['id'],'tour')
 def test_dino_is_not_duplicated_when_featured(self):
  with self.sessions.begin() as db:
   db.add(Tournament(id='tour',game='dino',title='Dino',status='active',starts_at=self.now,ends_at=self.now+timedelta(hours=1)));db.flush()
   result=event_summary(db,self.now);self.assertNotIn('dino_tournament',result)
 def test_overview_only_reads_and_never_settles(self):
  with self.sessions.begin() as db:make_meeting(db,self.now)
  sql=[];event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:sql.append(statement))
  with self.sessions() as db:event_summary(db,self.now)
  self.assertEqual(len(sql),2);self.assertTrue(all(s.lstrip().upper().startswith('SELECT') for s in sql))
