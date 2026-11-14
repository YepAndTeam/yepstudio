import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDiscs,offerSignature,chooseChest,getRememberedOffer,DISC_VALUES} from './bekovichTrade.js';
const discs=(...rarities)=>rarities.map((rarity,i)=>({id:String(i),item:{id:'minecraft'},rarity,status:'ready'}));
test('three common discs match 91/9 and value 3',()=>{const result=evaluateDiscs(discs('common','common','common'));assert.equal(result.value,3);assert.deepEqual(result.weights,{worn:9100,reserve:900,parcel:0,stash:0});});
test('mythic plus two rares has 54 percent above reserve',()=>{const r=evaluateDiscs(discs('mythic','rare','rare'));assert.equal(r.value,8);assert.equal(r.weights.parcel+r.weights.stash,5400);});
test('legendary and secret floors',()=>{assert.deepEqual(evaluateDiscs(discs('legendary')).weights,{worn:0,reserve:3500,parcel:4000,stash:2500});assert.deepEqual(evaluateDiscs(discs('secret')).weights,{worn:0,reserve:0,parcel:6000,stash:4000});});
test('all combinations sum to 100 percent and upgrades never worsen a chest tier',()=>{
 const rarities=Object.keys(DISC_VALUES);
 for(let size=1;size<=3;size++){
  const visit=items=>{if(items.length<size){for(const r of rarities)visit([...items,r]);return;}
   const old=evaluateDiscs(discs(...items)).weights;assert.equal(Object.values(old).reduce((a,b)=>a+b),10000);assert.ok(Object.values(old).every(n=>Number.isInteger(n)&&n>=0));
   for(let index=0;index<size;index++){const rank=rarities.indexOf(items[index]);if(rank===5)continue;const higher=[...items];higher[index]=rarities[rank+1];const next=evaluateDiscs(discs(...higher)).weights;assert.ok(next.stash>=old.stash);assert.ok(next.stash+next.parcel>=old.stash+old.parcel);assert.ok(10000-next.worn>=10000-old.worn);}
  };visit([]);
 }
});
test('roll boundaries and zero chance entries',()=>{const w=evaluateDiscs(discs('secret')).weights;assert.equal(chooseChest(w,0),'parcel');assert.equal(chooseChest(w,5999),'parcel');assert.equal(chooseChest(w,6000),'stash');assert.equal(chooseChest(w,9999),'stash');});
test('canonical composition ignores order and duplicate instance replacements',()=>{const original=discs('mythic','rare','rare'),copy=original.map((d,i)=>({...d,id:'replacement-'+i})).reverse();assert.equal(offerSignature(original),offerSignature(copy));copy[0]={...copy[0],rarity:'common'};assert.notEqual(offerSignature(original),offerSignature(copy));});
test('remembered complete reward survives serialization without rerolling',()=>{const cache={};let calls=0;const random=n=>{calls++;return n-1;};const first=getRememberedOffer(cache,discs('mythic','rare','rare'),random);const count=calls;const restored=JSON.parse(JSON.stringify(cache));const second=getRememberedOffer(restored,discs('rare','mythic','rare'),()=>{throw Error('must not reroll');});assert.deepEqual(JSON.parse(JSON.stringify(first.offer)),second.offer);assert.equal(second.reused,true);assert.equal(calls,count);});
test('new composition gets a separate offer',()=>{const cache={};getRememberedOffer(cache,discs('common'),()=>0);const changed=discs('common');changed[0].item.id='terraria';getRememberedOffer(cache,changed,()=>0);assert.equal(Object.keys(cache).length,2);});
test('legendary and secret require warning, invalid submissions rejected',()=>{assert.equal(evaluateDiscs(discs('legendary')).requiresWarning,true);assert.equal(evaluateDiscs(discs('secret')).requiresWarning,true);assert.equal(evaluateDiscs(discs('mythic')).requiresWarning,false);assert.throws(()=>evaluateDiscs([]));assert.throws(()=>evaluateDiscs(discs('common','common','common','common')));const repeated=discs('common');assert.throws(()=>evaluateDiscs([repeated[0],repeated[0]]));assert.throws(()=>evaluateDiscs([{...repeated[0],status:'sealed'}]));});
