// One batched request for a rendered list; no polling or request per nickname.
export function createPublicBadgeCache(fetchMany,{now=Date.now,delay=20,ttl=30000}={}){
 const records=new Map(),listeners=new Map(),queue=new Set(),versions=new Map(),inflight=new Set();let timer=null,flushing=false;
 const notify=id=>{for(const fn of listeners.get(id)||[])fn();};
 const put=(id,badge)=>{records.set(id,{badge:badge||null,until:now()+ttl});notify(id);};
 const schedule=()=>{if(!timer&&!flushing&&queue.size)timer=setTimeout(()=>{timer=null;void flush();},delay);};
 async function flush(){
  if(flushing)return;flushing=true;
  const ids=[...queue].slice(0,100),seen=new Map(ids.map(id=>[id,versions.get(id)||0]));
  for(const id of ids){queue.delete(id);inflight.add(id);}
  try{const result=await fetchMany(ids);for(const id of ids)if((versions.get(id)||0)===seen.get(id))put(id,result.badges?.[id]||null);}
  catch{for(const id of ids)if((versions.get(id)||0)===seen.get(id)){const old=records.get(id);records.set(id,{badge:old?.badge||null,until:now()+5000});}}
  finally{for(const id of ids)inflight.delete(id);flushing=false;schedule();}
 }
 return {
  get:id=>records.get(id)?.badge||null,
  ensure(id){if(!Number.isSafeInteger(id)||id<=0||records.get(id)?.until>now()||inflight.has(id))return;queue.add(id);schedule();},
  set(id,badge){if(!Number.isSafeInteger(id)||id<=0)return;versions.set(id,(versions.get(id)||0)+1);queue.delete(id);put(id,badge);},
  subscribe(id,fn){let set=listeners.get(id);if(!set){set=new Set();listeners.set(id,set);}set.add(fn);return()=>{set.delete(fn);if(!set.size)listeners.delete(id);};},
 };
}
