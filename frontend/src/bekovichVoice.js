// Based on the user-supplied letter-blip idea; no radio noise or PTT effects.
const MOODS={normal:{f:1,s:1,v:.5},conspiratorial:{f:.8,s:1.15,v:.35},excited:{f:1.23,s:.78,v:.6},chuckles:{f:1.05,s:1,v:.5}};
export function planBekovichVoice(text,mood='normal'){
 const md=MOODS[mood]||MOODS.normal,letters=[...text],notes=[];let at=0;
 for(let index=0;index<letters.length;index++){
  const char=letters[index];let step=.048*md.s;
  if(/[а-яёa-z]/i.test(char)){const tail=letters.slice(index+1,index+6).join(''),question=tail.indexOf('?'),rise=question>=0?1+(5-question)*.045:1,upper=char!==char.toLowerCase()?1.09:1;
   const frequency=105*md.f*Math.pow(2,((char.toLowerCase().charCodeAt(0)%9)-4)/12)*upper*rise*(1+Math.sin(index*3.7)*.035);
   notes.push({index,at,frequency,duration:Math.max(.05,step*1.3),volume:md.v});
  }else if(/[.!?…]/.test(char))step+=char==='.'&&letters[index+1]==='.'?.035:.23;else if(/[,—]/.test(char))step+=.10;else if(char===' ')step*=.72;
  at+=step;
 }
 return {notes,duration:at+.12};
}
export function createBekovichVoice(){
 const ctx=new (window.AudioContext||window.webkitAudioContext)(),out=ctx.createGain(),tone=ctx.createBiquadFilter(),sources=new Set();out.gain.value=.27;tone.type='lowpass';tone.frequency.value=1800;out.connect(tone);tone.connect(ctx.destination);
 function stop(){for(const source of sources){try{source.stop();}catch{}}sources.clear();}
 return {unlock:()=>ctx.resume(),stop,play(plan){stop();const start=ctx.currentTime+.015;for(const note of plan.notes){const o=ctx.createOscillator(),g=ctx.createGain(),t=start+note.at;o.type='sawtooth';o.frequency.setValueAtTime(note.frequency,t);o.frequency.exponentialRampToValueAtTime(note.frequency*.88,t+note.duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(note.volume*.35,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+note.duration);o.connect(g);g.connect(out);sources.add(o);o.start(t);o.stop(t+note.duration+.025);o.onended=()=>{sources.delete(o);o.disconnect();g.disconnect();};}},close(){stop();out.disconnect();tone.disconnect();void ctx.close();}};
}
