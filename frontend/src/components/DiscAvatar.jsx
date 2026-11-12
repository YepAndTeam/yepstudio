import '../screens/DiscCollection.css';
import {useEffect,useState} from 'react';
import {DiscFace} from './DiscInspector';
export default function DiscAvatar({disc,letter='?'}){
 const [flipped,setFlipped]=useState(false),[now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const active=disc&&Date.parse(disc.expires_at)>now;
 return <button type="button" className={`ava profile-flip-avatar ${flipped?'is-flipped':''}`} aria-pressed={flipped} aria-label={flipped?'Показать букву профиля':'Перевернуть аватарку и показать диск'} onClick={()=>setFlipped(v=>!v)}><span className="avatar-flip-body"><span className="avatar-face avatar-letter" aria-hidden={flipped}>{letter}</span><span className="avatar-face avatar-disc" aria-hidden={!flipped}>{active?<DiscFace item={disc.item} rarity={disc.rarity} revealed/>:<span className="avatar-empty-disc">{flipped?'Нет диска':'◌'}</span>}</span></span></button>;
}
