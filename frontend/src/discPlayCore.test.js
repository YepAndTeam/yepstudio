import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiscBridge} from './discPlayCore.js';
test('disc starts, scores and leaderboard requests stay outside ranked routes',async()=>{
 const calls=[],api=async(...args)=>{calls.push(args);return {run_id:'next',effects:{tempo:1.15}};},bridge=createDiscBridge(api,()=>1000);
 const detach=bridge.attachDiscSession({deadline:2000,effects:{tempo:.95},first:{run_id:'prepared',effects:{tempo:.95}}});
 assert.equal(bridge.discTempo(),.95);assert.equal((await bridge.gameApi('/game/start','POST',{game:'dino'})).run_id,'prepared');assert.equal(calls.length,0);
 await bridge.gameApi('/game/score','POST',{game:'dino',score:100});assert.equal(calls[0][0],'/disc-play/score');assert.equal(calls[0][2].run_id,'prepared');
 await bridge.gameApi('/game/top?game=dino');assert.equal(calls[1][0],'/disc-play/top?game=dino');
 await bridge.gameApi('/game/start','POST',{game:'dino'});assert.equal(calls[2][0],'/disc-play/start');detach();
 await bridge.gameApi('/game/start','POST',{game:'dino'});assert.equal(calls[3][0],'/game/start');assert.equal(bridge.discTempo(),1);
});
test('expiry removes tempo and prevents starting another disc run',async()=>{
 let time=0;const bridge=createDiscBridge(async()=>{},()=>time);bridge.attachDiscSession({deadline:10,effects:{tempo:1.3}});assert.equal(bridge.discTempo(),3.5);time=10;assert.equal(bridge.discTempo(),1);await assert.rejects(bridge.gameApi('/game/start','POST',{game:'dino'}));
});
