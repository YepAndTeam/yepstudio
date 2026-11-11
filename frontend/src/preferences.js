import { useSyncExternalStore } from "react";
const defaults={musicEnabled:true,snakeController:true,tetrisController:true,gameScale:100,gameMaxWidth:0};
function valid(key,value){return typeof defaults[key]==='boolean'?typeof value==='boolean':key==='gameScale'?Number.isInteger(value)&&value>=60&&value<=100:[0,320,420,640].includes(value);}
let settings={...defaults};
try{const saved=JSON.parse(localStorage.getItem('yab_preferences')||'{}');for(const key of Object.keys(defaults))if(valid(key,saved[key]))settings[key]=saved[key];}catch{}
const listeners=new Set();
export const getPreferences=()=>settings;
export function subscribePreferences(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function setPreference(key,value){if(!(key in defaults)||!valid(key,value)||settings[key]===value)return;settings={...settings,[key]:value};try{localStorage.setItem('yab_preferences',JSON.stringify(settings));}catch{}for(const listener of listeners)listener();}
export function usePreferences(){return useSyncExternalStore(subscribePreferences,getPreferences);}
window.addEventListener('storage',event=>{if(event.key!=='yab_preferences')return;try{const saved=JSON.parse(event.newValue||'{}');settings=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,valid(key,saved[key])?saved[key]:value]));for(const listener of listeners)listener();}catch{}});
