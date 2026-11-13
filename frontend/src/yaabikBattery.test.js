import test from 'node:test';
import assert from 'node:assert/strict';
import {batteryAt,dockBattery,spendBattery} from './yaabikBattery.js';
test('charging uses elapsed real time including time outside the app, capped at 100',()=>{
 const start={level:65,docked:true,updatedAt:1000};assert.equal(batteryAt(start,121000).level,75);assert.equal(batteryAt(start,3601000).level,100);
 assert.equal(batteryAt(start,0).level,65);
});
test('undocking preserves the charge and absence never drains battery',()=>{
 const state=dockBattery({level:20,docked:true,updatedAt:0},false,60000);assert.equal(state.level,25);assert.equal(batteryAt(state,999999999).level,25);
});
test('only active interactions spend battery and charge is clamped',()=>{
 assert.equal(spendBattery({level:2,updatedAt:0,docked:false},3,0).level,0);
 assert.equal(spendBattery({level:50,updatedAt:0,docked:true},3,60000).level,55);
 assert.equal(batteryAt(null,0).level,65);
});

test('empty battery automatically docks and starts real-time recharge',()=>{
 const empty=spendBattery({level:1,docked:false,updatedAt:1000},3,1000);
 assert.equal(empty.level,0);assert.equal(empty.docked,true);assert.equal(batteryAt(empty,61000).level,5);
 assert.equal(dockBattery(empty,false,1000).docked,true);
 const legacy=batteryAt({level:0,docked:false,updatedAt:0},100000);
 assert.equal(legacy.level,0);assert.equal(legacy.docked,true);assert.equal(legacy.updatedAt,100000);
});
