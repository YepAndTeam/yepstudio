import test from 'node:test';
import assert from 'node:assert/strict';
import {tokyoNotes,tokyoDuration,renderTokyoMidi} from './tokyoMidiMusic.js';
test('Tokyo MIDI renders a full-bar loop with silent boundaries and audible notes',()=>{
 assert.equal(tokyoNotes.length,39);assert.equal(tokyoDuration,15);assert.ok(tokyoNotes.every(n=>n[1]+n[2]<=tokyoDuration));
 const bytes=renderTokyoMidi(),view=new DataView(bytes);assert.equal(view.getUint32(24,true),22050);assert.equal(bytes.byteLength,44+22050*15*2);assert.equal(view.getInt16(44,true),0);assert.equal(view.getInt16(bytes.byteLength-2,true),0);let peak=0;for(let at=44;at<bytes.byteLength;at+=2)peak=Math.max(peak,Math.abs(view.getInt16(at,true)));assert.ok(peak>1000&&peak<32767);
});
