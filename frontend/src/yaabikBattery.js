export const YAABIK_CHARGE_PER_MINUTE=5;
export function batteryAt(value,now=Date.now()){
 const level=Number.isFinite(value?.level)?Math.max(0,Math.min(100,value.level)):65;
 const updatedAt=Number.isFinite(value?.updatedAt)?value.updatedAt:now;
 const wasDocked=value?.docked===true,docked=wasDocked||level===0;
 return {level:Math.min(100,level+(wasDocked?Math.max(0,now-updatedAt)/60000*YAABIK_CHARGE_PER_MINUTE:0)),docked,updatedAt:now};
}
export function dockBattery(value,docked,now=Date.now()){const next=batteryAt(value,now);return {...next,docked:docked||next.level===0};}
export function spendBattery(value,cost,now=Date.now()){const next=batteryAt(value,now);const level=next.docked?next.level:Math.max(0,next.level-Math.max(0,cost));return {...next,level,docked:next.docked||level===0};}
