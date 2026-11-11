import {ROAD} from './driveEngine';
// Hand-drawn top view: long bonnet, squared roof, wing and four round tail lights.
export function drawPixelCar(ctx,x,y,{skyline=false,color='#f0c466',steer=0}={}){
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(steer);
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 r(-13,-16,26,34,'#03060e');r(-11,-23,22,46,'#111b30');
 r(-10,-24,20,46,color);r(-12,-17,3,12,'#17213b');r(9,-17,3,12,'#17213b');r(-12,11,3,10,'#101727');r(9,11,3,10,'#101727');
 r(-8,-21,16,12,skyline?'#b5d7ec':'#ffffff40');r(-8,-9,16,9,'#14273e');r(-6,-7,12,5,'#4d91ac');
 r(-7,0,14,12,skyline?'#dae5ee':color);r(-5,0,2,10,'#ffffff50');r(-8,12,16,5,'#20304c');r(-6,12,12,2,'#648d9c');
 r(-9,-22,5,3,'#defaff');r(4,-22,5,3,'#defaff');r(-4,-24,8,2,'#253249');r(-2,-18,4,9,skyline?'#4f83d6':'#0002');
 r(-9,18,18,4,skyline?'#7298be':color);r(-7,24,14,2,'#0b1021');
 if(skyline){r(-13,16,26,3,'#0a1326');r(-10,15,3,5,'#1b2f4e');r(7,15,3,5,'#1b2f4e');for(const n of [-8,-4,4,8]){r(n-1,20,3,3,'#ff557f');r(n,21,1,1,'#ffb4ba');}r(-3,20,6,3,'#e3edf4');r(8,5,2,5,'#3886d3');}
 else{r(-9,19,5,3,'#ff5b73');r(4,19,5,3,'#ff5b73');}
 ctx.restore();
}
const colors=['#f26e79','#f6c85a','#6ebca1','#9e8ddd','#d2dfed'];
export function drawDrive(ctx,s,{neon=false,bg='#162022',fg='#ecf5ef'}={}){
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),w,h);};
 const scroll=s.distance,road=neon?'#141728':'#283137',edge=neon?'#f052cb':'#e6ba70';
 r(0,0,240,360,neon?'#080f22':bg);
 // Repeated city blocks and illuminated windows, with no blur or particles.
 for(let side=0;side<2;side++)for(let i=-1;i<5;i++){
  const x=side?204:3,y=((i*94+scroll*.32)%470+470)%470-94;
  r(x,y,33,80,neon?'#17203b':'#2c4146');r(x+4,y+5,25,3,neon?'#3c365a':'#405a5d');
  for(let w=0;w<3;w++)for(let h=0;h<5;h++)if((w+h+i+8)%3!==0)r(x+5+w*8,y+15+h*11,4,5,neon?(i%2?'#5791be':'#b176ae'):'#718e84');
  if(neon){r(x+3,y+42,28,10,side?'#733b88':'#1b677c');ctx.font='6px monospace';ctx.textAlign='center';ctx.fillStyle='#ecddff';ctx.fillText(side?'NIGHT':'GARAGE',x+17,y+49);}
 }
 r(43,0,154,360,'#090e18');r(46,0,148,360,road);r(44,0,2,360,edge);r(194,0,2,360,neon?'#55d9ed':edge);
 for(let i=-1;i<10;i++){const y=(i*48+scroll)%480;r(94,y,2,24,neon?'#536482':'#9ca9a8');r(144,y,2,24,neon?'#536482':'#9ca9a8');if(neon){r(49,y+6,5,26,'#30223e');r(187,y+16,4,20,'#1c3a48');}}
 for(const coin of s.pickups){const w=3+Math.abs(Math.cos(s.time*7+coin.id))*5;r(coin.x-w/2-1,coin.y-5,w+2,10,'#a66d28');r(coin.x-w/2,coin.y-4,w,8,'#ffdc79');r(coin.x,coin.y-2,1,4,'#fff5c4');}
 for(const car of s.traffic)drawPixelCar(ctx,car.x,car.y,{color:colors[car.color]});
 if(neon){r(s.x-13,ROAD.playerY+16,26,9,'#153e58');r(s.x-8,ROAD.playerY+24,3,5,'#599df4');r(s.x+5,ROAD.playerY+24,3,5,'#599df4');}
 drawPixelCar(ctx,s.x,ROAD.playerY,{skyline:neon,color:neon?'#88b9db':'#efbe59',steer:Math.max(-.06,Math.min(.06,(s.target-s.x)/200))});
 if(s.flash>0&&s.phase==='running'){ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#c3fff4';ctx.fillText('CLOSE CALL +10',120,255);}
 r(52,7,136,18,'#0b1026');ctx.textAlign='left';ctx.font='bold 9px monospace';ctx.fillStyle=fg;ctx.fillText(neon?'MIDNIGHT / R34':'YAB / HIGHWAY',58,19);
 if(s.phase==='crashed'){r(s.x-14,ROAD.playerY-5,28,10,'#ff9660');r(s.x-5,ROAD.playerY-14,10,28,'#ffe6a5');}
}
