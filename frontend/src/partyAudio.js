// Short procedural foley: no downloads, decoding loops, or audio timers.
export function createPartyAudio(kind){
 const ctx=new (window.AudioContext||window.webkitAudioContext)(),master=ctx.createGain();master.gain.value=.18;master.connect(ctx.destination);
 const ambience=ctx.createGain();ambience.gain.value=.018;ambience.connect(master);
 const hum=ctx.createOscillator();hum.frequency.value=kind==='bunker'?55:46.25;hum.connect(ambience);hum.start();
 const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2.5),ctx.sampleRate),samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 function tone(f,at,duration,volume=.3,type='sine',end=f){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),at+duration);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(master);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
 function hiss(at,duration,volume,frequency=1400,attack=.003){const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=noise;f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+Math.min(attack,duration/2));g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f);f.connect(g);g.connect(master);s.start(at);s.stop(at+duration+.02);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
 return {ctx,emit(event){if(ctx.state!=='running'||document.hidden)return;const t=ctx.currentTime+.01;
  if(event==='shot'){hiss(t,.17,.8,6000);tone(135,t,.22,.8,'sine',32);hiss(t+.08,.33,.17,900);tone(1900,t+.24,.045,.11,'triangle',1200);tone(2300,t+.35,.035,.07,'triangle',1500);}
  else if(event==='chat'){tone(740,t,.10,.16,'sine',660);tone(988,t+.10,.16,.10);}
  else if(event==='check'){hiss(t,.035,.2,2800);for(let i=0;i<4;i++)tone(550+i*160,t+.09+i*.10,.07,.18,'triangle');tone(1320,t+.58,.18,.24);tone(1760,t+.77,.22,.13);}
  else if(event==='heal'){hiss(t,.30,.12,2400,.08);[261.63,329.63,392,523.25].forEach((f,i)=>tone(f,t+.13+i*.12,.55,.18,'sine'));tone(1046.5,t+.65,.40,.07);}
  else if(event==='death'){hiss(t,1.8,.32,1100,.85);tone(73.42,t,2.3,.40,'triangle',48);tone(77.78,t+.17,2.1,.22,'sine',51.91);tone(36.71,t+.8,1.5,.45);}
  else if(event==='safe'){[392,493.88,587.33].forEach((f,i)=>tone(f,t+i*.18,.5,.15));hiss(t,.6,.035,1600,.2);}
  else if(event==='night'){hiss(t,1.1,.12,800,.35);tone(98,t,1.5,.22,'sine',49);}
  else if(event==='finish'){[261.63,329.63,392,523.25].forEach((f,i)=>tone(f,t+i*.18,.6,.18));}
  else if(event==='paper'){hiss(t,.12,.15,1800,.025);hiss(t+.14,.16,.08,2300,.025);}
  else if(event==='vote'){tone(330,t,.09,.22,'triangle',190);hiss(t,.055,.09,1200);}
  else {hiss(t,.06,.08,1300);tone(196,t+.05,.3,.13,'sine',146.83);}
 },close(){hum.stop();hum.disconnect();ambience.disconnect();void ctx.close();}};
}
