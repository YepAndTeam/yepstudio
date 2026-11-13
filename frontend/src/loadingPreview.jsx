import {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {THEMES} from './constants';
import StudioLoading from './components/StudioLoading';
import './styles.css';
function Preview(){const [theme,setTheme]=useState('dark');useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);return <main style={{maxWidth:420,margin:'24px auto',padding:16}}><h2>Загрузка YAB Studio</h2><label>Оформление <select aria-label="Тема загрузки" value={theme} onChange={e=>setTheme(e.target.value)}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><StudioLoading label="Готовим игры и рекорды…"/><section className="card"><StudioLoading compact label="Загружаем коллекцию…"/></section><p className="small muted">Локальный просмотр. В приложении индикатор исчезает сразу после ответа сервера.</p></main>;}
if(!import.meta.env.DEV)throw Error('Preview disabled');createRoot(document.getElementById('root')).render(<Preview/>);
