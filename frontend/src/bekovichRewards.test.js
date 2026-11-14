import test from 'node:test';
import assert from 'node:assert/strict';
import {rollJeraBox,rollUsb} from './bekovichRewards.js';
test('coin amounts have decreasing weights and inclusive range 5..50',()=>{
 const counts={};for(let i=0;i<1081;i++){const amount=rollJeraBox(()=>i);counts[amount]=(counts[amount]||0)+1;}
 assert.equal(Object.keys(counts).length,46);
 for(let amount=5;amount<=50;amount++)assert.equal(counts[amount],51-amount);
});
test('USB player 30/70, empty 50/50, nonempty amounts 60/30/9/1',()=>{
 const counts={themes:0,dvd:0,empty:0,full:0},amounts={};
 for(let i=0;i<100;i++){
  let rolls=[i,0];const player=rollUsb(()=>rolls.shift());counts[player.player]++;
  rolls=[0,i,0];counts[rollUsb(()=>rolls.shift()).opens?'full':'empty']++;
  rolls=[0,99,i];const amount=rollUsb(()=>rolls.shift()).opens;amounts[amount]=(amounts[amount]||0)+1;
 }
 assert.deepEqual(counts,{themes:30,dvd:70,empty:50,full:50});
 assert.deepEqual(amounts,{1:60,3:30,5:9,10:1});
});

test('USB content survives remembered offers without a second roll',async()=>{const {getRememberedOffer}=await import('./bekovichTrade.js');const discs=[{id:'1',item:{id:'minecraft'},rarity:'legendary'},{id:'2',item:{id:'doom'},rarity:'common'}],cache={},rolls=[0,3,29,50,99];let i=0;const first=getRememberedOffer(cache,discs,()=>rolls[i++]);assert.deepEqual(first.offer.usb,{player:'themes',opens:10});const second=getRememberedOffer(JSON.parse(JSON.stringify(cache)),discs,()=>{throw Error('no reroll');});assert.deepEqual(second.offer.usb,first.offer.usb);});
