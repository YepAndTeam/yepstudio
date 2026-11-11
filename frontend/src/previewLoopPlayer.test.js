import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreviewLoopPlayer} from './previewLoopPlayer.js';
function setup(){
 const sources=[],ctx={currentTime:10,destination:{},resume:async()=>{},close:async()=>{},createGain:()=>({gain:{setTargetAtTime(){}},connect(){}}),decodeAudioData:async()=>({duration:12}),createBufferSource:()=>{const node={connect(){},start(when,offset){this.offset=offset;},stop(){this.stopped=true;this.onended?.();}};sources.push(node);return node;}};
 const player=new PreviewLoopPlayer({contextFactory:()=>ctx});player.setTrack(async()=>new ArrayBuffer(0));return {player,ctx,sources};
}
test('looping uses a single audio source across multiple loop boundaries',async()=>{
 const {player,ctx,sources}=setup();await player.play();assert.equal(sources[0].loop,true);assert.equal(sources[0].loopEnd,12);
 ctx.currentTime+=25;assert.equal(player.position,1);assert.equal(sources.length,1);
 player.pause();assert.equal(player.position,1);await player.play();assert.equal(sources[1].offset,1);
});
test('pending playback cannot start after pause or switching tracks',async()=>{
 const {player,sources}=setup();const pending=player.play();player.pause();await pending;assert.equal(sources.length,0);
 const next=player.play();player.setTrack(async()=>new ArrayBuffer(4));await next;assert.equal(sources.length,0);
});
test('seeking and disabling repeat update audio transport',async()=>{
 const {player,sources}=setup();await player.play();await player.seek(8);assert.equal(sources[1].offset,8);assert.ok(sources[0].stopped);
 player.setLoop(false);assert.equal(sources[1].loop,false);sources[1].onended();assert.equal(player.playing,false);assert.equal(player.position,0);
});
test('audio contexts can be unlocked silently and reopened after leaving the game',async()=>{
 const {player,sources}=setup();await player.unlock();assert.equal(sources.length,0);
 await player.play();player.close();assert.equal(player.context,null);assert.equal(player.playing,false);
 await player.play();assert.equal(player.playing,true);assert.equal(sources.length,2);
});
