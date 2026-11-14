// Pure offer rules. Integer basis points keep every distribution exactly 100%.
export const DISC_VALUES={common:1,rare:2,epic:3,mythic:4,legendary:5,secret:6};
export const RARITY_INFLUENCE={common:3,rare:7,epic:12,mythic:40,legendary:65,secret:100};
export const CHESTS={worn:'Потёртый сундук',reserve:'Личный запас',parcel:'Посылка Яабику',stash:'Тайник под прилавком'};
export const OFFER_VERSION=1;
function validate(discs){
 if(!Array.isArray(discs)||discs.length<1||discs.length>3)throw Error('Нужно от 1 до 3 дисков');
 const identities=new Set();
 for(const disc of discs){
  if(!DISC_VALUES[disc.rarity]||!(disc.item?.id||disc.disc_id))throw Error('Неизвестный диск');
  if(disc.status&&disc.status!=='ready')throw Error('Нужны новые неактивированные диски');
  if(disc.id){if(identities.has(disc.id))throw Error('Один экземпляр нельзя учесть дважды');identities.add(disc.id);}
 }
}
export function offerSignature(discs){
 validate(discs);
 // Instance IDs and display order do not let identical copies reroll the offer.
 return JSON.stringify(discs.map(d=>[d.item?.id||d.disc_id,d.rarity]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])));
}
export function evaluateDiscs(discs){
 validate(discs);
 const ordered=[...discs].sort((a,b)=>DISC_VALUES[b.rarity]-DISC_VALUES[a.rarity]);
 const strongest=ordered[0].rarity,boost=ordered.slice(1).reduce((sum,d)=>sum+RARITY_INFLUENCE[d.rarity],0);
 const value=discs.reduce((sum,d)=>sum+DISC_VALUES[d.rarity],0);
 let worn=0,reserve=0,parcel=0,stash=0;
 if(strongest==='secret'){
  stash=Math.min(85,40+boost*.5);parcel=100-stash;
 }else if(strongest==='legendary'){
  const high=Math.min(95,65+boost);stash=Math.min(55,25+boost*.5);parcel=high-stash;reserve=100-high;
 }else if(strongest==='mythic'){
  const high=Math.min(95,40+boost);stash=Math.min(35,8+boost*.2);parcel=high-stash;reserve=100-high;
 }else{
  const high=Math.min(60,discs.reduce((sum,d)=>sum+RARITY_INFLUENCE[d.rarity],0));
  stash=Math.max(0,high-24)*.15;parcel=Math.max(0,high-12)*.35;reserve=high-parcel-stash;worn=100-high;
 }
 const weights={worn:Math.round(worn*100),reserve:Math.round(reserve*100),parcel:Math.round(parcel*100),stash:Math.round(stash*100)};
 weights.worn+=10000-Object.values(weights).reduce((a,b)=>a+b,0);
 return {value,weights,strongest,signature:offerSignature(discs),requiresWarning:discs.some(d=>DISC_VALUES[d.rarity]>=5)};
}
export function chooseChest(weights,roll){
 if(!Number.isInteger(roll)||roll<0||roll>=10000||Object.values(weights).some(w=>!Number.isInteger(w)||w<0)||Object.values(weights).reduce((a,b)=>a+b,0)!==10000)throw Error('Некорректный розыгрыш');
 let edge=0;for(const key of Object.keys(CHESTS)){edge+=weights[key];if(roll<edge)return key;}
 throw Error('Не найден сундук');
}
const rewards={worn:['coins','cassette'],reserve:['coins','cassette','badge','usb'],parcel:['accessory','badge','ticket','usb'],stash:['bait','usb','badge','ticket']};
export function makeOffer(discs,randomInt){
 const assessment=evaluateDiscs(discs),chest=chooseChest(assessment.weights,randomInt(10000)),pool=rewards[chest],kind=pool[randomInt(pool.length)];
 return {version:OFFER_VERSION,signature:assessment.signature,chest,kind,amount:kind==='coins'?5+randomInt(16):undefined,assessment};
}
export function getRememberedOffer(cache,discs,randomInt){
 const signature=offerSignature(discs),old=cache[signature];
 if(old?.version===OFFER_VERSION&&old.signature===signature&&CHESTS[old.chest]&&rewards[old.chest].includes(old.kind))return {offer:old,reused:true};
 const offer=makeOffer(discs,randomInt);cache[signature]=offer;return {offer,reused:false};
}
