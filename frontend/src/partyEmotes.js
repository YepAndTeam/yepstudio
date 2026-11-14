export const PARTY_EMOTES={wave:'Помахать',nod:'Кивнуть',think:'Задуматься',surprise:'Удивиться'};
const REST={active:false,x:0,z:0,arm:0,lift:0};
export function partyEmotePose(name,age,reduced=false){
 const active=Boolean(PARTY_EMOTES[name])&&age>=0&&age<6;
 if(!active)return REST;
 const t=age/6,envelope=reduced?1:Math.min(1,age/.35,(6-age)/.5),beat=reduced?0:Math.sin(t*Math.PI*8);
 return {active:true,x:name==='nod'?beat*.23*envelope:name==='surprise'?-.14*envelope:0,z:name==='think'?.15*envelope:0,arm:name==='wave'?(1.2+beat*.28)*envelope:name==='surprise'?-.45*envelope:0,lift:name==='wave'?.22*envelope:name==='surprise'?.13*envelope:0};
}
export function partyTargetYaw(actor,target,baseYaw){const angle=Math.atan2(target.x-actor.x,target.z-actor.z)-baseYaw;return Math.max(-1.25,Math.min(1.25,Math.atan2(Math.sin(angle),Math.cos(angle))));}

export const PARTY_EMOTE_LABELS={wave:'Машет рукой',nod:'Кивает',think:'Задумался',surprise:'Удивился'};
export const partyEmoteAge=(event,serverTime,localTime)=>!event?Infinity:event.local_at!==undefined?localTime-event.local_at:serverTime-event.at;
