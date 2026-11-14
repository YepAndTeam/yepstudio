import { useSyncExternalStore } from "react";
const defaults={themeMode:"global",baseTheme:"dark",musicEnabled:true,yaabikSounds:true,snakeController:true,tetrisController:true,gameScale:100,gameMaxWidth:0,tetrisGap:8,tetrisOrder:"left,rotate,right,down"};
export const TETRIS_KEYS={left:{label:'◀',title:'Влево'},rotate:{label:'⟳',title:'Поворот'},right:{label:'▶',title:'Вправо'},down:{label:'▼',title:'Ускорение'}};
function valid(key,value){
 if(key==='themeMode')return ['global','scoped'].includes(value);
 if(key==='baseTheme')return ['dark','light'].includes(value);
 if(key==='tetrisOrder')return typeof value==='string'&&value.split(',').length===4&&Object.keys(TETRIS_KEYS).every(id=>value.split(',').includes(id));
 if(key==='tetrisGap')return Number.isInteger(value)&&value>=0&&value<=24;
 return typeof defaults[key]==='boolean'?typeof value==='boolean':key==='gameScale'?Number.isInteger(value)&&value>=60&&value<=100:[0,320,420,640].includes(value);
}
let settings={...defaults};
try{const saved=JSON.parse(localStorage.getItem('yab_preferences')||'{}');for(const key of Object.keys(defaults))if(valid(key,saved[key]))settings[key]=saved[key];}catch{}
const listeners=new Set();
export const getPreferences=()=>settings;
export function subscribePreferences(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function setPreference(key,value){if(!(key in defaults)||!valid(key,value)||settings[key]===value)return;settings={...settings,[key]:value};try{localStorage.setItem('yab_preferences',JSON.stringify(settings));}catch{}for(const listener of listeners)listener();}
export function usePreferences(){return useSyncExternalStore(subscribePreferences,getPreferences);}
window.addEventListener('storage',event=>{if(event.key!=='yab_preferences')return;try{const saved=JSON.parse(event.newValue||'{}');settings=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,valid(key,saved[key])?saved[key]:value]));for(const listener of listeners)listener();}catch{}});
