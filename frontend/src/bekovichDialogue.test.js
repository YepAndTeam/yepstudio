import test from 'node:test';import assert from 'node:assert/strict';import {BEKOVICH_DIALOGUE,chooseBekovichLine} from './bekovichDialogue.js';import {planBekovichVoice} from './bekovichVoice.js';
test('all 28 supplied replies have actions and contextual event pools',()=>{assert.equal(BEKOVICH_DIALOGUE.length,28);assert.equal(new Set(BEKOVICH_DIALOGUE.map(l=>l.id)).size,28);for(const event of ['greeting','appraisal','valuable','greedy','generous','deal','idle','empty','farewell']){const line=chooseBekovichLine(event,null,()=>0);assert.equal(line.event,event);assert.ok(line.stage&&line.action&&line.text);}assert.notEqual(chooseBekovichLine('greeting',1,()=>0).id,1);});
test('letter voice plans remain finite and end with the last syllable',()=>{for(const line of BEKOVICH_DIALOGUE){const plan=planBekovichVoice(line.text,line.mood);assert.ok(plan.notes.length>0);assert.ok(plan.duration>0&&plan.duration<10);let previous=-1;for(const note of plan.notes){assert.ok(note.at>=previous);previous=note.at;assert.ok(Number.isFinite(note.frequency)&&note.frequency>40&&note.frequency<300);assert.ok(note.at+note.duration<=plan.duration+.01);}}assert.equal(planBekovichVoice('...').notes.length,0);});

test('counting three is only used when three discs are on the counter',()=>{for(const discCount of [1,2])for(const roll of [0,.5,.999])assert.notEqual(chooseBekovichLine('appraisal',null,()=>roll,{discCount}).id,11);assert.equal(chooseBekovichLine('appraisal',5,()=>0,{discCount:3}).id,11);});

test('appraisal never claims ownership before confirmation, and idle respects empty counter',()=>{
 for(const discCount of [1,2,3])for(let i=0;i<100;i++)assert.notEqual(chooseBekovichLine('valuable',null,()=>i/100,{discCount,appraising:true}).id,10);
 for(let i=0;i<100;i++)assert.notEqual(chooseBekovichLine('idle',null,()=>i/100,{discCount:0}).id,24);
});
test('handover names the actual package and keeps the giving gesture',()=>{
 for(const chest of ['parcel','stash','worn','reserve']){const line=chooseBekovichLine('deal',16,()=>0,{chest});assert.equal(line.id,17);assert.equal(line.action,'give');if(chest==='parcel')assert.ok(line.text.includes('посылку'));else if(chest==='stash')assert.ok(line.text.includes('контейнер'));else assert.ok(line.text.includes('сундук'));}
});
