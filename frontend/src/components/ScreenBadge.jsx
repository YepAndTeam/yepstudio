import {useLayoutEffect,useRef} from 'react';
import './ScreenBadge.css';
export function badgeFinish(badge={}){const colors={titanium:['#142923','#c3eba5'],night:['#111e29','#9fdcfa'],enamel:['#302d23','#efd79b'],brass:['#2c201b','#f3bf89'],steel:['#122533','#b0edee'],mint:['#173025','#bcecc8']};const [screen,ink]=colors[badge.finish]||colors.titanium;return {body:badge.frame||'#c4c9c2',edge:'color-mix(in srgb,'+(badge.frame||'#c4c9c2')+',#14251e 40%)',screen,ink};}
function TitleDisplay({title}){
 const node=useRef(null);
 useLayoutEffect(()=>{const el=node.current;const fit=()=>{let size=28;el.style.fontSize=size+'px';while(size>11&&(el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight)){size--;el.style.fontSize=size+'px';}};fit();const observer=new ResizeObserver(fit);observer.observe(el.parentElement);let alive=true;document.fonts?.ready.then(()=>{if(alive)fit();});return()=>{alive=false;observer.disconnect();};},[title]);
 return <strong ref={node} className="ym-title">{title}</strong>;
}
const cornerSegments=['tl','tr','br','bl'].flatMap((corner,index)=>Array.from({length:6},(_,segment)=>{
 const angle=(180+index*90+(segment+.5)*15)*Math.PI/180,radius=13;
 const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
 return {key:corner+segment,left:corner.includes('r')?`calc(100% - ${radius-x}px)`:`${radius+x}px`,top:corner.includes('b')?`calc(100% - ${radius-y}px)`:`${radius+y}px`,transform:`translate(-50%,-50%) rotateZ(${angle*180/Math.PI+90}deg) rotateX(90deg)`};
}));
export function BadgeModule({finish,title,boot=0,onPower,serial="C–0001"}){
 return <div className="ym-solid" style={{'--ym-body':finish.body,'--ym-edge':finish.edge,'--ym-screen':finish.screen,'--ym-ink':finish.ink}}>
  <div className="ym-face ym-front"><div className="ym-top"><b>YAB</b><span>PERSONAL MODULE</span><i/></div><div className="ym-bezel">{['top','bottom','left','right'].map(side=><i key={side} className={'ym-display-wall wall-'+side}/>)}<div className="ym-display" key={boot}><div className="ym-screen-top"><span>PLAYER ID</span><span>01</span></div><TitleDisplay title={title}/><div className="ym-screen-bottom"><span>● TITLE LOADED</span><span>▰▰▰▱</span></div><i className="ym-scan"/></div><i className="ym-glass-reflection"/><i className="ym-glass-edge"/></div><div className="ym-bottom"><span>Y–ID / 01<small>№ {serial}</small></span><span className="ym-speaker"><i/><i/><i/><i/></span></div>{['tl','tr','bl','br'].map(c=><i className={'ym-screw '+c} key={c}/>)}</div>
  <div className="ym-face ym-back"><b>YAB</b><span>PERSONAL MODULE</span><div className="ym-service-panel"><small>PROPERTY OF PLAYER</small><code>{serial}</code><i/><p>ONE TITLE<br/>ONE PLAYER</p></div><span className="ym-back-contacts">▥ ▥ ▥ ▥ ▥</span></div>
  {cornerSegments.map(({key,...style})=><i className="ym-corner" style={style} key={key}/>)}
  <div className="ym-side ym-left"/><div className="ym-side ym-right"><button tabIndex={onPower?0:-1} disabled={!onPower} onPointerDown={e=>e.stopPropagation()} onClick={onPower} aria-label="Включить экран модуля"/></div><div className="ym-side ym-top-side"/><div className="ym-side ym-bottom-side"/>
 </div>;
}
