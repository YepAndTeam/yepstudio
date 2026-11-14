import {rollRewardDetails} from './bekovichRewards.js';
import {rollStudioBadge} from './badgeTitleRoll.js';
import garden from '../../garden_catalog.json' with {type:'json'};
export const BEKOVICH_EPIC_SEEDS=garden.filter(seed=>seed.rarity==='epic');
// Pure offer rules. Integer basis points keep every distribution exactly 100%.
export const DISC_VALUES={common:1,rare:2,epic:3,mythic:4,legendary:5,secret:6};
export const RARITY_INFLUENCE={common:3,rare:7,epic:12,mythic:40,legendary:65,secret:100};
export const CHESTS={worn:'Потёртый сундук',reserve:'Личный запас',parcel:'Посылка Яабику',stash:'Тайник под прилавком'};
export const OFFER_VERSION=1;
// Cumulative odds: any upgrade, parcel-or-better, then stash. Interpolation
// preserves smooth improvements without changing the high-rarity rules.
const LOW_TIER_ODDS=[
 [0,0,0,0],[9,9,0,0],[12,20,2,.3],
 [21,45,10,1],[26,55,15,2],[36,75,25,4],
];
function lowerTierOdds(score){
 const index=LOW_TIER_ODDS.findIndex(row=>row[0]>=score);
 if(index<0)return LOW_TIER_ODDS.at(-1).slice(1);
 if(index===0)return LOW_TIER_ODDS[0].slice(1);
 const low=LOW_TIER_ODDS[index-1],high=LOW_TIER_ODDS[index];
 const fraction=(score-low[0])/(high[0]-low[0]);
 return low.slice(1).map((value,i)=>value+(high[i+1]-value)*fraction);
}
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
  const score=discs.reduce((sum,d)=>sum+RARITY_INFLUENCE[d.rarity],0);
  const [upgraded,high,stashChance]=lowerTierOdds(score);
  stash=stashChance;parcel=high-stash;reserve=upgraded-high;worn=100-upgraded;
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
const rewards={worn:['coins','cassette'],reserve:['coins','cassette','badge','usb'],parcel:['accessory','epic_seed','badge','ticket','usb'],stash:['bait','usb','badge','ticket']};
export function makeOffer(discs,randomInt){
 const assessment=evaluateDiscs(discs);
 if(discs.length===1&&['common','secret'].includes(discs[0].rarity)&&randomInt(10000)>=500)return {version:OFFER_VERSION,signature:assessment.signature,refused:true,assessment};
 const chest=chooseChest(assessment.weights,randomInt(10000)),pool=rewards[chest],kind=pool[randomInt(pool.length)];
 return {version:OFFER_VERSION,signature:assessment.signature,chest,kind,...rollRewardDetails(kind,randomInt),...(kind==='epic_seed'?{amount:1}:{}),badge:kind==='badge'?rollStudioBadge(()=>randomInt(1000000)/1000000):undefined,seed:kind==='epic_seed'?BEKOVICH_EPIC_SEEDS[randomInt(BEKOVICH_EPIC_SEEDS.length)].id:undefined,assessment};
}
export function getRememberedOffer(cache,discs,randomInt){
 const signature=offerSignature(discs),old=cache[signature];
 if(old?.version===OFFER_VERSION&&old.signature===signature&&(old.refused===true||CHESTS[old.chest]&&rewards[old.chest].includes(old.kind))&&(old.kind!=='epic_seed'||BEKOVICH_EPIC_SEEDS.some(s=>s.id===old.seed)))return {offer:old,reused:true};
 const offer=makeOffer(discs,randomInt);cache[signature]=offer;return {offer,reused:false};
}
