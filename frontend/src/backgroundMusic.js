import { renderGoldenFlush } from "./goldenFlushMusic";
let context,bufferPromise,source,gain,wanted=false,generation=0,unlocked=false;
function stop(){generation++;if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
function prepare(){if(!context)return null;if(!bufferPromise)bufferPromise=renderGoldenFlush().then(({blob})=>blob.arrayBuffer()).then(data=>context.decodeAudioData(data)).catch(error=>{bufferPromise=null;throw error;});return bufferPromise;}
async function play(){
 if(!wanted||!unlocked||document.hidden||source||!context)return;
 const token=++generation;
 try{await context.resume();const buffer=await prepare();if(token!==generation||!wanted||document.hidden||source||context.state!=='running')return;
  if(!gain){gain=context.createGain();gain.gain.value=.16;gain.connect(context.destination);}
  source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);source.start();
 }catch{/* The next user gesture can resume a restricted mobile audio context. */}
}
export const backgroundMusic={
 setEnabled(value){wanted=value;if(!value)stop();else void play();},
 unlock(){if(!wanted)return;try{context=context||new (window.AudioContext||window.webkitAudioContext)();unlocked=true;void play();}catch{}},
 pause(){stop();},
};
