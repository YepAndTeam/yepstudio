import {useEffect,useState} from 'react';
import {PARTY_EMOTES,PARTY_EMOTE_LABELS} from '../partyEmotes';
export default function PartyEmotes({room,viewerId,onEmote}){
 const [open,setOpen]=useState(false),[sending,setSending]=useState(false),[cooling,setCooling]=useState(false);
 useEffect(()=>{if(!cooling)return;const timer=setTimeout(()=>setCooling(false),4000);return()=>clearTimeout(timer);},[cooling]);
 const me=room.players.find(p=>p.id===viewerId),allowed=Boolean(onEmote&&me?.alive&&room.status==='active'&&room.phase!=='night');
 async function play(name){if(!allowed||sending||cooling)return;setSending(true);try{const accepted=await onEmote(name);if(accepted===false)return;setCooling(true);setOpen(false);}finally{setSending(false);}}
 return <div className="party-emotes"><button type="button" disabled={!allowed||sending} aria-expanded={open&&allowed} onClick={()=>setOpen(v=>!v)}>Жесты</button>{open&&allowed&&<><button className="party-emote-dismiss" aria-label="Закрыть жесты" onClick={()=>setOpen(false)}/><div className="party-emote-menu"><small>{cooling?'Пауза между жестами':'ЯАБИК ЗА СТОЛОМ'}</small>{Object.entries(PARTY_EMOTES).map(([name,label])=><button key={name} disabled={sending||cooling} onClick={()=>void play(name)}>{label}</button>)}<span>Жест видят все участники.</span></div></>}</div>;
}

export function PartyGestureLabel({emote,serverNow}){
 const [ended,setEnded]=useState(null);
 useEffect(()=>{const age=emote.local_at!==undefined?performance.now()/1000-emote.local_at:serverNow-emote.at;const timer=setTimeout(()=>setEnded(emote.id),Math.max(0,6-age)*1000);return()=>clearTimeout(timer);},[emote.id,emote.at,emote.local_at,serverNow]);
 return ended===emote.id||serverNow-emote.at>=6?null:<i className="party-table-emote">{PARTY_EMOTE_LABELS[emote.name]}</i>;
}
