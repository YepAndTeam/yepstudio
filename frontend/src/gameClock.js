export function createGameClock(){
 let previous=null,last=0,visible=false,running=false,real=0;
 return (state,now,isVisible=true)=>{
  const active=state.phase==='run'||state.phase==='running';
  if(state!==previous){real=0;previous=state;}
  else if(running&&visible)real+=Math.max(0,now-last)/1000;
  last=now;visible=isVisible;running=active&&isVisible;
  return {real,game:Math.max(0,state.t??state.time??0)};
 };
}
export function formatGameTime(seconds){
 const value=Math.floor(Math.max(0,seconds));
 return `${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toString().padStart(2,'0')}`;
}
