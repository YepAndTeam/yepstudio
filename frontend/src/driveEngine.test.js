import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDrive,stepDrive,steerDrive,driveSpeed,ROAD} from './driveEngine.js';
const running=()=>({...newDrive(),phase:'running',spawn:100});
test('collision ends a run, but a car in the adjacent lane is safe',()=>{
 const s=running();s.traffic=[{x:120,y:ROAD.playerY-2,speed:.7}];stepDrive(s,1/60);assert.equal(s.phase,'crashed');
 const safe=running();safe.traffic=[{x:70,y:ROAD.playerY-2,speed:.7}];stepDrive(safe,1/60);assert.equal(safe.phase,'running');
});
test('coins, overtakes and close calls are credited once',()=>{
 const s=running();s.x=94;s.target=94;s.pickups=[{x:94,y:ROAD.playerY}];s.traffic=[{x:120,y:ROAD.playerY+41,speed:.7,passed:false}];
 stepDrive(s,1/60);assert.equal(s.coins,1);assert.equal(s.near,1);assert.equal(s.passed,1);assert.equal(s.score,30);
 stepDrive(s,1/60);assert.equal(s.coins,1);assert.equal(s.near,1);assert.equal(s.passed,1);
});
test('paused or finished runs do not advance, steering stays inside the road',()=>{
 const s=newDrive();s.phase='paused';const before=structuredClone(s);stepDrive(s,.03);assert.deepEqual(s,before);
 steerDrive(s,-1,99);assert.equal(s.target,ROAD.left+14);steerDrive(s,1,99);assert.equal(s.target,ROAD.right-14);
});
test('every traffic row leaves an open lane, storage stays bounded',()=>{
 const s=running();s.time=25;s.spawn=0;const values=[.4,.8,.2,.2,.2,.2];stepDrive(s,1/60,()=>values.shift()??.2);
 assert.equal(s.traffic.length,2);assert.equal(new Set(s.traffic.map(c=>c.x)).size,2);assert.ok(s.pickups.every(c=>!s.traffic.some(car=>car.x===c.x)));
 for(let i=0;i<20000;i++){s.x=-100;s.target=-100;s.phase='running';stepDrive(s,1/60,()=>.2);}
 assert.ok(s.traffic.length<20);assert.ok(s.pickups.length<30);assert.ok(Number.isFinite(s.speed));assert.ok(Number.isFinite(s.score));
});
test('a long background frame cannot teleport traffic into the player',()=>{
 const s=running();s.traffic=[{x:120,y:100,speed:1}];stepDrive(s,60);assert.ok(s.traffic[0].y<110);assert.equal(s.phase,'running');
});

test('speed grows every 5000 points beyond the old top speed',()=>{
 const base=driveSpeed(120,0);
 assert.equal(driveSpeed(120,4999),base);
 assert.ok(Math.abs((driveSpeed(120,5000)-base)*.9-20)<1e-8);
 assert.ok(Math.abs((driveSpeed(120,25000)-base)*.9-100)<1e-8);
 assert.ok(driveSpeed(120,150000)>driveSpeed(120,100000));
});
test('passing 100k does not end the race',()=>{
 const s=running();s.distance=1200012;s.score=100000;s.time=120;
 stepDrive(s,1/60);assert.ok(s.score>100000);assert.equal(s.phase,'running');
});
test('fast traffic cannot tunnel through the player between frames',()=>{
 const s=running();s.score=10000000;s.traffic=[{x:120,y:ROAD.playerY-100,speed:1}];
 stepDrive(s,1/30);assert.equal(s.phase,'crashed');
 const safe=running();safe.score=10000000;safe.traffic=[{x:70,y:ROAD.playerY-100,speed:1}];
 stepDrive(safe,1/30);assert.equal(safe.phase,'running');
});

test('both lane dividers collide with neighboring traffic instead of forming an AFK corridor',()=>{
 for(const x of [95,145])for(const lane of ROAD.lanes.filter(l=>Math.abs(l-x)===25)){
  const s=running();s.x=x;s.target=x;s.traffic=[{x:lane,y:ROAD.playerY-2,speed:.7}];stepDrive(s,1/60);assert.equal(s.phase,'crashed',`divider ${x}, traffic ${lane}`);
 }
});
test('every stationary road position is reachable by traffic while a genuinely free lane stays safe',()=>{
 for(let x=ROAD.left+14;x<=ROAD.right-14;x++){
  const nearest=ROAD.lanes.reduce((a,b)=>Math.abs(a-x)<Math.abs(b-x)?a:b);
  const s=running();s.x=x;s.target=x;s.traffic=[{x:nearest,y:ROAD.playerY,speed:.7}];stepDrive(s,1/60);assert.equal(s.phase,'crashed',`stationary x=${x}`);
 }
 const safe=running();safe.traffic=[{x:70,y:ROAD.playerY,speed:.7},{x:170,y:ROAD.playerY,speed:.7}];stepDrive(safe,1/60);assert.equal(safe.phase,'running');
});
