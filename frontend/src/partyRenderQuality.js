export function partyPixelRatio(width,height,dpr=1){return Math.max(1,Math.min(dpr,2,Math.sqrt(1800000/Math.max(1,width*height))));}
