"""Only shared public JSON snapshots belong here. Never cache wallets/auth."""
import copy,time,os
from collections import OrderedDict
from threading import Lock
from sqlalchemy import event,inspect
from performance import current_metrics

DEPENDENCIES={
 'home':{'posts','projects','comments','ideas','users'},
 'leaders':{'game_scores','alltime_scores','tournament_scores','tournaments','users','meta'},
 'studio_event':{'tournaments','races','race_meetings'},
}

class PublicCache:
 def __init__(self,max_entries=128,clock=time.monotonic):
  self.max_entries=max_entries;self.clock=clock;self.guard=Lock();self.entries=OrderedDict();self.loading={};self.revisions={};self.hits=0;self.misses=0
 def read(self,namespace,key,ttl,loader):
  cache_key=(namespace,key)
  with self.guard:lock=self.loading.setdefault(cache_key,Lock())
  try:
   with lock:
    with self.guard:
     old=self.entries.get(cache_key)
     if old and old[0]>self.clock():
      self.hits+=1;self.entries.move_to_end(cache_key);hit=True;value=old[1]
     else:self.misses+=1;hit=False;revision=self.revisions.get(namespace,0)
    metrics=current_metrics.get()
    if metrics:metrics.cache(hit)
    if hit:return copy.deepcopy(value)
    value=loader()
    with self.guard:
     if revision==self.revisions.get(namespace,0):
      self.entries[cache_key]=(self.clock()+ttl,copy.deepcopy(value));self.entries.move_to_end(cache_key)
      while len(self.entries)>self.max_entries:self.entries.popitem(last=False)
    return copy.deepcopy(value)
  finally:
   with self.guard:
    if self.loading.get(cache_key) is lock:self.loading.pop(cache_key,None)
 def invalidate_tables(self,tables):
  with self.guard:
   namespaces={ns for ns,deps in DEPENDENCIES.items() if deps.intersection(tables)}
   for ns in namespaces:self.revisions[ns]=self.revisions.get(ns,0)+1
   for key in list(self.entries):
    if key[0] in namespaces:self.entries.pop(key,None)
 def stats(self):
  with self.guard:return {'entries':len(self.entries),'max_entries':self.max_entries,'hits':self.hits,'misses':self.misses,'scope':'Local process; other workers expire by TTL'}

public_cache=PublicCache()

def cached_read(db,namespace,key,ttl,loader):
 # A transaction that changed public data must not publish uncommitted state.
 pending=db.info.get('_public_cache_dirty',set())
 deps=DEPENDENCIES[namespace]
 changed=list(db.new)+list(db.deleted)+[o for o in db.dirty if db.is_modified(o,include_collections=False)]
 if os.getenv('PUBLIC_CACHE_ENABLED','1')=='0' or pending.intersection(deps) or any(getattr(getattr(o,'__table__',None),'name',None) in deps for o in changed):return loader()
 return public_cache.read(namespace,key,ttl,loader)

def install_invalidation(sessions,cache=public_cache):
 if getattr(sessions,'_public_cache_events',False):return
 sessions._public_cache_events=True
 def mark(db,tables):db.info.setdefault('_public_cache_dirty',set()).update(tables)
 def flushed(db,context):
  objects=list(db.new)+list(db.deleted)+[o for o in db.dirty if db.is_modified(o,include_collections=False)]
  tables=set()
  for obj in objects:
   table=getattr(obj,'__table__',None)
   if table is None:continue
   if table.name=='users' and obj not in db.new and obj not in db.deleted and not inspect(obj).attrs.first_name.history.has_changes():continue
   if table.name=='meta' and (getattr(obj,'key','') in ('score_write_lock','board_widget_lock') or getattr(obj,'key','').startswith('friend_send:')):continue
   tables.add(table.name)
  mark(db,tables)
 def executed(state):
  if state.is_update or state.is_delete or state.is_insert:
   table=getattr(state.statement,'table',None)
   if table is not None:
    if table.name=='meta':
     values=state.statement.compile().params.values()
     if any(isinstance(v,str) and (v in ('score_write_lock','board_widget_lock') or v.startswith('friend_send:')) for v in values):return
    if table.name=='users' and state.is_update:
     keys={getattr(k,'key',k) for k in (getattr(state.statement,'_values',None) or {})}
     if keys and keys.issubset({'jera','theme','notify'}):return
    mark(state.session,{table.name})
 def committed(db):cache.invalidate_tables(db.info.pop('_public_cache_dirty',set()))
 def rolled_back(db):db.info.pop('_public_cache_dirty',None)
 event.listen(sessions,'after_flush',flushed)
 event.listen(sessions,'do_orm_execute',executed)
 event.listen(sessions,'after_commit',committed)
 event.listen(sessions,'after_rollback',rolled_back)
