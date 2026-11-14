// Painted once: room details share a flat texture rather than dozens of meshes.
export function paintPartyBackdrop(kind){
 const c=document.createElement('canvas');c.width=2048;c.height=768;const x=c.getContext('2d'),b=kind==='bunker';
 x.fillStyle=b?'#343f48':'#1c1119';x.fillRect(0,0,2048,768);
 for(let i=0;i<8;i++){x.fillStyle=b?(i%2?'#3d4850':'#414c54'):(i%2?'#25151d':'#21131b');x.fillRect(i*256+3,0,250,768);x.fillStyle=b?'#202c33':'#110d11';x.fillRect(i*256,0,5,768);for(const y of [26,715]){x.fillStyle=b?'#718087':'#60434b';x.fillRect(i*256+18,y,5,5);}}
 x.fillStyle=b?'#202930':'#100b0e';x.fillRect(0,715,2048,53);
 const sign=(text,px,py,w)=>{x.fillStyle=b?'#1e2b30':'#2b141e';x.fillRect(px,py,w,60);x.strokeStyle=b?'#8caaa6':'#955663';x.lineWidth=3;x.strokeRect(px,py,w,60);x.fillStyle=b?'#d2e0d6':'#e8c3bf';x.font='bold 23px monospace';x.textAlign='center';x.fillText(text,px+w/2,py+38,w-18);};
 if(b){
  for(const y of [110,153]){x.fillStyle='#1b252a';x.fillRect(0,y+12,2048,16);x.fillStyle='#829097';x.fillRect(0,y,2048,13);x.fillStyle='#b5bcc0';x.fillRect(0,y,2048,3);for(let i=50;i<2048;i+=230){x.fillStyle='#4a5d65';x.fillRect(i,y-7,18,37);}}
  x.fillStyle='#19262c';x.fillRect(450,300,260,414);x.fillStyle='#66777e';x.fillRect(464,312,232,390);x.strokeStyle='#a3afb3';x.lineWidth=4;x.strokeRect(480,328,200,355);x.fillStyle='#26383f';x.fillRect(651,480,14,90);x.fillStyle='#bba759';x.fillRect(649,480,9,54);
  for(const y of [344,650])for(const px of [486,665]){x.fillStyle='#bbc2c0';x.fillRect(px,y,8,8);}
  x.fillStyle='#17262d';x.fillRect(1340,270,290,145);for(let i=0;i<12;i++){x.fillStyle='#71838b';x.fillRect(1355+i*22,282,8,121);}
  sign('SEALED / 01',450,225,260);sign('AIR / FILTER 02',1340,450,290);
  x.fillStyle='#283a41';x.fillRect(1770,445,148,265);x.fillStyle='#596b71';x.fillRect(1780,455,128,245);for(let i=0;i<4;i++){x.fillStyle=i===0?'#bf8f4f':'#72928b';x.fillRect(1800,478+i*40,13,12);x.fillStyle='#293d45';x.fillRect(1825,478+i*40,65,12);}
  x.fillStyle='#c97956';x.fillRect(1010,176,28,14);sign('YAB / SHELTER 01',790,280,465);
 }else{
  for(const px of [160,1660]){x.fillStyle='#120b10';x.fillRect(px-8,110,260,606);for(let i=0;i<9;i++){x.fillStyle=i%2?'#6e2337':'#431b2a';x.fillRect(px+i*27,135,27,562);}x.fillStyle='#8d5a63';x.fillRect(px-18,113,287,13);}
  for(const px of [575,1360]){x.fillStyle='#100d17';x.fillRect(px,310,160,240);x.fillStyle='#333044';x.fillRect(px+10,320,140,220);x.fillStyle='#15101d';x.fillRect(px+76,320,8,220);x.fillRect(px+10,425,140,7);}
  sign('YAB / NIGHT COUNCIL',800,255,460);sign('PRIVATE / NO ENTRY',845,425,370);
 }
 return c;
}
