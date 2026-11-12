import {DiscFace} from './DiscInspector';
export default function SealedDiscCase({instance,edition,phase='done'}){
 return <div className={`disc-sealing-stage seal-${phase} seal-rarity-${instance.rarity}`} style={{'--seal-color':edition?.color||'#a9b2bf'}} role="img" aria-label={phase==='done'?'Диск в закрытом контейнере с пломбой':'Диск и защитный контейнер'}><div className="disc-sealing-base"><i/></div><div className="disc-sealing-disc"><DiscFace item={instance.item} cracked={instance.cracked}/></div><div className="disc-sealing-lid"><div className="disc-sealing-glass"/><span>YAB / SEALED EDITION</span></div><div className="disc-sealing-stamp"><b>Y</b><small>SEALED</small></div><div className="disc-sealing-scan"/></div>;
}
