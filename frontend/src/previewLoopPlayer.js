// One looping AudioBufferSourceNode repeats on the audio clock, without media reloads.
export class PreviewLoopPlayer{
 constructor({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(),onChange=()=>{}}={}){this.contextFactory=contextFactory;this.onChange=onChange;this.context=null;this.source=null;this.buffer=null;this.decodePromise=null;this.load=null;this.offset=0;this.startedAt=0;this.generation=0;this.loop=true;this.volume=.25;}
 get playing(){return Boolean(this.source);}
 get position(){if(!this.source)return this.offset;const time=Math.max(0,this.context.currentTime-this.startedAt);return this.loop?time%this.buffer.duration:Math.min(time,this.buffer.duration);}
 setTrack(load){this.pause();this.load=load;this.buffer=null;this.decodePromise=null;this.offset=0;}
 async unlock(){
  if(!this.context){this.context=this.contextFactory();this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);}
  await this.context.resume();
 }
 async play(){
  if(this.source||!this.load)return;
  const token=++this.generation;
  await this.unlock();
  if(token!==this.generation)return;
  const load=this.load;
  this.decodePromise??=Promise.resolve().then(load).then(bytes=>this.context.decodeAudioData(bytes)).catch(error=>{this.decodePromise=null;throw error;});
  const buffer=await this.decodePromise;if(token!==this.generation)return;
  this.buffer=buffer;this.offset=Math.max(0,Math.min(this.offset,buffer.duration-.001));
  const source=this.context.createBufferSource();source.buffer=buffer;source.loop=this.loop;source.loopStart=0;source.loopEnd=buffer.duration;source.connect(this.gain);
  source.onended=()=>{if(this.source===source){this.source=null;this.offset=0;this.onChange();}};
  this.startedAt=this.context.currentTime-this.offset;this.source=source;source.start(0,this.offset);this.onChange();
 }
 pause(){++this.generation;this.offset=this.position;const source=this.source;this.source=null;if(source)source.stop();this.onChange();}
 async seek(seconds){const resume=this.playing;this.pause();this.offset=Math.max(0,seconds);if(resume)await this.play();this.onChange();}
 setLoop(value){this.loop=value;if(this.source)this.source.loop=value;}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.gain)this.gain.gain.setTargetAtTime(this.volume,this.context.currentTime,.01);}
 close(){this.pause();const context=this.context;this.context=null;this.gain=null;this.buffer=null;this.decodePromise=null;this.offset=0;if(context)void context.close().catch(()=>{});}
}
