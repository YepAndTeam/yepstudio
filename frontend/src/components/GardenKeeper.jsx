import {useEffect,useState} from 'react';
export default function GardenKeeper({mapRef,job,serverNow}){
 const [pose,setPose]=useState({x:'50%',y:'calc(100% - 25px)',phase:'idle'});
 useEffect(()=>{const timers=[];if(!job){setPose(old=>({...old,phase:'idle'}));return;}
  const map=mapRef.current,plot=map?.querySelector(`[data-plot="${job.plot}"]`);if(!map||!plot)return;
  const area=map.getBoundingClientRect(),box=plot.getBoundingClientRect(),x=(box.left+box.width/2-area.left)+'px',y=(box.bottom-area.top+17)+'px',splashY=(plot.querySelector('.garden-soil').getBoundingClientRect().bottom-area.top-8)+'px',phase=job.kind==='plant'?'plant':'water';
  const later=(delay,fn)=>timers.push(setTimeout(fn,delay));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||serverNow-job.started_at>750)setPose({x,y,splashY,phase});
  else{setPose(old=>({...old,x:'96%',phase:'walk'}));later(250,()=>setPose(old=>({...old,y})));later(500,()=>setPose({x,y,splashY,phase:'walk'}));later(750,()=>setPose({x,y,splashY,phase}));}
  return()=>timers.forEach(clearTimeout);
 },[job?.kind,job?.plot,job?.ends_at]);
 const active=job&&serverNow<job.ends_at,phase=active?pose.phase:'idle';
 return <><div className={`garden-keeper phase-${phase}`} style={{left:pose.x,top:pose.y}} role="img" aria-label={phase==='water'?'Яабик поливает грядку':phase==='plant'?'Яабик сажает семена':phase==='walk'?'Яабик идёт к грядке':'Яабик в саду'}><svg viewBox="0 0 48 48" shapeRendering="crispEdges" aria-hidden="true"><ellipse cx="23" cy="38" rx="17" ry="5" fill="#142b2540"/><g className="garden-keeper-legs" fill="#526d70"><path d="M12 33h8v8h-8zm14 0h8v8h-8z"/></g><path d="M7 17h5v15H7zm28 0h5v15h-5z" fill="#93afa9"/><path d="M11 9h25v27H11z" fill="var(--garden-trim,#6c8f8b)"/><path d="M13 9h21v22H13z" fill="var(--garden-text,#b1cdc1)"/><path d="M15 12h17v13H15z" fill="#446c68"/><path d="M17 14h13v7H17z" fill="#708e83"/><path d="M14 28h19v6H14z" fill="#263f43"/><path d="M17 29h3v2h-3zm10 0h3v2h-3zm-6 3h5v1h-5z" fill="#dce8b9"/><path d="M23 4h3v6h-3z" fill="#8db5aa"/><path d="M21 3h7v3h-7z" fill="#e3e5bb"/>{job?.kind==='plant'?<g className="garden-seed-hand"><path d="M34 23h10v14H34z" fill="#e6dfc8"/><path d="M34 23h10v4H34z" fill="#8aab91"/><path d="M37 30h4v4h-4z" fill="#9e8256"/></g>:<g className="garden-watering-can"><path d="M35 25h9v10h-9zM41 21h5v9h-3v-6h-2z" fill="#8ec7ce"/><path d="m33 28-7-3v4l8 4z" fill="#a9dce1"/></g>}</svg><i className="garden-water-drops"><b/><b/><b/></i></div>{phase==='water'&&<i className="garden-bed-splash" style={{left:pose.x,top:pose.splashY}} aria-hidden="true"/>}</>;
}
