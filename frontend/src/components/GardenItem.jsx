import {useId} from 'react';
import {GardenVariantDefs,GardenVariantStars} from './GardenVariant';
import catalog from '../../../garden_catalog.json';
function Produce({item}){
 const color=item.color,art=item.art;
 if(item.id==='radish')return <><path d="M25 29h30v22H25zm5 22h20v9H30zm9 9h5v9h-5z" fill={color}/><path d="M28 30h24v7H28z" fill="#f0d7d6"/><path d="M36 22h8v9h-8zm8-5h10v7H44z" fill="#82ac7e"/></>;
 if(art==='carrot')return <><path d="m20 34 11-9 28 16-9 17-17 6z" fill={color}/><path d="m24 35 8-6 20 12-4 5z" fill="#ffd39b"/><path d="m36 43 7 4-3 5-7-4zm9 10 5 3-2 4-5-3z" fill="#bd7c4b"/><path d="m23 32-8-7 5-5 10 8zm4-4 1-12 7 1-3 14z" fill="#88b98b"/></>;
 if(art==='beans')return <><path d="M17 29h11v29H17zm5-8h11v13H22zm17 11h12v30H39zm5-10h11v14H44z" fill={color}/><path d="M21 35h5v6h-5zm0 12h5v6h-5zm23-8h5v6h-5zm0 12h5v6h-5z" fill="#e6efbd"/></>;
 if(art==='sunflower')return <><path d="M26 20h29v35H26zM18 29h45v18H18zM24 24h34v27H24z" fill={color}/><path d="M25 28h31v19H25z" fill="#786c4b"/><path d="M29 32h23v11H29z" fill="#2c3e38"/><path d="M32 34h5v6h-5zm12 0h5v6h-5z" fill="#ced8bb"/><path d="m21 59 5-4 4 7-5 4zm30-3 5-4 4 7-5 4z" fill="#b7a780"/></>;
 if(art==='cactus')return <><path d="M25 26h29v33H25zM31 20h17v6H31z" fill={color}/><path d="M30 32h19v18H30z" fill="#3d6b5c"/><path d="M34 35h11v5H34zm3-3h5v11h-5z" fill="#d9edbd"/><path d="M30 54h19v3H30z" fill="#a5d4b0"/></>;
 if(art==='berry')return <><path d="M22 31h35v20H22zm5 20h25v8H27zm8 8h10v6H35z" fill={color}/><path d="M25 25h10v7H25zm10 2h9v9h-9zm9-2h12v7H44z" fill="#84ad7d"/><path d="M29 39h4v4h-4zm15 1h4v4h-4zm-8 12h4v4h-4z" fill="#f4dcad"/></>;
 if(art==='flower')return <><path d="M18 29h20v22H18zm-4 22h28v5H14zM43 23h18v23H43zm-4 23h27v5H39z" fill={color}/><path d="M27 37h5v16h-5zm24-7h5v18h-5z" fill="#f1e7c5"/><path d="m31 55 19-7 3 7-20 7z" fill="#91af9a"/></>;
 if(art==='melon')return <><path d="m17 45 29-23 18 30-23 13z" fill={color}/><path d="m23 45 23-17 13 23-18 10z" fill="#dbbdd1"/><path d="m23 45 23-17-8 27z" fill="#edeced88"/><path d="M36 40h3v5h-3zm11 4h3v5h-3zm-7 8h3v5h-3z" fill="#537b84"/></>;
 if(art==='tree')return item.id==='aurora'?<><path d="m23 31 16-10 17 10 5 19-22 14-20-15z" fill={color}/><path d="m27 31 12-7 13 7-13 22z" fill="#e0f0e7"/><path d="m31 22-5-12 12 8 7-10 2 15z" fill="#95b7ad"/><path d="M28 49h22v5H28z" fill="#85b0c7"/></>:<><path d="m40 16 8 15 17 3-12 13 3 17-16-8-16 8 3-17-12-13 17-3z" fill={color}/><path d="m40 23 5 12 12 2-12 7-5 10-5-10-11-7 12-2z" fill="#f0dcac"/></>;
 return <><path d="M24 24h24v7H24zM17 31h39v15H17zM28 46h15v17H28z" fill={color}/><path d="M28 47h15v16H28z" fill="#d8d2d6"/><path d="M25 33h6v6h-6zm16-2h7v7h-7z" fill="#dbedda"/><path d="M49 49h15v7H49zm-4 7h23v7H45z" fill="#c7b7e0"/></>;
}
export default function GardenItem({crop,kind='seed',variant='normal'}){
 const id=useId().replaceAll(':','');
 const item=catalog.find(c=>c.id===crop);if(!item)return null;
 const seed=kind==='seed',edition={common:'#8aab91',rare:'#85afcd',epic:'#ba99d5'}[item.rarity];
 return <svg className={`garden-item garden-item-${kind} variant-${kind==='seed'?'normal':variant}`} viewBox="0 0 80 80" role="img" aria-label={`${seed?'Семена':'Урожай'}: ${item.name}`} shapeRendering="crispEdges"><GardenVariantDefs id={id}/>{seed?<><path d="M18 8h43v65H18z" fill="#172d2940"/><path d="M15 6h44v65H15z" fill="#e6dfc8"/><path d="M15 6h44v9H15z" fill={edition}/><path d="M18 17h38v37H18z" fill="#f4edd8"/><g transform="translate(13,14) scale(.6)"><Produce item={item}/></g><path d="M20 57h6v6h-6zm10 0h5v6h-5z" fill="#937c57"/><text x="46" y="62" textAnchor="middle" fill="#435a48" fontFamily="monospace" fontSize="5">SEED</text><path d="M18 9h38M18 66h38" stroke="#fff" strokeOpacity=".5" strokeWidth="1"/><path d="M59 7h3v64h-3z" fill="#b3ac98"/></>:<><ellipse cx="40" cy="69" rx="29" ry="5" fill="#142b2533"/><g filter={variant==='golden'?`url(#${id}gold)`:variant==='shiny'?`url(#${id}shiny)`:undefined}><Produce item={item}/></g><GardenVariantStars variant={variant}/><path d="M12 63h56v9H12z" fill="#8e775f"/><path d="M12 63h56v3H12z" fill="#b3a07f"/><path d="M17 67h2v4h-2zm43 0h2v4h-2z" fill="#4b5144"/></>}</svg>;
}
