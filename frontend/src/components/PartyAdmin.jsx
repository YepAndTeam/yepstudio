import {useEffect,useState} from 'react';
import {api} from '../api';
import './PartyAdmin.css';
export default function PartyAdmin({request=api}){
 const [values,setValues]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{let active=true;request('/party/settings').then(data=>{if(active)setValues(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[request]);
 const change=(kind,key,value)=>{setSaved(false);setValues(v=>({...v,[kind]:{...v[kind],[key]:value}}));};
 const submit=async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);try{const payload=Object.fromEntries(Object.entries(values).map(([kind,v])=>[kind,Object.fromEntries(Object.entries(v).map(([k,n])=>[k,Number(n)]))]));setValues(await request('/party/settings','PUT',payload));setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="card party-admin"><h3>Мафия и Бункер · таймеры</h3><p className="small muted">Время в секундах, от 15 до 1800. Сохраняется для новых партий. Начатые матчи продолжаются со своими таймерами.</p>{error&&<p role="alert">{error}</p>}{values?<form onSubmit={submit}>{[['mafia','Мафия'],['bunker','Бункер']].map(([kind,title])=><fieldset key={kind} disabled={busy}><legend>{title}</legend>{[['discussion_seconds','Обсуждение'],['vote_seconds','Голосование']].map(([key,label])=><label key={key}><span>{label}</span><input aria-label={title+' · '+label} type="number" inputMode="numeric" min="15" max="1800" step="1" required value={values[kind][key]} onChange={e=>change(kind,key,e.target.value)}/><small>сек.</small></label>)}</fieldset>)}<button className="pub" disabled={busy}>{busy?'Сохраняем…':'Сохранить таймеры'}</button>{saved&&<p role="status">Сохранено. Новые партии получат эти таймеры.</p>}</form>:!error&&<p>Загружаем таймеры…</p>}</section>;
}
