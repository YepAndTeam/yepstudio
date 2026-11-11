// Shared cached art for WC Tetris and Snake. No independent animation loop.
const cache = new Map();
const TILE = ["#8db9b2","#e0c37e","#b2a7c6","#a7bf8a","#d1a190","#97b1cd","#c5ab80"];
function cached(key,w,h,paint){
  if(!cache.has(key)) { const c=document.createElement("canvas");c.width=w;c.height=h;paint(c.getContext("2d"));cache.set(key,c); }
  return cache.get(key);
}
export function drawWcFloor(ctx,w,h,size){
  const c=cached("floor:"+w+":"+h+":"+size,w,h,g=>{
    g.fillStyle="#a5b99f";g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=size)for(let x=0;x<w;x+=size){
      g.fillStyle=(x/size+y/size)%2?"#e5ead4":"#d8e2ca";g.fillRect(x+1,y+1,size-1,size-1);
    }
  });ctx.drawImage(c,0,0);
}
export function drawCeramic(ctx,x,y,k,size=12){
  const c=cached("tile:"+k+":"+size,size,size,g=>{
    g.fillStyle="#4b6558";g.fillRect(0,0,size,size);
    g.fillStyle=TILE[k%TILE.length];g.fillRect(1,1,size-2,size-2);
    g.fillStyle="#fffbed";g.fillRect(2,2,size-4,1);g.fillRect(2,2,1,size-4);
    g.fillStyle="#718d7b";g.fillRect(2,size-2,size-3,1);g.fillRect(size-2,2,1,size-3);
    if(size>=12){g.fillStyle="#ffffff66";g.fillRect(size-5,3,2,2);}
  });ctx.drawImage(c,Math.round(x),Math.round(y));
}
export function drawToilet(ctx,x,y,progress=0){
  const rect=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a,y+b,w,h)};
  rect(10,0,24,22,"#456557");rect(12,2,20,18,"#fffbed");rect(13,3,3,15,"#d3e0cd");
  rect(27,4,5,3,"#7b9f90");rect(27,progress?7:4,7,2,"#c5a24f");
  rect(4,22,34,5,"#456557");rect(6,23,30,3,"#fffbed");
  rect(4,27,34,11,"#fffbed");rect(7,38,28,6,"#d3e0cd");
  rect(12,44,18,12,"#456557");rect(14,44,14,10,"#fffbed");rect(9,56,26,4,"#456557");rect(11,56,22,2,"#d3e0cd");
  rect(9,28,24,8,"#456557");rect(11,29,20,6,"#88c6c7");
  if(progress>0&&progress<1){
    const shift=Math.floor(progress*18)%9;
    rect(12+shift,29,9,2,"#efffff");rect(20-shift,32,8,2,"#d6fbf2");
  }else rect(13,29,14,1,"#d6fbf2");
}
export function drawFlush(ctx,fx,width,cell,now,reduced){
  if(!fx)return 0;
  const p=(now-fx.at)/650;
  if(p<0||p>=1||reduced)return 0;
  for(const row of fx.rows){
    const y=row.index*cell;
    ctx.fillStyle="#74bec3";ctx.fillRect(0,y,width,cell);
    for(let i=0;i<row.values.length;i++){
      const q=Math.max(0,Math.min(1,p*1.6-i*.035));
      if(q<1){ctx.save();ctx.globalAlpha=1-q;ctx.translate(i*cell+cell/2,y+cell/2+q*3);ctx.scale(1-q,1-q);drawCeramic(ctx,-cell/2,-cell/2,row.values[i]-1,cell);ctx.restore();}
      ctx.fillStyle="#e7ffef";ctx.fillRect((i*17+Math.floor(p*95))%width,y+2+(i%2)*5,5,1);
    }
    // Erase the trailing water once it reaches the drain.
    ctx.save();ctx.globalAlpha=p;ctx.fillStyle="#dce5cd";ctx.fillRect(0,y,width,cell);ctx.restore();
  }
  return p;
}
export function drawRollSegment(ctx,x,y,size=15,head=false,dir={x:1,y:0}){
  const c=cached("roll:"+size+":"+Number(head),size,size,g=>{
    g.fillStyle="#554532";g.fillRect(1,1,size-2,size-2);
    g.fillStyle="#fff9df";g.fillRect(2,2,size-4,size-4);
    g.fillStyle="#c9bf9c";g.fillRect(2,3,4,size-6);
    g.fillStyle="#80664a";g.fillRect(3,5,2,size-10);
    g.fillStyle="#e2d8b8";g.fillRect(size-4,3,1,size-6);
    if(!head){g.fillStyle="#bfb493";g.fillRect(size-7,size-4,3,1);}
  });ctx.drawImage(c,x,y);
  if(head){ctx.fillStyle="#3c2a1e";const ex=x+size/2+dir.x*3,ey=y+size/2+dir.y*3;ctx.fillRect(Math.round(ex-dir.y*3),Math.round(ey+dir.x*3),2,2);ctx.fillRect(Math.round(ex+dir.y*3),Math.round(ey-dir.x*3),2,2);}
}
