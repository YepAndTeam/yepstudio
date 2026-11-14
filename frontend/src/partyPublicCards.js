import {PARTY_TRAIT_LABELS} from './partyTraitLabels.js';
const ROLES={civilian:'Мирный житель',mafia:'Мафия',doctor:'Доктор',detective:'Комиссар'};
const LABELS=PARTY_TRAIT_LABELS;
// Never put the local player's known but still secret role/traits on the shared table.
export function publicTableCards(room){
 return room.players.flatMap(player=>room.kind==='mafia'?
  (player.alive===false&&typeof ROLES[player.role]==='string'?[{id:player.id+':role',ownerId:player.id,owner:player.name,key:'role',role:player.role,label:'Роль',value:ROLES[player.role]}]:[]):
  (player.revealed||[]).filter(key=>Object.prototype.hasOwnProperty.call(LABELS,key)&&typeof player.traits?.[key]==='string').map(key=>({id:player.id+':'+key,ownerId:player.id,owner:player.name,key,label:LABELS[key],value:player.traits[key]})));
}
