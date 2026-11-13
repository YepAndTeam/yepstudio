import test from 'node:test';
import assert from 'node:assert/strict';
import {recordNyanTrail,nyanTrailY} from './nyanTrailCore.js';
test('trail remembers previous flight height with interpolation rather than snapping with the cat',()=>{
 const state={};for(let i=0;i<=30;i++)recordNyanTrail(state,100-i*2,i/30);
 assert.equal(nyanTrailY(state.nyanTrail,1,0),40);assert.equal(nyanTrailY(state.nyanTrail,.5,0),70);
 assert.equal(nyanTrailY(state.nyanTrail,-1,0),100);assert.equal(nyanTrailY(null,1,55),55);
});
test('trail history is bounded, throttled, and belongs to its run',()=>{
 const state={};for(let i=0;i<10000;i++)recordNyanTrail(state,i,i/120);
 assert.ok(state.nyanTrail.length<=48);const before=state.nyanTrail.length;recordNyanTrail(state,99,9999/120);assert.equal(state.nyanTrail.length,before);
 const fresh={};recordNyanTrail(fresh,5,0);assert.equal(fresh.nyanTrail.length,1);assert.notEqual(fresh.nyanTrail,state.nyanTrail);
});
