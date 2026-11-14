import {useEffect,useState} from 'react';
import {api} from '../api';
import {useStore} from '../store';
import StudioLoading from '../components/StudioLoading';
import {BekovichWorkshop} from './Bekovich';

export default function BekovichLive({onBack,initialTab='trade'}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const store=useStore();
 useEffect(()=>{let alive=true;api('/bekovich').then(value=>{if(alive){setData(value);setError('');}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[revision]);
 if(!data)return <><button className="back" onClick={onBack}>‹ Назад</button>{error?<section className="card"><p role="alert">{error}</p><button className="pub" onClick={()=>{setError('');setRevision(n=>n+1);}}>Повторить загрузку</button></section>:<StudioLoading compact label="Бекович открывает лавку…"/>}</>;
 const remote={more:before=>api('/bekovich/items?before='+encodeURIComponent(before)),quote:discs=>api('/bekovich/quote','POST',{discs}),accept:body=>api('/bekovich/accept','POST',body),action:(id,action)=>api('/bekovich/items/'+id+'/'+action,'POST'),sync:value=>store?.syncEconomy(value)};
 return <BekovichWorkshop initialData={data} remote={remote} onBack={onBack} initialTab={initialTab}/>;
}
