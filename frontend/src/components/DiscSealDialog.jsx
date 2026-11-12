import {useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {DiscFace} from './DiscInspector';
export default function DiscSealDialog({instance,onClose,onSealed}){
 const dialog=useRef(null),working=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 const seal=async()=>{if(working.current)return;working.current=true;setBusy(true);setError('');try{const value=await api('/discs/shelves/seal','POST',{instance_id:instance.id});onSealed(value);}catch(e){setError(e.message);}finally{working.current=false;setBusy(false);}};
 return <dialog ref={dialog} className="disc-seal-dialog" aria-labelledby="disc-seal-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><div className="disc-seal-content"><small>YAB / PERMANENT ARCHIVE</small><h3 id="disc-seal-title">Запечатать {instance.item.title}?</h3><div className="disc-seal-preview"><DiscFace item={instance.item} cracked={instance.cracked}/></div><code>#{instance.id.slice(0,8).toUpperCase()}</code><p>Диск навсегда займёт ячейку своей редкости. Забрать его обратно, активировать или обменять будет невозможно.</p><p className="small muted">Полный набор всех редкостей принесёт 1000 Йер. Дубликат в уже заполненную ячейку не принимается.</p>{error&&<p role="alert">{error}</p>}<div className="disc-seal-actions"><button className="pub alt" disabled={busy} onClick={onClose}>Оставить в инвентаре</button><button className="pub" disabled={busy} onClick={seal}>{busy?'Запечатываем…':'Запечатать навсегда'}</button></div></div></dialog>;
}
