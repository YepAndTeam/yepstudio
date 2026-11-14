import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {publicBadgeCache} from '../publicBadges';
import './PlayerName.css';
const screens={titanium:['#142923','#c3eba5'],night:['#111e29','#9fdcfa'],enamel:['#302d23','#efd79b'],brass:['#2c201b','#f3bf89'],steel:['#122533','#b0edee'],mint:['#173025','#bcecc8']};
export default function PlayerName({userId,name,showTitle=true}){
 const id=Number(userId),subscribe=useCallback(fn=>publicBadgeCache.subscribe(id,fn),[id]),snapshot=useCallback(()=>publicBadgeCache.get(id),[id]);
 const badge=useSyncExternalStore(subscribe,snapshot,()=>null);
 useEffect(()=>{if(showTitle)publicBadgeCache.ensure(id);},[id,showTitle]);
 const title=badge&&[badge.prefix,badge.title].filter(Boolean).join(' '),screen=screens[badge?.finish]||screens.titanium;
 return <span className="player-name"><span className="player-name-label">{name||'Игрок'}</span>{showTitle&&title&&<span className="player-title-screen" title={title} aria-label={'Титул: '+title} style={{'--player-title-metal':badge.frame||'#a6b4aa','--player-title-screen':screen[0],'--player-title-ink':screen[1]}}><i aria-hidden="true"/><span>{title}</span></span>}</span>;
}
