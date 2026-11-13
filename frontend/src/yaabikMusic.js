import {midiNotes,midiInfo} from './yaabikMidiData.js';
export const danceBeat=120/midiInfo.bpm;
export function musicTimeline(){return midiNotes.map(([midi,time,duration,velocity,part])=>({frequency:440*2**((midi-69)/12),time,duration,velocity,part}));}
export function createYaabikMusic(){
 let context,interval,voices=new Set(),generation=0;
 const stop=()=>{generation++;clearInterval(interval);interval=null;for(const voice of voices){try{voice.stop();}catch{}voice.disconnect();}voices.clear();};
 return {
 unlock(){try{context=context||new (window.AudioContext||window.webkitAudioContext)();void context.resume().catch(()=>{});}catch{}},
 play(onEnd){stop();if(!context||context.state!=='running')return false;const token=generation,timeline=musicTimeline(),start=context.currentTime+.04;let cursor=0;const end=midiInfo.duration;
 const tick=()=>{if(token!==generation)return;while(cursor<timeline.length&&start+timeline[cursor].time<context.currentTime+.15){const event=timeline[cursor++];if(!event.frequency)continue;const osc=context.createOscillator(),gain=context.createGain(),at=start+event.time,volume=.17*(event.velocity/127);osc.type='triangle';osc.frequency.value=event.frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+Math.min(.008,event.duration/3));gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.45),at+event.duration*.8);gain.gain.linearRampToValueAtTime(0,at+event.duration+.04);osc.connect(gain);gain.connect(context.destination);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+event.duration+.05);}if(context.currentTime>=start+end){stop();onEnd?.();}};tick();interval=setInterval(tick,25);return true;},
 stop,
 dispose(){stop();void context?.close();context=null;}
 };
}
