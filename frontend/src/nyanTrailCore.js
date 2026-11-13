export function recordNyanTrail(state,y,time){
 const trail=state.nyanTrail??(state.nyanTrail=[]),last=trail[trail.length-1];
 if(last&&time-last.t<1/60)return;
 trail.push({y,t:time});if(trail.length>48)trail.splice(0,trail.length-48);
}
export function nyanTrailY(trail,time,fallback){
 if(!trail?.length)return fallback;
 if(time<=trail[0].t)return trail[0].y;
 for(let i=trail.length-1;i>0;i--){const b=trail[i],a=trail[i-1];if(time>=a.t){const f=Math.max(0,Math.min(1,(time-a.t)/Math.max(.00001,b.t-a.t)));return a.y+(b.y-a.y)*f;}}
 return fallback;
}
