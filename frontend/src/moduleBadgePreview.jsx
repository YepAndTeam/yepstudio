import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {rollBadgeTitle} from './badgeTitleRoll';
import {BADGE_WORDS} from './badgeWords';
import {COMMUNITY_BADGE_TITLES} from './communityBadgeTitles';
import './styles.css';
import {BadgeModule} from './components/ScreenBadge';
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
export default function Preview(){
 const [finish,setFinish]=useState(finishes[0]),[title,setTitle]=useState(longestTitle),[worn,setWorn]=useState(null),[boot,setBoot]=useState(0),[angle,setAngle]=useState({x:-12,y:-20});const drag=useRef(null);
 const turn=(x,y)=>setAngle(a=>({x:a.x+x,y:a.y+y}));const power=()=>setBoot(n=>n+1);
 return <div className="ym-preview"><main className="ym-page"><aside className="ym-kicker"><span>YAB / DESIGN LAB</span><b>CONCEPT 01</b></aside><h1>Твой титул.<br/><span>В своём устройстве.</span></h1><p className="ym-intro">Первый макет экранного бейджика. Потяни за корпус, чтобы рассмотреть его со всех сторон.</p>
 <div className="ym-stage" role="group" aria-label="Вращение экранного бейджика" tabIndex={0} onKeyDown={e=>{const moves={ArrowLeft:[0,-15],ArrowRight:[0,15],ArrowUp:[-15,0],ArrowDown:[15,0]};if(moves[e.key]){e.preventDefault();turn(...moves[e.key]);}}} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const {x,y}=drag.current;drag.current={x:e.clientX,y:e.clientY};turn(-(e.clientY-y)*.65,(e.clientX-x)*.65);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}><div className="ym-orbit" style={{transform:`rotateX(${angle.x}deg) rotateY(${angle.y}deg)`}}><BadgeModule finish={finish} title={title} boot={boot} onPower={power}/></div></div>
 <div className="ym-turn-buttons"><button onClick={()=>turn(0,180)}>Оборот</button><button onClick={()=>setAngle({x:-12,y:-20})}>Исходный вид</button><button onClick={power}>Включить экран</button></div>
 <section className="ym-options"><div className="ym-section-heading"><h2>Корпус</h2><span>{finish.name}</span></div><div className="ym-swatches">{finishes.map(f=><button key={f.id} onClick={()=>{setFinish(f);power();}} aria-label={'Корпус: '+f.name} aria-pressed={finish.id===f.id} style={{'--swatch':f.body}}><i/></button>)}</div><button className="ym-change" onClick={()=>{const text=rollBadgeTitle();setTitle([text.prefix,text.title].filter(Boolean).join(' '));power();}}>Другая надпись <span>↻</span></button><button className="ym-change" onClick={()=>{setTitle(longestTitle);power();}}>Проверить длинный титул <span>↗</span></button></section>
 <button className="ym-equip" onClick={()=>setWorn({finish,title})}>{worn?.title===title&&worn?.finish.id===finish.id?'Примерено к профилю':'Примерить к профилю'}</button><section className="ym-profile"><small>ТАК РЯДОМ С НИКОМ</small><div><span className="ym-avatar">Т</span><div><b>Твой профиль</b><span className="ym-inline" style={{'--ym-body':(worn?.finish||finish).body,'--ym-screen':(worn?.finish||finish).screen,'--ym-ink':(worn?.finish||finish).ink}}><i/><span>{worn?.title||title}</span></span></div></div></section><p className="ym-length-note">{title===longestTitle?'Самый длинный титул в текущем наборе · '+[...title].length+' символов':'Надпись подстраивается под экран целыми словами'}</p><p className="ym-note">Дизайн-макет. Настоящие жетоны и их владельцы не меняются.</p></main></div>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('app'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Preview/>);
