import {useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {rollBadgeTitle} from './badgeTitleRoll';
import {BADGE_WORDS} from './badgeWords';
import {COMMUNITY_BADGE_TITLES} from './communityBadgeTitles';
import './styles.css';
import './moduleBadgePreview.css';
if(!import.meta.env.DEV)throw Error('Local concept only');
const finishes=[
 {id:'studio',name:'Студийный',body:'#c4c9c2',edge:'#788880',screen:'#142923',ink:'#c3eba5'},
 {id:'graphite',name:'Графит',body:'#404a50',edge:'#202d34',screen:'#111e29',ink:'#9fdcfa'},
 {id:'ivory',name:'Пломбир',body:'#e3ddcc',edge:'#a9a18b',screen:'#302d23',ink:'#efd79b'},
 {id:'lilac',name:'Лиловый',body:'#9e9bad',edge:'#69657f',screen:'#231e35',ink:'#e2c2f9'},
 {id:'blue',name:'Синий',body:'#8cabc0',edge:'#536f85',screen:'#122533',ink:'#b0edee'},
 {id:'copper',name:'Медный',body:'#b29a84',edge:'#786351',screen:'#2c201b',ink:'#f3bf89'},
];
const titleCandidates=[...COMMUNITY_BADGE_TITLES,...BADGE_WORDS.nouns.flatMap(noun=>{
 const linked=BADGE_WORDS.adjectives.filter(a=>a.tags.some(tag=>noun.tags.includes(tag)));
 return (linked.length?linked:BADGE_WORDS.adjectives).map(a=>a[noun.gender]+' '+noun.word);
})];
const longestTitle=titleCandidates.reduce((longest,title)=>[...title].length>[...longest].length?title:longest,'');
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
function Module({finish,title,boot,onPower}){
 return <div className="ym-solid" style={{'--ym-body':finish.body,'--ym-edge':finish.edge,'--ym-screen':finish.screen,'--ym-ink':finish.ink}}>
  <div className="ym-face ym-front"><div className="ym-top"><b>YAB</b><span>PERSONAL MODULE</span><i/></div><div className="ym-bezel">{['top','bottom','left','right'].map(side=><i key={side} className={'ym-display-wall wall-'+side}/>)}<div className="ym-display" key={boot}><div className="ym-screen-top"><span>PLAYER ID</span><span>01</span></div><TitleDisplay title={title}/><div className="ym-screen-bottom"><span>● TITLE LOADED</span><span>▰▰▰▱</span></div><i className="ym-scan"/></div><i className="ym-glass-reflection"/><i className="ym-glass-edge"/></div><div className="ym-bottom"><span>Y–ID / 01<small>№ C–0001</small></span><span className="ym-speaker"><i/><i/><i/><i/></span></div>{['tl','tr','bl','br'].map(c=><i className={'ym-screw '+c} key={c}/>)}</div>
  <div className="ym-face ym-back"><b>YAB</b><span>PERSONAL MODULE</span><div className="ym-service-panel"><small>PROPERTY OF PLAYER</small><code>C–0001</code><i/><p>ONE TITLE<br/>ONE PLAYER</p></div><span className="ym-back-contacts">▥ ▥ ▥ ▥ ▥</span></div>
  {cornerSegments.map(({key,...style})=><i className="ym-corner" style={style} key={key}/>)}
  <div className="ym-side ym-left"/><div className="ym-side ym-right"><button onPointerDown={e=>e.stopPropagation()} onClick={onPower} aria-label="Включить экран модуля"/></div><div className="ym-side ym-top-side"/><div className="ym-side ym-bottom-side"/>
 </div>;
}
export default function Preview(){
 const [finish,setFinish]=useState(finishes[0]),[title,setTitle]=useState(longestTitle),[worn,setWorn]=useState(null),[boot,setBoot]=useState(0),[angle,setAngle]=useState({x:-12,y:-20});const drag=useRef(null);
 const turn=(x,y)=>setAngle(a=>({x:a.x+x,y:a.y+y}));const power=()=>setBoot(n=>n+1);
 return <div className="ym-preview"><main className="ym-page"><aside className="ym-kicker"><span>YAB / DESIGN LAB</span><b>CONCEPT 01</b></aside><h1>Твой титул.<br/><span>В своём устройстве.</span></h1><p className="ym-intro">Первый макет экранного бейджика. Потяни за корпус, чтобы рассмотреть его со всех сторон.</p>
 <div className="ym-stage" role="group" aria-label="Вращение экранного бейджика" tabIndex={0} onKeyDown={e=>{const moves={ArrowLeft:[0,-15],ArrowRight:[0,15],ArrowUp:[-15,0],ArrowDown:[15,0]};if(moves[e.key]){e.preventDefault();turn(...moves[e.key]);}}} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const {x,y}=drag.current;drag.current={x:e.clientX,y:e.clientY};turn(-(e.clientY-y)*.65,(e.clientX-x)*.65);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}><div className="ym-orbit" style={{transform:`rotateX(${angle.x}deg) rotateY(${angle.y}deg)`}}><Module finish={finish} title={title} boot={boot} onPower={power}/></div></div>
 <div className="ym-turn-buttons"><button onClick={()=>turn(0,180)}>Оборот</button><button onClick={()=>setAngle({x:-12,y:-20})}>Исходный вид</button><button onClick={power}>Включить экран</button></div>
 <section className="ym-options"><div className="ym-section-heading"><h2>Корпус</h2><span>{finish.name}</span></div><div className="ym-swatches">{finishes.map(f=><button key={f.id} onClick={()=>{setFinish(f);power();}} aria-label={'Корпус: '+f.name} aria-pressed={finish.id===f.id} style={{'--swatch':f.body}}><i/></button>)}</div><button className="ym-change" onClick={()=>{const text=rollBadgeTitle();setTitle([text.prefix,text.title].filter(Boolean).join(' '));power();}}>Другая надпись <span>↻</span></button><button className="ym-change" onClick={()=>{setTitle(longestTitle);power();}}>Проверить длинный титул <span>↗</span></button></section>
 <button className="ym-equip" onClick={()=>setWorn({finish,title})}>{worn?.title===title&&worn?.finish.id===finish.id?'Примерено к профилю':'Примерить к профилю'}</button><section className="ym-profile"><small>ТАК РЯДОМ С НИКОМ</small><div><span className="ym-avatar">Т</span><div><b>Твой профиль</b><span className="ym-inline" style={{'--ym-body':(worn?.finish||finish).body,'--ym-screen':(worn?.finish||finish).screen,'--ym-ink':(worn?.finish||finish).ink}}><i/><span>{worn?.title||title}</span></span></div></div></section><p className="ym-length-note">{title===longestTitle?'Самый длинный титул в текущем наборе · '+[...title].length+' символов':'Надпись подстраивается под экран целыми словами'}</p><p className="ym-note">Дизайн-макет. Настоящие жетоны и их владельцы не меняются.</p></main></div>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('app'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Preview/>);
