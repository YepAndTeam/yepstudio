import { useEffect } from "react";
import { useStore } from "../store";
import { usePreferences } from "../preferences";
import { backgroundMusic } from "../backgroundMusic";
export default function BackgroundMusic(){
 const {theme}=useStore(),{musicEnabled}=usePreferences();
 useEffect(()=>{backgroundMusic.setEnabled(theme==='poop'&&musicEnabled);return()=>backgroundMusic.setEnabled(false);},[theme,musicEnabled]);
 useEffect(()=>{const unlock=()=>backgroundMusic.unlock();const visibility=()=>{if(document.hidden)backgroundMusic.pause();else backgroundMusic.unlock();};document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',visibility);backgroundMusic.pause();};},[]);
 return null;
}
