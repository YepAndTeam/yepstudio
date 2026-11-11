import os,unittest,time
os.environ['DATABASE_URL']='sqlite:///:memory:'
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from sqlalchemy import create_engine,select,update,delete,text
from sqlalchemy.orm import sessionmaker
from database import Base,User,Post,Meta
from performance import Metrics,current_metrics,install_sql_timings,PerformanceMiddleware,performance_snapshot
from server_cache import PublicCache,install_invalidation,cached_read
from public_reads import home_snapshot,leaderboard_snapshot
from score_service import initialize_score_state
from weekly import ensure_period
from database import GameScore

class CacheTest(unittest.TestCase):
 def test_ttl_is_bounded_and_responses_are_isolated(self):
  now=[0];cache=PublicCache(max_entries=2,clock=lambda:now[0]);calls=[]
  def load():calls.append(1);return {'posts':[1]}
  first=cache.read('home','news',15,load);first['posts'].append('private')
  self.assertEqual(cache.read('home','news',15,load),{'posts':[1]});self.assertEqual(len(calls),1)
  now[0]=16;cache.read('home','news',15,load);self.assertEqual(len(calls),2)
  cache.read('leaders','a',15,load);cache.read('leaders','b',15,load);self.assertEqual(cache.stats()['entries'],2)
 def test_concurrent_requests_load_once(self):
  cache=PublicCache();calls=[]
  def load():calls.append(1);time.sleep(.02);return [1]
  with ThreadPoolExecutor(max_workers=4) as pool:result=list(pool.map(lambda _:cache.read('home','news',15,load),range(4)))
  self.assertEqual(len(calls),1);self.assertEqual(result,[[1]]*4)
 def test_commit_during_load_prevents_stale_cache_publication(self):
  cache=PublicCache();started=Event();finish=Event()
  def old():started.set();finish.wait(2);return 'old'
  with ThreadPoolExecutor(max_workers=1) as pool:
   pending=pool.submit(cache.read,'home','news',30,old);self.assertTrue(started.wait(2));cache.invalidate_tables({'posts'});finish.set();pending.result()
  self.assertEqual(cache.read('home','news',30,lambda:'new'),'new')
 def test_failed_load_is_not_cached(self):
  cache=PublicCache()
  def fail():raise ValueError('Offline')
  with self.assertRaises(ValueError):cache.read('home','news',30,fail)
  self.assertEqual(cache.read('home','news',30,lambda:'recovered'),'recovered')

