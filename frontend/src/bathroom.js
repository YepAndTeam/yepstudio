// Static scenery is painted once per canvas size and reused in the game loop.
const walls = new Map();
export function drawBathroom(ctx, width, ground, height = ground) {
  const key = width + ":" + ground + ":" + height;
  if (!walls.has(key)) {
    const canvas = document.createElement("canvas"); canvas.width=width; canvas.height=height;
    const g=canvas.getContext("2d");
    g.fillStyle="#b9cbb8";g.fillRect(0,0,width,ground);
    for(let y=0;y<ground;y+=24)for(let x=0;x<width;x+=24){
      g.fillStyle=(x/24+y/24)%2 ? "#e6ecd7" : "#f2f2dd";g.fillRect(x+1,y+1,22,22);
      g.fillStyle="#fffbed";g.fillRect(x+2,y+2,20,1);
    }
    g.fillStyle="#709b92";g.fillRect(0,ground-17,width,7);
    g.fillStyle="#3f6d66";g.fillRect(0,ground-11,width,2);
    g.fillStyle="#d0dbbf";g.fillRect(0,ground-8,width,8);
    // A little WC sign and exposed plumbing make this a room, not a color wash.
    g.fillStyle="#3b6058";g.fillRect(width-53,29,36,25);
    g.fillStyle="#f9f4dc";g.fillRect(width-51,31,32,21);
    g.fillStyle="#3b6058";g.font="bold 10px monospace";g.fillText("WC",width-41,45);
    g.fillStyle="#718e88";g.fillRect(width-13,0,5,ground-27);g.fillRect(width-30,ground-32,22,5);
    g.fillStyle="#d7e2d7";g.fillRect(width-12,0,2,ground-30);
    // Pixel toilet stencil, part of the wall rather than a game obstacle.
    const tx=width-96, ty=ground-63;
    g.fillStyle="#a5b9a5";
    g.fillRect(tx+13,ty,15,15);g.fillRect(tx+11,ty+14,19,4);
    g.fillRect(tx,ty+20,30,5);g.fillRect(tx+4,ty+25,23,7);
    g.fillRect(tx+13,ty+30,11,10);g.fillRect(tx+10,ty+39,18,4);
    g.fillStyle="#d4deca";g.fillRect(tx+15,ty+3,11,9);g.fillRect(tx+3,ty+21,23,2);
    g.fillStyle="#78988b";g.fillRect(tx+23,ty+4,3,2);
    // Static floor tiles replace the default scrolling dirt marks.
    for(let y=ground+2;y<height;y+=12)for(let x=0;x<width;x+=18){
      g.fillStyle=((x/18+Math.floor((y-ground)/12))%2)?"#bccbb3":"#d7dfc7";
      g.fillRect(x+1,y+1,16,10);
    }
    walls.set(key,canvas);
  }
  ctx.drawImage(walls.get(key),0,0);
}
export function drawPlunger(ctx,x,ground,w,h){
  ctx.fillStyle="#40291e";ctx.fillRect(x+Math.floor(w/2)-2,ground-h,4,h-5);
  ctx.fillStyle="#c99a58";ctx.fillRect(x+Math.floor(w/2)-1,ground-h+1,2,h-8);
  ctx.fillStyle="#713d30";ctx.fillRect(x+2,ground-8,w-4,5);ctx.fillRect(x,ground-4,w,4);
  ctx.fillStyle="#ae6550";ctx.fillRect(x+3,ground-7,Math.max(2,w-7),2);
}
export function drawPaperRoll(ctx,x,bottom,w,h,flap){
  ctx.fillStyle="#49382d";ctx.fillRect(x+2,bottom-h,w-4,h);
  ctx.fillStyle="#fff8df";ctx.fillRect(x+3,bottom-h+1,w-6,h-2);
  ctx.fillStyle="#c7b992";ctx.fillRect(x+4,bottom-h+2,4,h-4);
  ctx.fillStyle="#68503b";ctx.fillRect(x+5,bottom-h+4,2,Math.max(2,h-8));
  ctx.fillStyle="#fff8df";ctx.fillRect(x+w-8,bottom-2,6,flap?5:3);
  ctx.fillStyle="#b5aa8a";ctx.fillRect(x+w-7,bottom,4,1);
}
export function drawDrainPipe(ctx,x,y,w,h,top){
  ctx.fillStyle="#3c615b";ctx.fillRect(x,y,w,h);
  ctx.fillStyle="#dce7d2";ctx.fillRect(x+2,y,w-4,h);
  ctx.fillStyle="#fffbed";ctx.fillRect(x+4,y,5,h);
  ctx.fillStyle="#9ab8a7";ctx.fillRect(x+w-8,y,5,h);
  const rim=top?y+h-8:y;
  ctx.fillStyle="#3c615b";ctx.fillRect(x-3,rim,w+6,8);
  ctx.fillStyle="#b8ceba";ctx.fillRect(x-1,rim+2,w+2,4);
  ctx.fillStyle="#fffbed";ctx.fillRect(x,rim+2,w,1);
}
