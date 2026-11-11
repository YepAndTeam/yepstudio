// Circular gate + dead zone, normalized independently of screen density.
export function stickVector(dx,dy,radius=42){
  const distance=Math.hypot(dx,dy);
  const travel=Math.min(distance,radius);
  const strength=Math.max(0,(travel/radius-.14)/.86);
  return {x:distance?dx/distance*strength:0,y:distance?dy/distance*strength:0,px:distance?dx/distance*travel:0,py:distance?dy/distance*travel:0};
}
export function mergeControls(keys,stick,fire,out){
  out.up=Math.max(keys.up,Math.max(0,-stick.y));out.down=Math.max(keys.down,Math.max(0,stick.y));
  out.left=Math.max(keys.left,Math.max(0,-stick.x));out.right=Math.max(keys.right,Math.max(0,stick.x));
  out.fire=Math.max(keys.fire,fire);return out;
}
