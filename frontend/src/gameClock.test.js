import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameClock,formatGameTime} from './gameClock.js';
test('real active time and simulation time are independent, stop and reset per run',()=>{
 const clock=createGameClock(),state={phase:'idle',t:0};clock(state,0);clock(state,5000);
 state.phase='run';clock(state,5000);state.t=2;
 assert.deepEqual(clock(state,6000),{real:1,game:2});
 state.phase='paused';clock(state,6500);assert.equal(clock(state,10000).real,1.5);
 state.phase='run';clock(state,10000);state.t=3;clock(state,10500,false);
 assert.equal(clock(state,20000,true).real,2);
 state.phase='dead';clock(state,20500);assert.equal(clock(state,30000).real,2.5);
 assert.deepEqual(clock({phase:'run',t:0},30000),{real:0,game:0});
});
test('time formatting stays readable after an hour',()=>{
 assert.equal(formatGameTime(0),'00:00');assert.equal(formatGameTime(65.9),'01:05');assert.equal(formatGameTime(3601),'60:01');
});
