import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache} from './readCache.js';
test('duplicate reads share one request; fresh navigation reuses data and mutations force reload',async()=>{
 let calls=0,now=0;const read=createReadCache(async()=>++calls,()=>now);
 assert.deepEqual(await Promise.all([read('/home'),read('/home')]),[1,1]);assert.equal(calls,1);
 now=100;assert.equal(await read('/home'),1);
 assert.equal(await read('/home',{force:true}),2);
 now=20000;assert.equal(await read('/home'),3);
});
test('failed reads can be retried',async()=>{
 let calls=0;const read=createReadCache(async()=>{if(++calls===1)throw Error('Offline');return 'ok';});
 await assert.rejects(read('/me'));assert.equal(await read('/me'),'ok');
});
test('a pre-purchase response cannot repopulate the balance cache after invalidation',async()=>{
 let finishOld;let calls=0;
 const read=createReadCache(()=>++calls===1?new Promise(resolve=>{finishOld=resolve;}):Promise.resolve(80));
 const old=read('/me');await Promise.resolve();read.invalidate('/me');
 assert.equal(await read('/me'),80);finishOld(100);await old;
 assert.equal(await read('/me'),80);
});
