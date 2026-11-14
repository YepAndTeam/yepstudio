import {useEffect,useRef,useState} from 'react';
import {usePreferences} from '../preferences';
import {backgroundMusic} from '../backgroundMusic';
import {createPartyAudio} from '../partyAudio';
import {partySoundSnapshot,partySoundEvents} from '../partySoundEvents';
export default function PartySound({room,viewerId}){
 const {musicEnabled}=usePreferences(),[muted,setMuted]=useState(false),audio=useRef(null),previous=useRef(null);
 const enabled=musicEnabled&&!muted,kind=room.kind;
 useEffect(()=>{
  if(!enabled)return;
  backgroundMusic.setDucked(true);
  const unlock=()=>{if(document.hidden)return;try{if(!audio.current)audio.current=createPartyAudio(kind);void audio.current.ctx.resume();}catch{/* Retry on the next gesture on mobile. */}};
  const visibility=()=>{if(document.hidden)void audio.current?.ctx.suspend();};
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);audio.current?.close();audio.current=null;backgroundMusic.setDucked(false);};
 },[enabled,kind]);
 useEffect(()=>{const current=partySoundSnapshot(room,viewerId),events=partySoundEvents(previous.current,current);previous.current=current;if(enabled)for(const event of events)audio.current?.emit(event);},[room,viewerId,enabled]);
 return <button className="party-sound-toggle" aria-pressed={enabled} onClick={()=>setMuted(v=>!v)}>{enabled?'Звук: вкл':'Звук: выкл'}</button>;
}
