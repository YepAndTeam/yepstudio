// Original 12-bar background sketch. Rendered once, then played as one loop.
export async function renderGoldenFlush(){
 const sampleRate=22050,bpm=104,beat=60/bpm,bars=12,duration=bars*4*beat;
 const frames=Math.round(duration*sampleRate),tail=2;
 const offline=new OfflineAudioContext(2,frames+sampleRate*tail,sampleRate);
 const bus=offline.createGain();bus.gain.value=.72;
 const compressor=offline.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.008;compressor.release.value=.18;
 bus.connect(compressor);compressor.connect(offline.destination);
 const echo=offline.createDelay(.5),feedback=offline.createGain(),wet=offline.createGain();echo.delayTime.value=beat*.75;feedback.gain.value=.16;wet.gain.value=.12;echo.connect(feedback);feedback.connect(echo);echo.connect(wet);wet.connect(bus);
 let seed=2743;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const noise=offline.createBuffer(1,sampleRate,sampleRate);const noiseData=noise.getChannelData(0);for(let i=0;i<noiseData.length;i++)noiseData[i]=random()*2-1;
 const frequency=midi=>440*2**((midi-69)/12);
 function tone(midi,t,length,volume,type='triangle',pan=0,send=false){
  const osc=offline.createOscillator(),gain=offline.createGain(),panner=offline.createStereoPanner();
  osc.type=type;osc.frequency.value=frequency(midi);panner.pan.value=pan;
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.012);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.3),t+length*.55);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
  osc.connect(gain);gain.connect(panner);panner.connect(bus);if(send)panner.connect(echo);osc.start(t);osc.stop(t+length+.01);
 }
 function hiss(t,length,volume,highpass){const src=offline.createBufferSource(),filter=offline.createBiquadFilter(),gain=offline.createGain();src.buffer=noise;filter.type='highpass';filter.frequency.value=highpass;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+length);src.connect(filter);filter.connect(gain);gain.connect(bus);src.start(t,random()*.3,length);}
 function kick(t){const osc=offline.createOscillator(),gain=offline.createGain();osc.frequency.setValueAtTime(105,t);osc.frequency.exponentialRampToValueAtTime(44,t+.12);gain.gain.setValueAtTime(.32,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.19);osc.connect(gain);gain.connect(bus);osc.start(t);osc.stop(t+.2);}
 function drop(t,pan){const osc=offline.createOscillator(),gain=offline.createGain(),p=offline.createStereoPanner();p.pan.value=pan;osc.frequency.setValueAtTime(1100,t);osc.frequency.exponentialRampToValueAtTime(360,t+.085);gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.035,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+.14);osc.connect(gain);gain.connect(p);p.connect(bus);p.connect(echo);osc.start(t);osc.stop(t+.15);}
 const chords=[[38,53,57,60,64],[43,53,57,62,65],[46,53,57,60,62],[45,52,55,61,64]];
 const melodies=[[[.75,69],[1.5,72],[2.75,76],[3.25,72]],[[.5,74],[1.25,72],[2.5,69]],[[.75,65],[1.5,69],[2.75,72],[3.5,69]],[[.5,67],[1.5,64],[2.75,61],[3.5,64]]];
 for(let bar=0;bar<bars;bar++){
  const offset=bar*4,section=Math.floor(bar/4),chord=chords[bar%4],root=chord[0];
  for(const [at,note,len,vol] of [[0,root,.45,.2],[.75,root,.24,.12],[1.5,root+12,.25,.13],[2,root,.4,.18],[2.75,root+7,.22,.11],[3.5,root+12,.25,.12]])tone(note,(offset+at)*beat,len*beat,vol,'triangle');
  kick(offset*beat);kick((offset+2)*beat);if(bar%2===1)kick((offset+2.75)*beat);
  for(const at of [1,3]){hiss((offset+at)*beat,.075,.055,1300);tone(77,(offset+at)*beat,.035,.025,'triangle');}
  for(let step=0;step<8;step++){const at=step*.5+(step%2?.055:0);hiss((offset+at)*beat,.035,step%2?.022:.013,6500);}
  for(const at of [.5,2.5])chord.slice(1,4).forEach((note,i)=>tone(note,(offset+at)*beat,.28*beat,.026,'triangle',-.25+i*.25,true));
  // Sparse phrases leave room for reading and game sounds.
  for(const [at,note] of melodies[bar%4]){if(section===1&&at>2)continue;tone(note+(section===2&&bar%4===2?12:0),(offset+at)*beat,.27*beat,.048,'triangle',.15,true);tone(note+12,(offset+at)*beat,.13*beat,.007,'sine',-.15);}
  if(bar%2===0)drop((offset+3.75)*beat,bar%4===0?-.45:.45);
 }
 const rendered=await offline.startRendering();
 const channels=[new Float32Array(frames),new Float32Array(frames)];let peak=0;
 for(let c=0;c<2;c++){const src=rendered.getChannelData(c);for(let i=0;i<src.length;i++)channels[c][i%frames]+=src[i];for(const value of channels[c])peak=Math.max(peak,Math.abs(value));}
 const scale=.82/Math.max(peak,.01);for(const channel of channels)for(let i=0;i<frames;i++)channel[i]*=scale;
 const wav=new ArrayBuffer(44+frames*4),view=new DataView(wav);const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*4,true);
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++)view.setInt16(44+i*4+c*2,Math.max(-32768,Math.min(32767,Math.round(channels[c][i]*32767))),true);
 return {blob:new Blob([wav],{type:'audio/wav'}),duration:frames/sampleRate};
}
