import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suppliedNotes,suppliedDurations,suppliedTimeline,renderSuppliedMelody} from './suppliedMelody.js';
test('Arduino sequence retains all 65 notes and rests and integer delay timing',()=>{
 assert.equal(suppliedNotes.length,65);assert.equal(suppliedDurations.length,65);
 assert.deepEqual(suppliedNotes.slice(0,11),[70,null,70,null,70,null,70,null,70,71,75]);
 assert.deepEqual(suppliedNotes.slice(32,39),[77,null,77,null,80,78,77]);
 const t=suppliedTimeline();assert.ok(Math.abs(t.duration-23.812)<1e-8);assert.equal(t.notes[8].start,2.6);assert.equal(t.notes[8].duration,.333);assert.ok(Math.abs(t.notes[9].start-3.032)<1e-8);
});
test('pixel version exports a decodable stereo PCM WAV with silent final REST',async()=>{
 const result=renderSuppliedMelody(),bytes=await result.blob.arrayBuffer(),view=new DataView(bytes);
 assert.equal(view.getUint32(24,true),22050);assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(40,true),bytes.byteLength-44);
 let peak=0;for(let i=44;i<bytes.byteLength;i+=2)peak=Math.max(peak,Math.abs(view.getInt16(i,true)));assert.ok(peak>20000&&peak<30000);
 const rest=Math.ceil(suppliedTimeline().notes.at(-1).start*22050);for(let i=44+rest*4;i<bytes.byteLength;i+=2)assert.equal(view.getInt16(i,true),0);
});
test('arranged version keeps the supplied lead and adds a full-bar backing loop',()=>{
 const result=renderSuppliedMelody({arranged:true});assert.equal(result.duration,26);assert.ok(result.rms>0&&result.rms<.5);assert.equal(result.peak,.85);
});
test('faster lower variant renders the requested tempo and an audible G4 opening note',async()=>{
 const result=renderSuppliedMelody({tempo:1.15,transpose:-3});
 assert.ok(Math.abs(result.duration-23.812/1.15)<1/22050);
 const view=new DataView(await result.blob.arrayBuffer());let crossings=0;
 const start=Math.round(.02*22050),end=Math.round(.17*22050);
 for(let i=start+1;i<end;i++)if(view.getInt16(44+(i-1)*4,true)<=0&&view.getInt16(44+i*4,true)>0)crossings++;
 assert.ok(Math.abs(crossings/.15-392)<10);
});
test('gentle backing stays audible in lead rests and closes on a complete bar',async()=>{
 const result=renderSuppliedMelody({backing:true,tempo:1.15,transpose:-3});
 assert.ok(Math.abs(result.duration-26/1.15)<1/22050);
 const bytes=new DataView(await result.blob.arrayBuffer());
 const time=suppliedTimeline({tempo:1.15,transpose:-3}).notes.at(-1).start+.2;
 let power=0;for(let i=Math.round(time*22050);i<Math.round((time+.1)*22050);i++)power+=bytes.getInt16(44+i*4,true)**2;
 assert.ok(power>0);assert.ok(result.rms>0&&result.rms<.5);
});
test('seamless version drops only the final long REST and keeps a click-free boundary',async()=>{
 const tempo=1.3,t=suppliedTimeline({tempo,transpose:-3}),result=renderSuppliedMelody({tempo,transpose:-3,seamless:true}),view=new DataView(await result.blob.arrayBuffer());
 assert.ok(Math.abs(result.duration-t.notes.at(-1).start)<1/22050);
 assert.equal(view.getInt16(44,true),0);assert.equal(view.getInt16(view.byteLength-4,true),0);
 const lastNote=[...t.notes].reverse().find(note=>note.midi!==null);assert.ok(Math.abs((result.duration-lastNote.start)-.65/tempo)<1/22050);
});
