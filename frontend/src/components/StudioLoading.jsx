import StudioMark from './StudioMark';
import './StudioLoading.css';
export default function StudioLoading({label='Загрузка…',compact=false}){return <span className={`studio-loading ${compact?'studio-loading-compact':''}`} role="status" aria-busy="true" aria-label={label}><StudioMark/><span className="studio-loading-sr">{label}</span></span>;}
