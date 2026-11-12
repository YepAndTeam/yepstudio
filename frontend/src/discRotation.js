export const normalizeDiscAngle=yaw=>((yaw%360)+360)%360;
export const discBackVisible=yaw=>Math.cos(yaw*Math.PI/180)<-.45;
export const secretDiscOpacity=yaw=>Math.max(0,1-Math.abs(Math.abs(normalizeDiscAngle(yaw)-180)-28)/12);
