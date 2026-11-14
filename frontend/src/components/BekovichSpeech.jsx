import {useEffect,useRef,useState} from 'react';
import {usePreferences} from '../preferences';
import {backgroundMusic} from '../backgroundMusic';
import {createBekovichVoice,planBekovichVoice} from '../bekovichVoice';
export default function BekovichSpeech({line,serial,enabled,onTalking,onRepeat}){
 const {musicEnabled}=usePreferences(),audio=useRef(null),callback=useRef(onTalking),[unlocked,setUnlocked]=useState(false),[replay,setReplay]=useState(0),[progress,setProgress]=useState({key:null,count:0});
 const runKey=serial+':'+line.id+':'+replay;
 const visible=enabled&&musicEnabled&&unlocked?(progress.key===runKey?progress.count:0):line.text.length;
 useEffect(()=>{callback.current=onTalking;},[onTalking]);
 useEffect(()=>{const unlock=()=>{if(!enabled||!musicEnabled)return;try{audio.current=audio.current||createBekovichVoice();void audio.current.unlock();setUnlocked(true);}catch{}};document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};},[enabled,musicEnabled]);
 useEffect(()=>{
  let timer,finish;const stop=()=>{clearInterval(timer);clearTimeout(finish);audio.current?.stop();callback.current?.(false);backgroundMusic.setDucked(false);};
  const hide=()=>{if(document.hidden){stop();setProgress({key:runKey,count:line.text.length});}};document.addEventListener('visibilitychange',hide);
  if(enabled&&musicEnabled&&unlocked&&!document.hidden){const plan=planBekovichVoice(line.text,line.mood),started=performance.now();backgroundMusic.setDucked(true);callback.current?.(true);audio.current?.play(plan);timer=setInterval(()=>{const elapsed=(performance.now()-started)/1000;const next=plan.notes.find(n=>n.at>elapsed);setProgress({key:runKey,count:next?next.index:line.text.length});},45);finish=setTimeout(()=>{setProgress({key:runKey,count:line.text.length});stop();},plan.duration*1000+100);}
  else stop();
  return()=>{stop();document.removeEventListener('visibilitychange',hide);};
 },[line,serial,enabled,musicEnabled,unlocked,replay,runKey]);
 useEffect(()=>()=>{audio.current?.close();audio.current=null;},[]);
 return <div className="bek-speech" role="status"><span>БЕКОВИЧ <small>· {line.stage}</small></span><p aria-label={line.text}><span aria-hidden="true">{line.text.slice(0,visible)}</span></p><button type="button" className="bek-repeat-line" onClick={()=>onRepeat?onRepeat():setReplay(n=>n+1)}>Повторить реплику</button></div>;
}
