// Tiny cached pixel sprites: built once, then one drawImage per frame.
export const POOP_W = 20;
export const POOP_H = 22;
const cache = new Map();
const rows = [
  ".......oo.......",
  "......olho......",
  "......ohho......",
  ".....olhhho.....",
  "....olhhhhoo....",
  "...olhhhhhhho...",
  "...ohhhhhhhho...",
  "..olhhhhhhhsso..",
  ".olhhhhhhhsssso.",
  ".ohhhhhhhssssso.",
  "olhhhhhhssssssso",
  "ohhhhhhsssssssso",
  "ohhhhhssssssssso",
  ".osssssssssssso.",
  "..oooooooooooo..",
];
const palette = { o: "#382016", l: "#d69b57", h: "#a86b38", s: "#81502d" };
function sprite(flying, frame, dead) {
  const key = Number(flying) + ":" + (frame % 2) + ":" + Number(dead);
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = POOP_W; c.height = POOP_H;
  const g = c.getContext("2d");
  const rect = (x,y,w,h,color) => { g.fillStyle=color; g.fillRect(x,y,w,h); };
  // Wings sit behind the body and use two discrete frames.
  if (flying) {
    const y = frame % 2 ? 10 : 7;
    rect(0,y,5,4,"#e9cda1"); rect(1,y-2,3,3,"#fff0ce");
    rect(15,y,5,4,"#e9cda1"); rect(16,y-2,3,3,"#fff0ce");
  }
  rows.forEach((row,y) => {
    for (let x=0;x<row.length;x++) if (palette[row[x]]) rect(x+2,y+4,1,1,palette[row[x]]);
  });
  rect(6,9,7,1,"#81502d"); rect(4,13,3,1,"#81502d"); rect(13,13,3,1,"#81502d");
  // Three-point crown: same silhouette on every platform, no emoji fonts.
  rect(7,0,1,3,"#f8d36a"); rect(10,0,1,3,"#f8d36a"); rect(13,0,1,3,"#f8d36a");
  rect(7,2,7,2,"#d69b32"); rect(9,2,1,1,"#fff0af"); rect(11,2,1,1,"#fff0af");
  if (dead) {
    for (const x of [6,12]) { rect(x,11,1,1,"#fff5dc");rect(x+1,12,1,1,"#fff5dc");rect(x+1,11,1,1,"#382016");rect(x,12,1,1,"#382016"); }
  } else {
    rect(6,10,3,4,"#fff5dc");rect(11,10,3,4,"#fff5dc");
    rect(7,11,1,2,"#24150f");rect(12,11,1,2,"#24150f");
  }
  rect(8,15,4,1,"#fff5dc");rect(9,16,2,1,"#fff5dc");
  if (!flying) {
    const offset = frame % 2;
    rect(5,19,3,1+offset,"#382016");rect(12,19,3,2-offset,"#382016");
  }
  cache.set(key,c); return c;
}
export function drawPoop(ctx,x,y,w,h,frame=0,flying=false,dead=false) {
  ctx.drawImage(sprite(flying,frame,dead),Math.round(x),Math.round(y),w,h);
}

// Shared cached billboard for the WC raycaster.
export function getPoopSprite(){ return sprite(false,0,false); }
