import { useSyncExternalStore } from "react";
const defaults={musicEnabled:true,snakeController:true,tetrisController:true};
let settings={...defaults};
try{const saved=JSON.parse(localStorage.getItem('yab_preferences')||'{}');for(const key of Object.keys(defaults))if(typeof saved[key]==='boolean')settings[key]=saved[key];}catch{}
const listeners=new Set();
export const getPreferences=()=>settings;
export function subscribePreferences(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function setPreference(key,value){if(!(key in defaults))return;settings={...settings,[key]:Boolean(value)};try{localStorage.setItem('yab_preferences',JSON.stringify(settings));}catch{}for(const listener of listeners)listener();}
export function usePreferences(){return useSyncExternalStore(subscribePreferences,getPreferences);}
window.addEventListener('storage',event=>{if(event.key!=='yab_preferences')return;try{const saved=JSON.parse(event.newValue||'{}');settings=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved[key]==='boolean'?saved[key]:value]));for(const listener of listeners)listener();}catch{}});