class CacheDatabaseTest(unittest.TestCase):
 def setUp(self):
  self.engine=create_engine('sqlite:///:memory:');Base.metadata.create_all(self.engine);self.sessions=sessionmaker(bind=self.engine);self.cache=PublicCache();install_invalidation(self.sessions,self.cache);install_sql_timings(self.engine);initialize_score_state(self.sessions)
  with self.sessions.begin() as db:db.add(User(id=1,first_name='Player',jera=100));db.add(Post(title='News',text='Body'))
 def tearDown(self):self.engine.dispose()
 def test_orm_and_bulk_changes_invalidate_after_commit_only(self):
  self.cache.read('home','news',30,lambda:'cached')
  with self.sessions() as db:
   db.get(Post,1).title='Changed';db.flush();self.assertEqual(self.cache.stats()['entries'],1);db.rollback()
  self.assertEqual(self.cache.stats()['entries'],1)
  with self.sessions.begin() as db:db.get(Post,1).title='Changed'
  self.assertEqual(self.cache.stats()['entries'],0)
  self.cache.read('home','news',30,lambda:'cached')
  with self.sessions.begin() as db:db.execute(delete(Post))
  self.assertEqual(self.cache.stats()['entries'],0)
 def test_money_and_lock_updates_do_not_flush_public_cache(self):
  self.cache.read('home','news',30,lambda:'cached');self.cache.read('leaders','week',15,lambda:[])
  with self.sessions.begin() as db:
   db.execute(update(User).where(User.id==1).values(jera=150));db.execute(update(Meta).where(Meta.key=='score_write_lock').values(value=Meta.value))
  self.assertEqual(self.cache.stats()['entries'],2)
  with self.sessions.begin() as db:db.get(User,1).first_name='Renamed'
  self.assertEqual(self.cache.stats()['entries'],0)
 def test_public_snapshots_exclude_wallet_and_viewer_fields(self):
  with self.sessions.begin() as db:db.add(GameScore(user_id=1,game='dino',best=100,plays=1))
  with self.sessions() as db:
   home=home_snapshot(db);top=leaderboard_snapshot(db,GameScore,GameScore.game=='dino',GameScore.updated_at)
   self.assertEqual(set(home),{'projects','posts','latest'})
   self.assertEqual(set(top[0]),{'user_id','name','best','place'})
 def test_warm_public_home_avoids_repeat_database_queries(self):
  from unittest.mock import patch
  counts=[]
  with patch('server_cache.public_cache',self.cache):
   for _ in range(2):
    metrics=Metrics();token=current_metrics.set(metrics)
    try:
     with self.sessions() as db:cached_read(db,'home','news',30,lambda:home_snapshot(db))
     counts.append(metrics.sql_count)
    finally:current_metrics.reset(token)
  self.assertEqual(counts,[3,0])
 def test_uncommitted_snapshot_is_not_shared(self):
  from unittest.mock import patch
  self.cache.read('home','news',30,lambda:{'posts':[]})
  with patch('server_cache.public_cache',self.cache):
   with self.sessions() as db:
    db.add(Post(title='Uncommitted',text='Private until commit'))
    result=cached_read(db,'home','news',30,lambda:home_snapshot(db))
    self.assertTrue(any(p['title']=='Uncommitted' for p in result['posts']))
    db.rollback()
  self.assertEqual(self.cache.read('home','news',30,lambda:None),{'posts':[]})
 def test_sql_timings_count_queries_and_errors_without_sql_text(self):
  metrics=Metrics();token=current_metrics.set(metrics)
  try:
   with self.sessions() as db:
    db.execute(select(User.id))
    with self.assertRaises(Exception):db.execute(text('SELECT missing_private_column FROM users'))
   snapshot=metrics.snapshot();self.assertEqual(snapshot['sql_count'],2);self.assertEqual(snapshot['sql_errors'],1)
   self.assertNotIn('missing_private_column',str(snapshot))
  finally:current_metrics.reset(token)
 def test_current_week_leaderboard_check_does_not_take_write_lock(self):
  from sqlalchemy import event
  statements=[];event.listen(self.engine,'before_cursor_execute',lambda conn,cursor,statement,*args:statements.append(statement))
  with self.sessions.begin() as db:ensure_period(db,fast_if_current=True)
  self.assertTrue(all(s.lstrip().upper().startswith('SELECT') for s in statements))

class MiddlewareTest(unittest.IsolatedAsyncioTestCase):
 async def test_background_sql_does_not_inflate_response_sql(self):
  from types import SimpleNamespace
  async def app(scope,receive,send):
   scope['route']=SimpleNamespace(path='/api/test-background')
   current_metrics.get().sql(7)
   await send({'type':'http.response.start','status':200,'headers':[]});await send({'type':'http.response.body','body':b'ok'})
   current_metrics.get().sql(30)
  async def send(message):pass
  async def receive():return {'type':'http.request','body':b''}
  await PerformanceMiddleware(app)({'type':'http','path':'/api/test-background','method':'GET'},receive,send)
  row=next(r for r in performance_snapshot()['routes'] if r['route']=='/api/test-background')
  self.assertEqual(row['average_sql_ms'],7);self.assertEqual(row['average_sql_queries'],1)
 async def test_headers_and_metrics_use_route_template_not_private_path(self):
  from types import SimpleNamespace
  sent=[]
  async def app(scope,receive,send):
   scope['route']=SimpleNamespace(path='/api/friends/{target}/request')
   await send({'type':'http.response.start','status':200,'headers':[]});await send({'type':'http.response.body','body':b'ok'})
  async def send(message):sent.append(message)
  async def receive():return {'type':'http.request','body':b''}
  await PerformanceMiddleware(app)({'type':'http','path':'/api/friends/987654321/request','method':'POST','query_string':b'token=SECRET'},receive,send)
  headers=dict(sent[0]['headers']);self.assertIn(b'server-timing',headers);self.assertIn(b'x-request-id',headers)
  report=performance_snapshot();self.assertNotIn('987654321',str(report));self.assertNotIn('SECRET',str(report))
