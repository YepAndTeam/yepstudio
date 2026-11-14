import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicBadgeCache} from './publicBadgeCache.js';
const tick=()=>new Promise(r=>setTimeout(r,15));
test('batches names, deduplicates and caches absent titles',async()=>{
 const calls=[];const cache=createPublicBadgeCache(async ids=>{calls.push(ids);return {badges:{1:{title:'One'}}};},{delay:0});
 cache.ensure(1);cache.ensure(2);cache.ensure(1);cache.ensure(NaN);await tick();
 assert.deepEqual(calls,[[1,2]]);assert.equal(cache.get(1).title,'One');assert.equal(cache.get(2),null);
 cache.ensure(2);await tick();assert.equal(calls.length,1);
});
test('late response cannot overwrite newly equipped title',async()=>{
 let finish;const cache=createPublicBadgeCache(()=>new Promise(r=>finish=r),{delay:0});
 cache.ensure(1);await tick();cache.set(1,{title:'New'});finish({badges:{1:{title:'Old'}}});await tick();assert.equal(cache.get(1).title,'New');
});
test('large lists split into bounded requests',async()=>{
 const sizes=[];const cache=createPublicBadgeCache(async ids=>{sizes.push(ids.length);return {badges:{}};},{delay:0});
 for(let id=1;id<=205;id++)cache.ensure(id);await tick();await tick();assert.deepEqual(sizes,[100,100,5]);
});
