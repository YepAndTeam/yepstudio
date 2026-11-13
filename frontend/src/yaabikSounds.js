// [delay, frequency, seconds, end frequency, waveform, level]. Small robot phrases.
const tone=(delay,hz,duration,end=hz,type='sine',level=.055)=>[delay,hz,duration,end,type,level];
export const yaabikCues={
 stepLeft:[tone(0,150,.065,75,'triangle',.018)],stepRight:[tone(0,135,.07,72,'triangle',.017)],
 tap:[tone(0,410,.09,480,'sine',.03)],grumble:[tone(0,220,.18,150,'triangle',.045),tone(.2,180,.23,105,'triangle',.04)],
 hello:[tone(0,520,.12,670),tone(.15,780,.17,850)],
 pet:[tone(0,280,.26,420),tone(.12,160,.3,210,'triangle',.035)],
 purr:[tone(0,125,.5,145,'triangle',.045),tone(.16,185,.34,155,'sine',.025)],
 pickup:[tone(0,380,.24,950)],putdown:[tone(0,510,.16,260)],
 play:[tone(0,450,.1,700),tone(.13,670,.12,980),tone(.28,850,.12,670)],
 sleep:[tone(0,520,.6,130,'triangle',.045)],wake:[tone(0,230,.2,550)],
 click:[tone(0,110,.035,70,'triangle',.04)],
 projectorOn:[tone(0,110,.035,70,'triangle',.04),tone(.08,180,.35,480,'triangle',.025),tone(.48,690,.15,950)],
 projectorOff:[tone(0,130,.04,70,'triangle',.04),tone(.08,440,.2,170)],
 dock:[tone(0,170,.07,130,'triangle',.04),tone(.1,410,.13,610),tone(.27,650,.16,820)],
 undock:[tone(0,650,.1,510),tone(.13,400,.15,230)],full:[tone(0,520,.14),tone(.18,660,.14),tone(.36,880,.25)],
 empty:[tone(0,420,.18,270),tone(.23,260,.23,170)],
 common:[tone(0,120,.04,80,'triangle',.04),tone(.15,470,.16,570)],
 rare:[tone(0,130,.04,80,'triangle',.04),tone(.15,520,.12),tone(.3,740,.2)],
 epic:[tone(0,130,.04,80,'triangle',.04),tone(.15,520,.12),tone(.29,740,.12),tone(.43,980,.2)],
 mythic:[tone(0,130,.04,80,'triangle',.04),tone(.14,600,.1),tone(.26,800,.1),tone(.38,1100,.1),tone(.5,1400,.18)],
 legendary:[tone(0,130,.04,80,'triangle',.04),...Array.from({length:6},(_,i)=>tone(.14+i*.095,[520,650,780,1040,780,1300][i],.14))],
 secret:[tone(0,95,.05,70,'triangle',.03),tone(.1,260,.55,420,'sine',.03),tone(.16,263,.5,425,'sine',.02)],
 idle:[tone(0,280,.1,330,'triangle',.025),tone(.2,390,.16,290,'sine',.025)]
};
export function createYaabikSounds({contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(),isHidden=()=>document.hidden}={}){
 let context,enabled=true,generation=0,last={voice:-Infinity,step:-Infinity},voices=new Set();
 const stop=()=>{generation++;for(const voice of voices){try{voice.stop();}catch{}voice.disconnect();}voices.clear();};
 const unlock=()=>{if(!enabled||isHidden())return Promise.resolve(false);try{context??=contextFactory();return Promise.resolve(context.resume()).then(()=>context.state==='running').catch(()=>false);}catch{return Promise.resolve(false);}};
 return {unlock,stop,stopSteps(){for(const v of voices)if(v.yaabikStep){try{v.stop();}catch{}v.disconnect();voices.delete(v);}},setEnabled(value){enabled=value;if(!value)stop();},
 async play(kind){if(!enabled||isHidden()||!yaabikCues[kind])return false;const token=generation;if(!await unlock()||token!==generation||!enabled||isHidden())return false;const step=kind==='stepLeft'||kind==='stepRight',channel=step?'step':'voice';if(context.currentTime-last[channel]<.12)return false;if(!step)stop();last[channel]=context.currentTime;
  for(const [delay,hz,duration,end,type,level] of yaabikCues[kind]){const osc=context.createOscillator(),gain=context.createGain(),at=context.currentTime+.01+delay;osc.type=type;osc.frequency.setValueAtTime(hz,at);osc.frequency.exponentialRampToValueAtTime(end,at+duration);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(context.destination);osc.yaabikStep=step;voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.015);}return true;
 },dispose(){stop();if(context)void context.close().catch(()=>{});context=null;}};
}
