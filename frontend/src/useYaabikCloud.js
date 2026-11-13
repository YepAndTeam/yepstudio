import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {api} from './api';
const id=()=>crypto.randomUUID().replaceAll('-','');
export function useYaabikCloud({storageKey,legacy,onState}){
 const callbacks=useRef({legacy,onState});useLayoutEffect(()=>{callbacks.current={legacy,onState};},[legacy,onState]);
 const control=useRef(null),[status,setStatus]=useState({ready:false,busy:true,error:''}),[data,setData]=useState(null);
 useEffect(()=>{
  let alive=true,connected=false,applied=false,busy=false,openId=id(),pending=[];
  const outbox=storageKey+':outbox';
  try{pending=JSON.parse(localStorage.getItem(outbox)||'[]');if(!Array.isArray(pending))pending=[];}catch{}
  const persist=()=>{try{localStorage.setItem(outbox,JSON.stringify(pending));}catch{}};
  const publish=(value,initial=false)=>{if(!alive)return;setData(value);callbacks.current.onState(value,initial&&!applied);applied=true;try{localStorage.setItem(storageKey+':server',JSON.stringify(value));}catch{}};
  const connect=async(refresh=false)=>{
   if(busy||!alive)return;busy=true;setStatus(s=>({...s,busy:true,error:''}));
   try{
    if(!connected||refresh){const value=await api('/yaabik/open','POST',{request_id:openId,legacy:callbacks.current.legacy()});if(!alive)return;if(!pending.length)publish(value,!applied);connected=true;}
    while(pending.length&&alive){const batch=pending.slice(0,30),value=await api('/yaabik/actions','POST',{commands:batch});if(!alive)return;const done=new Set(batch.map(c=>c.id));pending=pending.filter(c=>!done.has(c.id));persist();if(!pending.length)publish(value,true);}
    if(alive)setStatus({ready:true,busy:false,error:''});
   }catch(error){if(alive)setStatus(s=>({...s,busy:false,error:error.message}));}finally{busy=false;}
  };
  let debounce;
  control.current={send(kind,value){setStatus(s=>({...s,busy:true}));pending.push({id:id(),kind,value});persist();clearTimeout(debounce);debounce=setTimeout(()=>void connect(),450);},retry:()=>void connect(),refresh:()=>{openId=id();void connect(true);}};
  const resume=()=>{if(!document.hidden){openId=id();void connect(true);}};
  const online=()=>void connect();
  const retry=setInterval(()=>{if(!document.hidden&&(!connected||pending.length))void connect();},15000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',online);void connect();
  return()=>{alive=false;clearInterval(retry);clearTimeout(debounce);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',online);control.current=null;};
 },[storageKey]);
 return {...status,data,send:(kind,value)=>control.current?.send(kind,value),retry:()=>control.current?.retry()};
}

// Settings can save while the room is unmounted. Pending changes survive connection failures.
export function saveYaabikSounds(userId,enabled){
 const key='yab_yaabik_v1:'+String(userId||'guest'),outbox=key+':outbox',command={id:id(),kind:'prefs',value:{sounds:enabled}};
 try{const pending=JSON.parse(localStorage.getItem(outbox)||'[]');localStorage.setItem(outbox,JSON.stringify([...pending,command]));if(!localStorage.getItem(key+':server'))return;}catch{return;}
 void api('/yaabik/actions','POST',{commands:[command]}).then(()=>{try{const pending=JSON.parse(localStorage.getItem(outbox)||'[]');localStorage.setItem(outbox,JSON.stringify(pending.filter(c=>c.id!==command.id)));}catch{}}).catch(()=>{});
}
