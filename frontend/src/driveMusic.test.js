import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDriveMusic} from './driveMusic.js';
test('race music requires a user gesture and stops with its playback gate',async()=>{
 const calls={plays:0,pauses:0,closed:0};let load;
 const player={setVolume(v){calls.volume=v;},setTrack(fn){load=fn;},play:async()=>{calls.plays++;},pause(){calls.pauses++;},unlock:async()=>{},seek:async()=>{},close(){calls.closed++;}};
 const music=createDriveMusic(player);assert.equal(calls.volume,.14);assert.equal(typeof load,'function');
 music.setEnabled(true);assert.equal(calls.plays,0);await music.unlock();assert.equal(calls.plays,1);
 music.setEnabled(false);const paused=calls.pauses;assert.ok(paused>0);
 await music.unlock();assert.equal(calls.plays,1);
 music.setEnabled(true);assert.equal(calls.plays,2);music.restart();assert.ok(calls.pauses>paused);
 await music.unlock();assert.equal(calls.plays,2);
 music.release();assert.equal(calls.closed,1);music.setEnabled(true);assert.equal(calls.plays,2);
 await music.unlock();assert.equal(calls.plays,3);
});
