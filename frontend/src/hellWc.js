import { getPoopSprite } from "./poop";
const walls=new Map();let room;
export function wcWall(side,fog){
  const level=Math.max(0,Math.min(7,Math.round(fog*7))),key=side+":"+level;
  if(!walls.has(key)){
    const c=document.createElement("canvas");c.width=c.height=32;const g=c.getContext("2d");
    g.fillStyle="#789b87";g.fillRect(0,0,32,32);
    for(let y=0;y<32;y+=8)for(let x=0;x<32;x+=8){g.fillStyle=(x+y)%16?"#e5ead4":"#f4f2db";g.fillRect(x+1,y+1,7,7);g.fillStyle="#fffbed";g.fillRect(x+1,y+1,6,1);}
    g.fillStyle="#608f83";g.fillRect(0,23,32,3);
    g.fillStyle="rgba(25,43,30,"+(1-(level/7)*(.9-side*.18))+")";g.fillRect(0,0,32,32);
    walls.set(key,c);
  }return walls.get(key);
}
export function drawWcRoom(ctx,w,h){
  if(!room){
    room=document.createElement("canvas");room.width=w;room.height=h;const g=room.getContext("2d");
    g.fillStyle="#9aaa92";g.fillRect(0,0,w,h/2);g.fillStyle="#c6d4b9";g.fillRect(0,h/2,w,h/2);
    for(let y=h/2+2;y<h;y+=4){
      const scale=(y-h/2)/(h/2),size=Math.max(4,Math.floor(scale*42));
      for(let x=0;x<w;x+=size){g.fillStyle=(Math.floor(x/size)+Math.floor(y/8))%2?"#aabd9e":"#dce3c8";g.fillRect(x,y,size-1,3);}
    }
  }ctx.drawImage(room,0,0);
}
export function drawWcEnemyColumn(ctx,x,top,size,u,hit){
  const sprite=getPoopSprite();
  ctx.drawImage(sprite,Math.min(sprite.width-1,Math.floor(u*sprite.width)),0,1,sprite.height,x,top,1,size*.85);
  if(hit){ctx.fillStyle="#fff8df66";ctx.fillRect(x,top+size*.35,1,size*.3);}
}
export function drawPlungerWeapon(ctx,w,h,bob,kick,flash){
  const y=h-67+kick+bob;
  ctx.fillStyle="#40291e";ctx.fillRect(w/2-4,y+20,8,48);
  ctx.fillStyle="#c49556";ctx.fillRect(w/2-2,y+20,4,48);
  ctx.fillStyle="#60372b";ctx.fillRect(w/2-15,y+7,30,18);ctx.fillRect(w/2-19,y+22,38,5);
  ctx.fillStyle="#aa6750";ctx.fillRect(w/2-11,y+8,22,4);
  if(flash){ctx.fillStyle="#c6f3ee";ctx.fillRect(w/2-4,y-8,8,7);ctx.fillRect(w/2-15,y-1,4,4);ctx.fillRect(w/2+10,y-5,4,4);}
}
