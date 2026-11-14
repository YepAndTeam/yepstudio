export const PARTY_FRAME_MS=1000/60;
export const partyMotionBlend=(seconds,rate)=>1-Math.exp(-rate*seconds);
