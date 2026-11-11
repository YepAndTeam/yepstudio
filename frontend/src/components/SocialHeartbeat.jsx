import {useEffect} from 'react';
import {api} from '../api';
export default function SocialHeartbeat({userId}){
 useEffect(()=>{
  if(!userId)return;let busy=false;
  const ping=async()=>{if(busy)return;busy=true;try{await api('/presence','POST',{active:!document.hidden});}catch{}finally{busy=false;}};
  void ping();const timer=setInterval(()=>{if(!document.hidden)void ping();},45000);
  document.addEventListener('visibilitychange',ping);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',ping);};
 },[userId]);return null;
}
