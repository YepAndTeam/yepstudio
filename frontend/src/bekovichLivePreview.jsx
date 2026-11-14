import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import BekovichLive from './screens/BekovichLive';
import './styles.css';
if(location.port!=='5190')throw Error('Этот тестовый стенд запускается отдельно на порту 5190, с изолированным API 8093');
if(!import.meta.env.DEV)throw Error('Local integration preview only');
document.documentElement.dataset.theme='dark';
export default function Preview(){
 const [screen,setScreen]=useState('trade');
 return <div style={{flex:1,minHeight:0,overflowY:'auto',overscrollBehavior:'contain',width:'100%'}}><main style={{width:'100%',maxWidth:420,margin:'0 auto',padding:'12px 12px 40px'}}><p className="small muted">Изолированный сервер · тестовые диски и баланс · рабочая база не используется</p>{screen==='menu'?<section className="card"><h2>Локальный стенд</h2><p><a href="/studio-live-preview.html">Открыть весь Яаб Студио ›</a></p><p className="small muted">Все действия здесь используют отдельную тестовую базу.</p><button className="pub" style={{width:'100%',marginTop:12}} onClick={()=>setScreen('trade')}>Открыть лавку Бековича</button><button className="pub alt" style={{width:'100%',marginTop:12}} onClick={()=>setScreen('bag')}>Открыть мои находки</button></section>:<BekovichLive key={screen} initialTab={screen==='bag'?'bag':'trade'} onBack={()=>setScreen('menu')}/>}</main></div>;
}

const root=import.meta.hot?.data.root||createRoot(document.getElementById('app'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Preview/>);
