import {useLayoutEffect,useRef} from 'react';
import {BADGE_STUDIES} from '../badgeStudies';
import './StudioBadge.css';
function FittedLine({children}){
 const ref=useRef(null);
 useLayoutEffect(()=>{
  const node=ref.current, parent=node.parentElement;
  let disposed=false;
  const fit=()=>{
   if(disposed)return;
   node.style.fontSize='';
   node.style.letterSpacing='';
   const base=parseFloat(getComputedStyle(parent).fontSize);
   const available=parent.clientWidth;
   // Local layout dimensions stay accurate while the inspector rotates in 3D.
   const textWidth=node.scrollWidth;
   if(available>0&&textWidth>available){
    const ratio=Math.max(0,available-2)/textWidth;
    node.style.fontSize=`${base*ratio}px`;
    node.style.letterSpacing=`${(parseFloat(getComputedStyle(parent).letterSpacing)||0)*ratio}px`;
   }
  };
  fit();
  const observer=new ResizeObserver(fit);observer.observe(parent);
  document.fonts?.ready.then(()=>{if(!disposed)fit();});
  return()=>{disposed=true;observer.disconnect();};
 },[children]);
 return <span className="tag-fitted-line" ref={ref}>{children}</span>;
}
export default function StudioBadge({badge=BADGE_STUDIES[0],compact=false,iconOnly=false,animated=false}){
 const style={'--tag-metal':badge.frame};
 if(iconOnly)return <svg className={'studio-badge-stamp finish-'+badge.finish} style={style} viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id={'tag-'+badge.id} x2="1" y2="1"><stop stopColor="#edf0ee"/><stop offset=".4" stopColor={badge.frame}/><stop offset=".65" stopColor="#d1d5d2"/><stop offset="1" stopColor={badge.frame}/></linearGradient></defs><g transform="rotate(-13 50 50)"><rect x="24" y="8" width="55" height="86" rx="14" fill="#101919" opacity=".35"/><rect x="21" y="5" width="55" height="86" rx="14" fill={'url(#tag-'+badge.id+')'} stroke="#697572"/><rect x="25" y="9" width="47" height="78" rx="11" fill="none" stroke="#ffffff77"/><circle cx="48.5" cy="19" r="5" fill="#293330" stroke="#e4e8e2" strokeWidth="2"/><path d="M32 38h29M32 46h22M32 54h30M32 69h18M32 74h25" stroke="#505b58" strokeWidth="2"/><path d="M32 39h29M32 47h22M32 55h30M32 70h18M32 75h25" stroke="#ffffff77" strokeWidth="1"/></g></svg>;
 return <span className={'studio-badge finish-'+badge.finish+(compact?' badge-compact':'')+(animated?' badge-arriving':'')} style={style} role="img" aria-label={`${badge.prefix} ${badge.title}, уникальный жетон ${badge.serial}`}><span className="studio-badge-frame"><span className="tag-hole" aria-hidden="true"/><span className="tag-rim" aria-hidden="true"/><span className="studio-badge-lettering"><small>YAB / PERSONAL ID</small><span className="studio-badge-prefix"><FittedLine>{badge.prefix}</FittedLine></span><b><FittedLine>{badge.title}</FittedLine></b><span className="tag-identity"><code>№ {badge.serial}</code><span>ЕДИНСТВЕННЫЙ ЭКЗЕМПЛЯР</span></span></span><span className="studio-badge-sheen" aria-hidden="true"/></span></span>;
}
