import React from "react";
// Small code-native pixel emblems; no images or animation loops to load.
export default function AchievementIcon({game}){
 const eye="var(--card,#151516)";
 const art={
  dino:<><path fill="currentColor" d="M23 5h17v5h4v13H30v5h7v4H26v7h-5v5h-6v-9L8 29H4V17h5v8h5v4h5V17h4z"/><rect fill={eye} x="32" y="9" width="4" height="4"/><rect fill={eye} x="31" y="19" width="13" height="3"/></>,
  flappy:<><path fill="#edbd42" d="M15 10h19v5h6v20h-6v5H12v-5H6V20h4v-5h5z"/><path fill="#fff4cd" d="M25 15h10v13H25z"/><rect fill="#29251b" x="31" y="18" width="4" height="6"/><path fill="#e4773d" d="M33 28h13v5H33z"/><path fill="#d08b28" d="M7 23h13v5h5v5H10v-5H7z"/></>,
  snake:<><path fill="currentColor" d="M7 13h5V8h24v5h5v24h-5v5H12v-5H7z"/><path fill={eye} d="M13 16h7v9h-7zm15 0h7v9h-7z"/><path fill={eye} d="M16 32h16v3H16z"/><path fill="#d86b72" d="M22 35h4v9h-4z"/></>,
  tetris:<>{[[17,6,"#b48bea"],[5,18,"#b48bea"],[17,18,"#b48bea"],[29,18,"#b48bea"],[5,32,"#60c9cb"],[17,32,"#60c9cb"],[29,32,"#60c9cb"]].map(([x,y,color],i)=><g key={i}><rect x={x} y={y} width="11" height="11" fill={color}/><path d={`M${x+2} ${y+8}V${y+2}h7`} fill="none" stroke="#ffffff80" strokeWidth="1"/></g>)}</>,
  hell:<><path fill="currentColor" d="M5 15h35v4h5v6H29v5H18v12H9V28H5z"/><path fill={eye} d="M20 25h6v3h-6zm-9-6h26v3H11z"/><path fill="currentColor" d="M32 10h9v4h-9z"/><path fill={eye} d="M12 31h3v8h-3z"/></>
 };
 return <svg className="game-achievement-icon" viewBox="0 0 48 48" aria-hidden="true" style={{stroke:"none",shapeRendering:"crispEdges"}}>{art[game] || art.dino}</svg>;
}
