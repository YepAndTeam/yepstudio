// Logical pixels. Simulation has no DOM or wallet writes.
export const ROAD={width:240,height:360,left:46,right:194,lanes:[70,120,170],playerY:290};
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function newDrive(){return {phase:'idle',x:120,target:120,time:0,distance:0,speed:132,coins:0,near:0,passed:0,score:0,spawn:1.5,traffic:[],pickups:[],flash:0,nextId:0};}
export function steerDrive(s,direction,dt){s.target=clamp(s.target+direction*210*dt,ROAD.left+14,ROAD.right-14);}
export function stepDrive(s,dt,random=Math.random){
 if(s.phase!=='running')return;
 dt=clamp(dt,0,1/30);s.time+=dt;s.speed=Math.min(132+s.time*1.8,235);s.distance+=s.speed*dt;s.flash=Math.max(0,s.flash-dt);
 s.x+=clamp(s.target-s.x,-210*dt,210*dt);s.spawn-=dt;
 if(s.spawn<=0){
  const free=Math.min(2,Math.floor(random()*3));
  const occupied=[0,1,2].filter(n=>n!==free);
  if(s.time<20||random()<.45)occupied.splice(Math.floor(random()*2),1);
  for(const lane of occupied)s.traffic.push({id:s.nextId++,x:ROAD.lanes[lane],y:-56,speed:.7+random()*.15,color:Math.floor(random()*5),passed:false});
  for(let i=0;i<3;i++)s.pickups.push({id:s.nextId++,x:ROAD.lanes[free],y:-60-i*24});
  s.spawn=Math.max(.95,1.8-s.time*.007)+random()*.35;
 }
 for(const car of s.traffic){
  car.y+=s.speed*car.speed*dt;
  if(Math.abs(car.x-s.x)<20&&Math.abs(car.y-ROAD.playerY)<34){s.phase='crashed';s.flash=.25;break;}
  if(!car.passed&&car.y>ROAD.playerY+40){car.passed=true;s.passed++;if(Math.abs(car.x-s.x)<37){s.near++;s.flash=.2;}}
 }
 for(const coin of s.pickups){coin.y+=s.speed*dt;if(!coin.taken&&Math.abs(coin.x-s.x)<17&&Math.abs(coin.y-ROAD.playerY)<24){coin.taken=true;s.coins++;}}
 s.traffic=s.traffic.filter(car=>car.y<ROAD.height+60);s.pickups=s.pickups.filter(coin=>!coin.taken&&coin.y<ROAD.height+15);
 s.score=Math.min(100000,Math.floor(s.distance/12)+s.coins*15+s.passed*5+s.near*10);
 if(s.score===100000)s.phase='crashed';
}
