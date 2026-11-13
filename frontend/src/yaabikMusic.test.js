import test from 'node:test';
import assert from 'node:assert/strict';
import {musicTimeline,danceBeat} from './yaabikMusic.js';
import {midiNotes,midiInfo} from './yaabikMidiData.js';
test('correct MIDI excerpt is bounded to 50–74 seconds with original polyphony',()=>{
 const events=musicTimeline();assert.equal(events.length,midiInfo.notes);assert.ok(events.length>100);assert.equal(midiInfo.clipStart,50);assert.equal(midiInfo.clipEnd,74);assert.equal(midiInfo.duration,24);assert.ok(midiInfo.sourceDuration>74);assert.equal(danceBeat,120/midiInfo.bpm);
 for(let i=0;i<events.length;i++){const e=events[i];assert.ok(e.time>=0);assert.ok(e.duration>0);assert.ok(e.time+e.duration<=24.000001);assert.ok(e.velocity>0&&e.velocity<=127);assert.ok(Number.isFinite(e.frequency));assert.equal(e.time,midiNotes[i][1]);if(i)assert.ok(e.time>=events[i-1].time);}
 assert.ok(events.some((e,i)=>i&&e.time<events[i-1].time+events[i-1].duration));
});
