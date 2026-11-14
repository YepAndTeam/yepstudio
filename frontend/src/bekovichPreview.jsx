import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Bekovich from './screens/Bekovich';
import {BEKOVICH_DIALOGUE} from './bekovichDialogue';
import {BEKOVICH_EPIC_SEEDS} from './bekovichTrade';
import './styles.css';
if(!import.meta.env.DEV)throw Error('Local design preview only');
export default function Preview(){const [line,setLine]=useState(''),[reward,setReward]=useState('mixed'),[seed,setSeed]=useState(BEKOVICH_EPIC_SEEDS[0].id),[revision,setRevision]=useState(0);
 return <div className="bek-preview"><aside className="bek-preview-tools"><b>Бекович · локальная мастерская</b><label>Реплика<select aria-label="Тестовая реплика Бековича" value={line} onChange={e=>setLine(e.target.value)}><option value="">По ситуации</option>{BEKOVICH_DIALOGUE.map(l=><option value={l.id} key={l.id}>{l.id}. {l.text}</option>)}</select></label><label>Награда<select aria-label="Тестовая награда" value={reward} onChange={e=>{setReward(e.target.value);setRevision(v=>v+1);}}>{[['mixed','Обычный розыгрыш'],['epic_seed','Эпические семена · посылка'],['accessory','Нашивки Яабику'],['bait','Наживка'],['badge','Жетон'],['usb','USB'],['ticket','Купон'],['coins','Йеры'],['cassette','Кассета']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>{reward==='epic_seed'&&<label>Семена<select value={seed} onChange={e=>setSeed(e.target.value)}>{BEKOVICH_EPIC_SEEDS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<button onClick={()=>setRevision(v=>v+1)}>Начать заново</button><small>Только вымышленные предметы. Для игроков лавка остаётся закрытой.</small></aside><div className="bek-preview-phone" style={{width:'min(100%, 420px)'}}><Bekovich key={revision} preview demoReward={reward} demoLine={line} demoSeed={seed}/></div></div>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('app'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Preview/>);
