// Disc tempo rating is distinct from the actual simulation speed.
export function tempoMultiplier(tempo=1){
 const points=Math.round((tempo-1)*10000)/100;
 if(points<=0)return Math.max(.1,tempo);
 if(points<=5)return 1+points*.04;
 if(points<=10)return 1.2+(points-5)*.06;
 return 1.5+(Math.min(points,30)-10)*.1;
}
