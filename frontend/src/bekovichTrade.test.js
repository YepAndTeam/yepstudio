import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDiscs,offerSignature,chooseChest,getRememberedOffer,DISC_VALUES,makeOffer,BEKOVICH_EPIC_SEEDS} from './bekovichTrade.js';
const discs=(...rarities)=>rarities.map((rarity,i)=>({id:String(i),item:{id:'minecraft'},rarity,status:'ready'}));
test('rare and epic sets get the approved smoother reward curve',()=>{
 assert.deepEqual(evaluateDiscs(discs('epic','rare','rare')).weights,{worn:4500,reserve:4000,parcel:1300,stash:200});
 assert.deepEqual(evaluateDiscs(discs('rare','rare','rare')).weights,{worn:5500,reserve:3500,parcel:900,stash:100});
 assert.deepEqual(evaluateDiscs(discs('epic','epic','epic')).weights,{worn:2500,reserve:5000,parcel:2100,stash:400});
});
test('adding a disc never reduces cumulative chest chances',()=>{
 const tiers=Object.keys(DISC_VALUES);
 for(const a of tiers)for(const b of [null,...tiers])for(const added of tiers){
  const set=b?[a,b]:[a],before=evaluateDiscs(discs(...set)).weights,after=evaluateDiscs(discs(...set,added)).weights;
  assert.ok(after.stash>=before.stash);
  assert.ok(after.stash+after.parcel>=before.stash+before.parcel);
  assert.ok(after.worn<=before.worn);
 }
});
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

test('Yaabik parcels can contain one epic seed, and the exact plant is remembered',()=>{const rolls=[0,0,1,1],cache={};let index=0;const first=getRememberedOffer(cache,discs('secret'),n=>rolls[index++]%n);assert.equal(first.offer.chest,'parcel');assert.equal(first.offer.kind,'epic_seed');assert.equal(first.offer.amount,1);assert.ok(BEKOVICH_EPIC_SEEDS.some(seed=>seed.id===first.offer.seed&&seed.rarity==='epic'));const second=getRememberedOffer(JSON.parse(JSON.stringify(cache)),discs('secret'),()=>{throw Error('must not reroll plant');});assert.equal(second.offer.seed,first.offer.seed);assert.equal(second.reused,true);});
test('old remembered offers stay unchanged when the seed reward is added',()=>{const discsList=discs('secret'),cache={},old=getRememberedOffer(cache,discsList,()=>0).offer;const restored=getRememberedOffer(JSON.parse(JSON.stringify(cache)),discsList,()=>{throw Error('old offer must remain');});assert.deepEqual(restored.offer,JSON.parse(JSON.stringify(old)));for(let i=0;i<5;i++){let call=0;const offer=makeOffer(discsList,n=>(call++===0?0:call===2?8000:i)%n);assert.notEqual(offer.kind,'epic_seed');}});

test('single common and secret refuse 95 percent and remember refusal',()=>{for(const rarity of ['common','secret']){const list=discs(rarity);for(const roll of [500,9999])assert.equal(makeOffer(list,()=>roll).refused,true);for(const roll of [0,499]){let first=true;assert.ok(makeOffer(list,n=>{if(first){first=false;return roll;}return 0;}).chest);}const cache={};getRememberedOffer(cache,list,()=>9999);const next=getRememberedOffer(JSON.parse(JSON.stringify(cache)),list,()=>{throw Error('no reroll');});assert.equal(next.reused,true);assert.equal(next.offer.refused,true);}});

test('random badge title and finish are remembered with the complete offer',()=>{
 const cache={},rolls=[0,2,800000,100000,0];let index=0;
 const result=getRememberedOffer(cache,discs('legendary','common'),n=>(rolls[index++]||0)%n);
 assert.equal(result.offer.kind,'badge');assert.ok(result.offer.badge.title);assert.ok(result.offer.badge.finish);
 const again=getRememberedOffer(JSON.parse(JSON.stringify(cache)),discs('legendary','common'),()=>{throw Error('must not reroll badge');});
 assert.deepEqual(again.offer.badge,result.offer.badge);
});
