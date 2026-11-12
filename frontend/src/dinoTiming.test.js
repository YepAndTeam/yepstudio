import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDino,DINO_STEP} from './dinoTiming.js';
const simulate=(hz)=>{const clock={acc:0},s={t:0,y:150,vy:-520,x:360};for(let i=0;i<hz*2;i++)advanceDino(clock,1/hz,dt=>{s.t+=dt;s.vy+=1900*dt;s.y=Math.min(150,s.y+s.vy*dt);s.x-=200*dt;});return s;};
test('30, 60 and 120Hz advance identical Dino time and movement',()=>{const a=simulate(30),b=simulate(60),c=simulate(120);for(const key of Object.keys(a)){assert.ok(Math.abs(a[key]-b[key])<1e-8);assert.ok(Math.abs(a[key]-c[key])<1e-8);}assert.ok(Math.abs(a.t-2)<1e-8);});
test('long frames have bounded catch-up and death stops remaining updates',()=>{let n=0;const clock={acc:0};advanceDino(clock,10,()=>{n++;});assert.equal(n,12);assert.ok(clock.acc<DINO_STEP);n=0;advanceDino(clock,.1,()=>{n++;return false;});assert.equal(n,1);assert.equal(clock.acc,0);});
test('negative elapsed time cannot move the simulation backwards',()=>{let n=0;const clock={acc:0};assert.equal(advanceDino(clock,-1,()=>n++),0);assert.equal(n,0);});
