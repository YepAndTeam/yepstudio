import {nyanTrailY} from "./nyanTrailCore";
// Пиксельный Nyan Cat, рисуется прямоугольниками
const RAINBOW = ["#FF0000", "#FF9900", "#FFFF00", "#33FF00", "#0099FF", "#6633FF"];
const COL = { K: "#202238", G: "#b8bac9", T: "#FFCC99", P: "#FF99FF", S: "#FF3399", H: "#FF9999" };
const HEAD = [
  "K.....K",
  "KKKKKKK",
  "KGGGGGK",
  "KGKGKGK",
  "KHGGGHK",
  "KGGKGGK",
  "KKKKKKK",
];
// Кот в сетке 13x12 клеток, клетка = 2px
export const NYAN_W = 26;
export const NYAN_H = 24;

// Радужный хвост. x, y — левый верх кота
export function drawNyanTrail(ctx,x,y,frame,u=2,history=null,time=0,speed=180){
 const alpha=ctx.globalAlpha,phase=history?time:frame/8;
 for(let i=31;i>=0;i--){const distance=i*3,lag=distance/Math.max(80,speed);const base=nyanTrailY(history,time-lag,y);const wave=Math.sin(phase*13-i*.55)*u*.65;
  ctx.globalAlpha=alpha*(.45+.55*(1-i/40));
  for(let k=0;k<6;k++){ctx.fillStyle=RAINBOW[k];ctx.fillRect(Math.round(x+2*u-distance),Math.round(base+(3+k)*u+wave),4,u+1);}
 }ctx.globalAlpha=alpha;
}

export function drawNyanCat(ctx, x, y, frame, air = false, u = 2) {
  x = Math.round(x);
  y = Math.round(y);
  const r = (cx, cy, w, h, c) => {
    ctx.fillStyle = COL[c];
    ctx.fillRect(x + cx * u, y + cy * u, w * u, h * u);
  };
  const wag = frame % 2;

  // хвост
  r(0, 5 + wag, 1, 3, "K");
  r(0, 6 + wag, 1, 1, "G");
  // лапы (в прыжке вытянуты)
  for (const [cx, ph] of [[1, 0], [4, 1], [8, 0], [11, 1]]) {
    const h = air || (frame + ph) % 2 ? 2 : 1;
    r(cx, 12 - h, 2, h, "G");
  }
  // поп-тарт
  r(1, 2, 9, 8, "K");
  r(2, 3, 7, 6, "T");
  r(3, 4, 5, 4, "P");
  r(4, 5, 1, 1, "S"); r(6, 4, 1, 1, "S"); r(6, 7, 1, 1, "S"); r(3, 7, 1, 1, "S");
  // Softer ears, cheeks and a clear smiling face.
  r(7,3,6,6,'K');r(8,3,4,5,'G');r(7,1,2,3,'K');r(11,1,2,3,'K');
  r(8,2,1,1,'H');r(11,2,1,1,'H');r(8,4,4,4,'G');
  r(8.5,4.5,1,1,'K');r(11,4.5,1,1,'K');
  ctx.fillStyle='#fff';ctx.fillRect(Math.round(x+8.5*u),Math.round(y+4.5*u),Math.max(1,u/2),Math.max(1,u/2));ctx.fillRect(Math.round(x+11*u),Math.round(y+4.5*u),Math.max(1,u/2),Math.max(1,u/2));
  r(8,6,1,1,'H');r(11.5,6,1,1,'H');r(9.5,6,1.5,.5,'K');r(10,6.5,.5,.5,'K');

}

// Звёзды на фоне, медленно уплывают влево
export function drawStars(ctx, W, maxY, t, color = "#FFFFAA") {
  ctx.fillStyle = color;
  for (let i = 0; i < 16; i++) {
    const sp = 12 + (i % 3) * 10;
    const x = (((i * 97 - t * sp) % W) + W) % W;
    const y = ((i * 53) % (maxY - 10)) + 4;
    const sz = i % 4 === 0 ? 2 : 1;
    ctx.fillRect(Math.round(x), y, sz, sz);
  }
}
export function drawNyanHead(ctx, cx, cy, u = 2) {
  const x0 = Math.round(cx - 3.5 * u);
  const y0 = Math.round(cy - 3.5 * u);
  HEAD.forEach((row, j) => {
    for (let i = 0; i < 7; i++) {
      const c = row[i];
      if (c === ".") continue;
      ctx.fillStyle = COL[c];
      ctx.fillRect(x0 + i * u, y0 + j * u, u, u);
    }
  });
}
export function drawNyanSnake(ctx,snake,size){
 if(snake.length<2)return;
 const points=snake.map(p=>({x:(p.x+.5)*size,y:(p.y+.5)*size}));
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#222b49';ctx.lineWidth=size*.84;ctx.stroke();
 for(let c=0;c<6;c++){const offset=(c-2.5)*size*.115;ctx.beginPath();points.forEach((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,length=Math.hypot(dx,dy)||1,x=p.x-dy/length*offset,y=p.y+dx/length*offset;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=RAINBOW[c];ctx.lineWidth=size*.14;ctx.stroke();}
 ctx.restore();
}
