// Bounded fixed updates keep jumps and collisions consistent across refresh rates.
export const DINO_STEP=1/120;
export function advanceDino(clock,elapsed,step,tempo=1){
 clock.acc=Math.min(clock.acc+Math.max(0,Math.min(elapsed,.1))*tempo,.1*tempo);
 let count=0;
 while(clock.acc+1e-10>=DINO_STEP){clock.acc=Math.max(0,clock.acc-DINO_STEP);count++;if(step(DINO_STEP)===false){clock.acc=0;break;}}
 return count;
}
