import { bls12_381 } from "@noble/curves/bls12-381";
const CHAIN={hash:'8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce',public_key:'868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31',period:30,genesis_time:1595431050,scheme:'pedersen-bls-chained'};
const bytes=hex=>{if(typeof hex!=='string'||hex.length%2||!/^[0-9a-f]+$/i.test(hex))throw Error('Некорректные данные доказательства');return Uint8Array.from(hex.match(/../g),b=>parseInt(b,16));};
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const sha=async data=>new Uint8Array(await crypto.subtle.digest('SHA-256',data));
const encode=value=>new TextEncoder().encode(value);
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function verifyRace(packet){
 const {rules,beacon,commitment,ranking}=packet;
 if(rules.algorithm!=='yab-race-v1'||canonical(rules.chain)!==canonical(CHAIN))throw Error('Неизвестные правила или сеть случайности');
 const modern=rules.format==='knockout-v2',pre=modern&&rules.node_id==='PRE';
 if(rules.duration_seconds!==(modern?60:180)||rules.payout_rule!=='floor(stake*odds_bps/10000)')throw Error('Неверные условия заезда');
 const start=Date.parse(rules.starts_at),close=Date.parse(rules.closes_at);
 if(!Number.isFinite(start)||!Number.isFinite(close)||(modern?start!==close:start<=close)||rules.beacon_round!==(modern?Math.floor((start/1000-CHAIN.genesis_time)/CHAIN.period)+2:Math.ceil(((start/1000-30)-CHAIN.genesis_time)/CHAIN.period)+1))throw Error('Неверное расписание случайности');
 if(hex(await sha(encode(canonical(rules))))!==commitment)throw Error('Правила изменены');
 if(!Number.isSafeInteger(beacon.round)||beacon.round!==rules.beacon_round)throw Error('Подменён раунд');
 if((CHAIN.genesis_time+(beacon.round-1)*CHAIN.period)*1000<=Date.parse(rules.closes_at))throw Error('Случайность появилась до закрытия ставок');
 const signature=bytes(beacon.signature),previous=bytes(beacon.previous_signature),round=new Uint8Array(8);new DataView(round.buffer).setBigUint64(0,BigInt(beacon.round));
 const message=await sha(new Uint8Array([...previous,...round]));
 if(hex(await sha(signature))!==beacon.randomness||!bls12_381.verify(signature,message,bytes(CHAIN.public_key)))throw Error('Подпись drand не прошла проверку');
 const horses=rules.horses.map(h=>({...h}));
 if(![2,10].includes(horses.length)||new Set(horses.map(h=>h.number)).size!==horses.length||horses.some(h=>!Number.isInteger(h.weight)||h.weight<=0||!Number.isInteger(h.number)||h.number<1||h.number>10||h.odds_bps!==(pre?10000:Math.floor(90000000/h.weight)))||horses.reduce((sum,h)=>sum+h.weight,0)!==10000)throw Error('Неверные шансы или коэффициенты лошадей');
 if(modern&&(rules.winners_count!==(pre?8:1)||(pre&&(horses.length!==10||horses.some(h=>h.weight!==1000)))||(!pre&&horses.length!==2)))throw Error('Неверные правила прохода');
 const seed=await sha(encode('yab-race-v1|'+commitment+'|'+beacon.randomness)),result=[];let counter=0;
 while(horses.length){const total=BigInt(horses.reduce((sum,h)=>sum+h.weight,0)),range=1n<<256n,limit=range-range%total;let value;
  do{const n=new Uint8Array(8);new DataView(n.buffer).setBigUint64(0,BigInt(counter++));value=BigInt('0x'+hex(await sha(new Uint8Array([...seed,...n]))));}while(value>=limit);
  let pick=Number(value%total);for(let i=0;i<horses.length;i++){if(pick<horses[i].weight){result.push(horses[i].number);horses.splice(i,1);break;}pick-=horses[i].weight;}
 }
 if(canonical(result)!==canonical(ranking))throw Error('Результат не соответствует случайности');
 return true;
}
