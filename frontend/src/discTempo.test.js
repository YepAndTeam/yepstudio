import test from 'node:test';
import assert from 'node:assert/strict';
import {tempoMultiplier} from './discTempo.js';
import {advanceDino} from './dinoTiming.js';
test('tempo rating follows the agreed speed anchors and keeps slowdown',()=>{
 for(const [rating,speed] of [[1,1],[1.05,1.2],[1.1,1.5],[1.15,2],[1.2,2.5],[1.3,3.5],[.95,.95],[.9,.9]])assert.equal(tempoMultiplier(rating),speed);
});
test('fast Dino keeps the same simulated speed at 30, 60 and 120 Hz',()=>{
 for(const hz of [30,60,120])for(const speed of [1.2,1.5,2,3.5]){
  const clock={acc:0};let time=0;
  for(let i=0;i<hz;i++)advanceDino(clock,1/hz,dt=>{time+=dt;},speed);
  assert.ok(Math.abs(time-speed)<1e-8,`${hz}Hz at x${speed}: ${time}`);
 }
});
