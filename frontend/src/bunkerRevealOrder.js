export function bunkerRevealOrder(seed=0){
 const keys=['biography','health','hobby','phobia','baggage','fact','trait'];let state=(Math.trunc(seed)+71)>>>0;
 for(let i=keys.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[keys[i],keys[j]]=[keys[j],keys[i]];}
 return keys;
}
