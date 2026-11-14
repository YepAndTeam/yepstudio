import {createRoot} from 'react-dom/client';
import {StoreProvider} from './store';
import App from './App';
import {installStudioPreview} from './studioPreviewData';
import './styles.css';
if(!import.meta.env.DEV||location.port!=='5190')throw Error('Изолированный стенд студии запускается на порту 5190');
const serverFetch=window.fetch.bind(window);
installStudioPreview('registration','dark');
const demoFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 const realTestApi=['/api/bekovich','/api/gacha','/api/discs','/api/disc-play','/api/shop','/api/garden','/api/yaabik'].some(prefix=>url.pathname===prefix||url.pathname.startsWith(prefix+'/'))||url.pathname==='/api/community/chat'||url.pathname.startsWith('/api/community/chat/')||url.pathname==='/api/me'||url.pathname==='/api/me/theme';
 return realTestApi?serverFetch(input,options):demoFetch(input,options);
};
const root=import.meta.hot?.data.root||createRoot(document.getElementById('app'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<StoreProvider><div style={{flex:'none',padding:'5px 12px',font:'10px Arial',textAlign:'center',background:'#27352e',color:'#c4d8c8'}}>ЛОКАЛЬНЫЙ СТЕНД · ТЕСТОВАЯ БАЗА · остальные разделы — демо</div><App/></StoreProvider>);
