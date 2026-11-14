import {PARTY_TRAIT_LABELS} from '../partyTraitLabels';
import {useState} from 'react';
const LABELS=PARTY_TRAIT_LABELS;
export default function PartyDossier({room,me}){
 const [readKey,setReadKey]=useState(''),[manual,setManual]=useState(false);
 if(room.kind!=='bunker'||['lobby','briefing'].includes(room.phase)||!me||!Object.keys(me.traits||{}).length)return null;
 const key=room.code+':'+me.id+':'+JSON.stringify(me.traits);
 const open=manual||readKey!==key;
 return <><button className="party-dossier-open" onClick={()=>setManual(true)}>Личное досье</button>{open&&<div className="party-dossier-shade" role="presentation"><section className="party-full-dossier" role="dialog" aria-modal="true" aria-labelledby="party-dossier-title"><small>YAB / АРХИВ УБЕЖИЩА · {room.code}</small><h2 id="party-dossier-title">Личное дело</h2><p className="party-dossier-classified">ТОЛЬКО ДЛЯ ТВОИХ ГЛАЗ</p><header><b>{me.name}</b><span>Участник № {me.id}</span></header><dl>{Object.entries(me.traits).map(([id,value])=><div key={id}><dt>{LABELS[id]||id}</dt><dd>{value}</dd><small>{me.revealed.includes(id)?'Раскрыто совету':'Закрытая информация'}</small></div>)}</dl><p>Это твой персонаж в этой комнате. Перезаход не меняет досье. Чтение не раскрывает закрытые сведения другим игрокам.</p><button autoFocus onClick={()=>{setReadKey(key);setManual(false);}}>Ознакомился · за стол →</button></section></div>}</>;
}
