// User-supplied Arduino notes. null is REST; lengths reproduce integer 1000/d.
export const suppliedNotes=[
 70,null,70,null,70,null,70,null,
 70,71,75,70,null,70,null,
 70,71,75,70,null,70,null,
 70,71,75,70,null,70,null,
 70,71,75,77,null,77,null,
 80,78,77,70,null,70,null,
 80,78,77,70,null,70,null,
 70,71,75,70,null,70,null,
 70,71,75,70,null,70,null,null,
];
export const suppliedDurations=[4,4,4,4,4,4,4,4,...Array.from({length:8},()=>[3,3,4,4,4,4,4]).flat(),1];
export function suppliedTimeline({tempo=1,transpose=0}={}){
 if(suppliedNotes.length!==suppliedDurations.length)throw Error('Notes and durations must match');
 let cursor=0;
 const notes=suppliedNotes.map((midi,i)=>{const ms=Math.floor(1000/suppliedDurations[i]),duration=ms/1000/tempo,event={midi:midi===null?null:midi+transpose,start:cursor,duration};cursor+=Math.floor(ms*1.3)/1000/tempo;return event;});
 return {notes,duration:cursor};
}
export function renderSuppliedMelody({arranged=false,backing=false,seamless=false,tempo=1,transpose=0}={}){
 const sampleRate=22050,timeline=suppliedTimeline({tempo,transpose}),beat=.65/tempo,leadDuration=seamless&&timeline.notes.at(-1).midi===null?timeline.notes.at(-1).start:timeline.duration,duration=(arranged||backing)?Math.ceil(leadDuration/(beat*4))*beat*4:leadDuration;
 const frames=Math.ceil(duration*sampleRate),left=new Float32Array(frames),right=new Float32Array(frames);
 let seed=1189;const noise=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2147483648-1;};
 const hz=n=>440*2**((n-69)/12),tau=Math.PI*2;
 function voice(time,length,volume,wave,pan=0){
  const start=Math.round(time*sampleRate),count=Math.ceil(length*sampleRate),l=volume*(1-pan*.45),r=volume*(1+pan*.45);
  for(let i=0;i<count&&start+i<frames;i++){const t=i/sampleRate,envelope=Math.min(1,t/.003,(length-t)/.008),v=wave(t,length)*Math.max(0,envelope);left[start+i]+=v*l;right[start+i]+=v*r;}
 }
 for(const {midi,start,duration:len} of timeline.notes){
  if(midi===null)continue;const frequency=hz(midi);
  if(!arranged){let previous=0;voice(start,len,.21,t=>{const square=Math.sin(tau*frequency*t)>0?1:-1;previous+=.42*(square-previous);return previous;});}
  else voice(start,len,.17,t=>(Math.sign(Math.sin(tau*frequency*t))*.6+Math.sign(Math.sin(tau*frequency*1.481*t))*.3)*Math.exp(-t*10),.08);
 }
 if(arranged){
  const roots=[34,34,35,32];
  for(let bar=0;bar<duration/(beat*4);bar++){
   const base=bar*beat*4,root=roots[bar%4]+transpose;
   for(const b of [0,1.5,2,3.25])voice(base+b*beat,.25,.52,t=>Math.sin(tau*(39*t+(150-39)*.035*(1-Math.exp(-t/.035))))*Math.exp(-t*16));
   for(const b of [1,3]){let low=0;voice(base+b*beat,.15,.18,t=>{const n=noise();low+=.15*(n-low);return ((n-low)*.8+Math.sin(tau*175*t)*.28)*Math.exp(-t*28);});}
   for(let n=0;n<8;n++){let low=0;voice(base+n*.5*beat,.045,n%2?.055:.035,t=>{const v=noise();low+=.4*(v-low);return (v-low)*Math.exp(-t*65);},n%2?.3:-.3);}
   for(const [b,shift,len] of [[0,0,.7],[.75,0,.35],[1.5,12,.35],[2,0,.65],[2.75,7,.3],[3.5,0,.4]]){
    const frequency=hz(root+shift);voice(base+b*beat,len*beat,.23,t=>Math.tanh(Math.sin(tau*frequency*t)*2)*Math.exp(-t*2)*(0.35+Math.min(1,t/.1)*.65));
   }
   for(const [i,n] of [root+24,root+27,root+31].entries())voice(base+.1,beat*2,.022,t=>(Math.sin(tau*hz(n)*t)+.15*Math.sin(tau*hz(n)*2*t))*Math.exp(-t*2),(i-1)*.5);
  }
 }
 // Gentle arcade backing keeps the square-wave lead in front.
 if(backing&&!arranged){
  const roots=[34,34,35,32];
  for(let bar=0;bar<duration/(beat*4);bar++){
   const base=bar*beat*4,root=roots[bar%4]+transpose;
   for(const b of [0,2])voice(base+b*beat,.2,.16,t=>Math.sin(tau*(44*t+65*.025*(1-Math.exp(-t/.025))))*Math.exp(-t*20));
   for(const b of [1,3])voice(base+b*beat,.065,.035,t=>(noise()*.55+Math.sin(tau*520*t)*.25)*Math.exp(-t*65),.18);
   for(let n=0;n<8;n++){let low=0;voice(base+n*.5*beat,.032,n%2?.014:.008,t=>{const v=noise();low+=.45*(v-low);return (v-low)*Math.exp(-t*85);},n%2?.3:-.3);}
   for(const [b,shift,len] of [[0,0,.8],[1.5,12,.35],[2,0,.75],[3.25,7,.4]]){
    const f=hz(root+shift);voice(base+b*beat,len*beat,.09,t=>(Math.sin(tau*f*t)+.3*Math.sin(tau*f*2*t))*Math.exp(-t*3)*Math.min(1,t/.015));
   }
   for(const [i,n] of [root+24,root+27,root+31].entries())voice(base+.05,beat*3.8,.014,t=>(Math.sin(tau*hz(n)*t)+.15*Math.sin(tau*hz(n)*2.005*t))*Math.min(1,t/.18)*Math.exp(-t*1.5),(i-1)*.65);
   if(bar%2===1)voice(base+3.5*beat,.3,.016,t=>Math.sin(tau*hz(root+43)*t)*Math.exp(-t*10),-.4);
  }
  for(const {midi,start,duration:len} of timeline.notes)if(midi!==null)voice(start+beat*.75,len*.8,.014,t=>Math.sin(tau*hz(midi)*t)*Math.exp(-t*12),-.45);
 }
 let peak=0,power=0;for(let i=0;i<frames;i++){left[i]=Math.tanh(left[i]*1.2);right[i]=Math.tanh(right[i]*1.2);peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
 const scale=.85/Math.max(peak,.01);for(let i=0;i<frames;i++){left[i]*=scale;right[i]*=scale;power+=left[i]**2+right[i]**2;}
 const wav=new ArrayBuffer(44+frames*4),view=new DataView(wav),text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*4,true);
 for(let i=0;i<frames;i++){view.setInt16(44+i*4,Math.round(left[i]*32767),true);view.setInt16(46+i*4,Math.round(right[i]*32767),true);}
 return {blob:new Blob([wav],{type:'audio/wav'}),duration:frames/sampleRate,sampleRate,peak:.85,rms:Math.sqrt(power/(frames*2))};
}
