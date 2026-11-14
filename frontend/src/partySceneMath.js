export const LOOK_LIMIT=1.88;
export const clampLook=value=>Math.max(-LOOK_LIMIT,Math.min(LOOK_LIMIT,value));
// Every player occupies one real seat around the square; your seat is the camera.
export function squareSeats(players,viewerId,radius=2.95){
 const own=players.findIndex(p=>p.id===viewerId),ordered=own<0?[null,...players]:players.map((_,i)=>players[(own+i)%players.length]);
 return ordered.slice(1).map((player,i)=>{const angle=(i+1)*Math.PI*2/ordered.length,s=Math.sin(angle),c=Math.cos(angle),factor=radius/Math.max(Math.abs(s),Math.abs(c));return {player,x:s*factor,z:c*factor};});
}
export function lookZone(x,y,width,height){if(y<height*.17)return 'up';if(x<width*.14)return 'left';if(x>width*.86)return 'right';return 'drag';}
export function focusYaw(x,z,cameraZ=2.95){return clampLook(Math.atan2(-x,cameraZ-z));}
