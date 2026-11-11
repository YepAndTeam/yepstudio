// Discard accumulated normal gravity when acceleration begins: it must not
// become several instant downward steps on the next frame.
export function setSoftDrop(state,on){
 if(on&&!state.soft)state.acc=0;
 state.soft=on;
}
