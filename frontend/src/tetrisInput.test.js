import test from 'node:test';
import assert from 'node:assert/strict';
import {setSoftDrop} from './tetrisInput.js';
test('starting soft drop cannot consume almost a second of normal gravity at once',()=>{
 const state={soft:false,acc:.79};setSoftDrop(state,true);
 assert.equal(state.acc,0);assert.equal(state.soft,true);
});
test('key repeat keeps accelerated progress and release stops acceleration',()=>{
 const state={soft:true,acc:.03};setSoftDrop(state,true);assert.equal(state.acc,.03);
 setSoftDrop(state,false);assert.equal(state.soft,false);
});
