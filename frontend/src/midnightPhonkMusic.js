// Original drift-phonk sketch. No recordings or samples from existing songs.
export async function renderMidnightPhonk(){
 const sampleRate=32000,bpm=132,beat=60/bpm,bars=32,duration=bars*4*beat;
 const frames=Math.round(duration*sampleRate),offline=new OfflineAudioContext(2,frames+sampleRate*3,sampleRate);
 const master=offline.createGain(),compressor=offline.createDynamicsCompressor(),music=offline.createGain(),bass=offline.createGain();
 master.gain.value=.7;compressor.threshold.value=-16;compressor.knee.value=10;compressor.ratio.value=3.5;compressor.attack.value=.004;compressor.release.value=.12;
 music.gain.value=.85;bass.gain.value=.85;music.connect(master);bass.connect(master);master.connect(compressor);compressor.connect(offline.destination);
 const echo=offline.createDelay(1),feedback=offline.createGain(),echoWet=offline.createGain();echo.delayTime.value=beat*.75;feedback.gain.value=.24;echoWet.gain.value=.14;echo.connect(feedback);feedback.connect(echo);echo.connect(echoWet);echoWet.connect(music);
 let seed=349813;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const noise=offline.createBuffer(1,sampleRate,sampleRate);for(let i=0;i<sampleRate;i++)noise.getChannelData(0)[i]=random()*2-1;
 const hz=midi=>440*2**((midi-69)/12),at=beats=>beats*beat;
 const driveCurve=new Float32Array(2048);for(let i=0;i<driveCurve.length;i++){const x=i/(driveCurve.length-1)*2-1;driveCurve[i]=Math.tanh(x*2.5)/Math.tanh(2.5);}
 function envelope(g,t,length,volume,attack=.003){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(volume,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+length);}
 function panTo(node,pan,bus=music){const p=offline.createStereoPanner();p.pan.value=pan;node.connect(p);p.connect(bus);return p;}
 function hiss(t,length,volume,frequency,kind='highpass',pan=0){const src=offline.createBufferSource(),filter=offline.createBiquadFilter(),gain=offline.createGain();src.buffer=noise;filter.type=kind;filter.frequency.value=frequency;filter.Q.value=.7;envelope(gain,t,length,volume);src.connect(filter);filter.connect(gain);panTo(gain,pan,master);src.start(t,random()*.5,length);}
 function kick(t,volume=1){
  const osc=offline.createOscillator(),gain=offline.createGain();osc.frequency.setValueAtTime(155,t);osc.frequency.exponentialRampToValueAtTime(46,t+.075);osc.frequency.exponentialRampToValueAtTime(38,t+.24);envelope(gain,t,.27,.65*volume,.002);osc.connect(gain);gain.connect(master);osc.start(t);osc.stop(t+.28);
  hiss(t,.018,.035*volume,2600);music.gain.setValueAtTime(.49,t);music.gain.exponentialRampToValueAtTime(.85,t+.13);bass.gain.setValueAtTime(.3,t);bass.gain.exponentialRampToValueAtTime(.85,t+.12);
 }
 function snare(t,soft=false){
  const gain=soft?.09:.16;for(const [delay,v] of [[0,1],[.013,.6],[.026,.4]])hiss(t+delay,.1,gain*v,1900,'bandpass');
  const osc=offline.createOscillator(),g=offline.createGain();osc.type='triangle';osc.frequency.setValueAtTime(190,t);osc.frequency.exponentialRampToValueAtTime(120,t+.07);envelope(g,t,.12,soft?.035:.065);osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+.13);
 }
 function sub(midi,t,length,accent=false){
  const osc=offline.createOscillator(),g=offline.createGain(),dist=offline.createWaveShaper(),filter=offline.createBiquadFilter();osc.type='sine';osc.frequency.setValueAtTime(hz(midi)*1.06,t);osc.frequency.exponentialRampToValueAtTime(hz(midi),t+.045);dist.curve=driveCurve;filter.type='lowpass';filter.frequency.value=700;envelope(g,t,length,accent?.42:.32,.009);osc.connect(g);g.connect(dist);dist.connect(filter);filter.connect(bass);osc.start(t);osc.stop(t+length+.01);
 }
 function bell(midi,t,length,volume,pan=0){
  const amp=offline.createGain(),filter=offline.createBiquadFilter();filter.type='lowpass';filter.frequency.value=4200;filter.Q.value=.4;envelope(amp,t,length,volume,.002);amp.connect(filter);const p=panTo(filter,pan);p.connect(echo);
  for(const [ratio,level] of [[1,.75],[1.481,.5],[2.01,.1]]){const osc=offline.createOscillator(),g=offline.createGain();osc.type='square';osc.frequency.value=hz(midi)*ratio;g.gain.value=level*.45;osc.connect(g);g.connect(amp);osc.start(t);osc.stop(t+length+.005);}
 }
 function pad(notes,t,length,volume){for(const [i,note] of notes.entries()){
  const osc=offline.createOscillator(),g=offline.createGain(),filter=offline.createBiquadFilter();osc.type='sawtooth';osc.frequency.value=hz(note);osc.detune.value=i%2?5:-5;filter.type='lowpass';filter.frequency.value=950;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(volume,t+.1);g.gain.exponentialRampToValueAtTime(.0001,t+length);osc.connect(filter);filter.connect(g);panTo(g,(i-1)*.25);osc.start(t);osc.stop(t+length+.01);
 }}
 const roots=[28,28,29,26],chords=[[52,55,59],[52,55,62],[53,57,60],[50,53,57]];
 const hooks=[[[0,76],[.75,76],[1.25,79],[1.75,77],[2.5,76],[3,71],[3.5,72],[3.75,71]],[[.25,76],[1,83],[1.5,79],[2.25,77],[2.75,76],[3.5,71]],[[0,77],[.75,81],[1.25,79],[2,77],[2.5,76],[3.25,72]],[[0,74],[.5,77],[1.25,76],[2,74],[2.75,72],[3.5,71]]];
 for(let bar=0;bar<bars;bar++){
  const offset=bar*4,root=roots[bar%4],intro=bar<4,breakdown=bar>=16&&bar<20,ending=bar>=28;
  const kicks=breakdown?[0,2.75]:intro?[0,2]:bar%2?[0,.75,2,2.75,3.5]:[0,1.5,2,3.25];
  for(const b of kicks)kick(at(offset+b),intro?.8:1);
  for(const b of breakdown?[2]:[1,3])snare(at(offset+b),intro||breakdown);
  if(!breakdown)for(let i=0;i<8;i++){const b=i*.5+(i%2?.025:0);hiss(at(offset+b),i%4===3?.085:.035,intro?.022:i%2?.038:.025,6800,'highpass',i%2?.22:-.2);}
  if(!intro&&!breakdown&&bar%4===3)for(const b of [3.5,3.625,3.75,3.875])hiss(at(offset+b),.025,.022,7500,'highpass',-.25+(b-3.5));
  const bassNotes=breakdown?[[0,root,1.3],[2.75,root,.7]]:[[0,root,.7],[.75,root,.4],[1.5,root+12,.35],[2,root,.6],[2.75,root,.35],[3.5,root+7,.4]];
  for(const [b,note,len] of bassNotes)sub(note,at(offset+b),at(len),b===0);
  pad(chords[bar%4],at(offset+.125),at(breakdown?3.5:1.65),breakdown?.023:.012);
  if(!intro&&!breakdown)pad(chords[bar%4].map(n=>n+12),at(offset+2.5),at(.5),.008);
  for(const [i,[b,note]] of hooks[bar%4].entries()){
   if(intro&&i%3!==0)continue;if(breakdown&&i>1)continue;
   bell(note,at(offset+b),at(breakdown?.7:.32),intro?.045:breakdown?.035:.082,i%2?.12:-.12);
   if((bar>=8&&bar<16||bar>=24)&&i%3===0)bell(note-12,at(offset+b+.03),at(.2),.026,-.28);
  }
  if((bar===7||bar===15||bar===27||bar===31)&&!breakdown){for(let j=0;j<3;j++)snare(at(offset+3.5+j*.166),true);}
  if(ending&&bar%2===0)bell(88,at(offset+2.75),at(.5),.028,.45);
 }
 const rendered=await offline.startRendering(),channels=[new Float32Array(frames),new Float32Array(frames)];let peak=0,power=0;
 // Fold delay tails into the start, so the exported recording can repeat.
 for(let c=0;c<2;c++){const src=rendered.getChannelData(c);for(let i=0;i<src.length;i++)channels[c][i%frames]+=src[i];for(const value of channels[c])peak=Math.max(peak,Math.abs(value));}
 const scale=.88/Math.max(.01,peak);for(const channel of channels)for(let i=0;i<frames;i++){channel[i]*=scale;power+=channel[i]*channel[i];}
 const wav=new ArrayBuffer(44+frames*4),view=new DataView(wav),text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*4,true);
 for(let i=0;i<frames;i++)for(let c=0;c<2;c++)view.setInt16(44+i*4+c*2,Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),true);
 return {blob:new Blob([wav],{type:'audio/wav'}),duration:frames/sampleRate,bpm,sections:{intro:0,hook:at(16),break:at(64),peak:at(80)},peak:.88,rms:Math.sqrt(power/(frames*2))};
}
