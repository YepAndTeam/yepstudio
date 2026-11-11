"""Bounded, payload-free timings. SQL durations include driver/network waits,
but not connection-pool checkout or Python time."""
import json,logging,os,time
from contextvars import ContextVar
from collections import deque,defaultdict
from threading import Lock
from uuid import uuid4
from sqlalchemy import event

current_metrics=ContextVar('api_metrics',default=None)
history=deque(maxlen=500)
guard=Lock()
request_count=0

class Metrics:
 def __init__(self):
  self.lock=Lock();self.sql_ms=0.;self.sql_count=0;self.sql_max_ms=0.;self.sql_errors=0;self.cache_hits=0;self.cache_misses=0
 def sql(self,duration,error=False):
  with self.lock:
   self.sql_ms+=duration;self.sql_count+=1;self.sql_max_ms=max(self.sql_max_ms,duration);self.sql_errors+=int(error)
 def cache(self,hit):
  with self.lock:
   if hit:self.cache_hits+=1
   else:self.cache_misses+=1
 def snapshot(self):
  with self.lock:return {k:round(getattr(self,k),2) for k in ('sql_ms','sql_count','sql_max_ms','sql_errors','cache_hits','cache_misses')}

def install_sql_timings(engine):
 if getattr(engine,'_yab_timings',False):return
 engine._yab_timings=True
 def before(conn,cursor,statement,parameters,context,executemany):
  context._yab_metrics=current_metrics.get();context._yab_started=time.perf_counter();context._yab_done=False
 def finish(context,error=False):
  if context is not None and not getattr(context,'_yab_done',True):
   context._yab_done=True
   if context._yab_metrics:context._yab_metrics.sql((time.perf_counter()-context._yab_started)*1000,error)
 event.listen(engine,'before_cursor_execute',before)
 event.listen(engine,'after_cursor_execute',lambda conn,cursor,statement,parameters,context,executemany:finish(context))
 event.listen(engine,'handle_error',lambda error:finish(error.execution_context,True))

class PerformanceMiddleware:
 def __init__(self,app):self.app=app
 async def __call__(self,scope,receive,send):
  global request_count
  if scope['type']!='http' or not scope.get('path','').startswith('/api/'):
   return await self.app(scope,receive,send)
  metrics=Metrics();token=current_metrics.set(metrics);started=time.perf_counter();response_ms=None;response_values=None;status=500;request_id=uuid4().hex[:16]
  async def measured_send(message):
   nonlocal response_ms,response_values,status
   if message['type']=='http.response.start':
    status=message['status'];response_ms=(time.perf_counter()-started)*1000
    values=metrics.snapshot();response_values=values;message={**message,'headers':list(message.get('headers',[]))+[(b'server-timing',f"app;dur={response_ms:.2f}, sql;dur={values['sql_ms']:.2f}".encode()),(b'x-request-id',request_id.encode())]}
   await send(message)
  try:await self.app(scope,receive,measured_send)
  finally:
   total=(time.perf_counter()-started)*1000
   route=getattr(scope.get('route'),'path','/api/unmatched')
   final_values=metrics.snapshot();values=response_values or final_values
   row={'route':route,'method':scope.get('method',''),'status':status,'response_ms':round(response_ms if response_ms is not None else total,2),'total_ms':round(total,2),'background_sql_ms':round(max(0,final_values['sql_ms']-values['sql_ms']),2),**values}
   with guard:
    history.append(row);request_count+=1;sample=request_count%20==0
   try:slow=max(100,min(60000,float(os.getenv('PERF_SLOW_MS','500'))))
   except ValueError:slow=500
   if row['response_ms']>=slow or total>=slow or status>=500 or sample or os.getenv('PERF_LOG_ALL')=='1':
    logging.getLogger('uvicorn.error').info('api_performance %s',json.dumps({'request_id':request_id,**row},separators=(',',':')))
   current_metrics.reset(token)

def performance_snapshot():
 with guard:rows=list(history)
 groups=defaultdict(list)
 for row in rows:groups[(row['method'],row['route'])].append(row)
 result=[]
 for (method,route),items in groups.items():
  times=sorted(item['response_ms'] for item in items);n=len(times)
  result.append({'method':method,'route':route,'requests':n,'p50_ms':times[(n-1)//2],'p95_ms':times[min(n-1,int(n*.95))],'max_ms':times[-1],'average_sql_ms':round(sum(i['sql_ms'] for i in items)/n,2),'average_sql_queries':round(sum(i['sql_count'] for i in items)/n,2),'errors':sum(i['status']>=500 for i in items),'cache_hits':sum(i['cache_hits'] for i in items),'cache_misses':sum(i['cache_misses'] for i in items)})
 return {'window_requests':len(rows),'routes':sorted(result,key=lambda r:r['p95_ms'],reverse=True),'scope':'Current server process; reset on restart. SQL excludes pool checkout.'}
