import {createRoot} from 'react-dom/client';
import Bekovich from './screens/Bekovich';
import './styles.css';
if(!import.meta.env.DEV)throw Error('Local design preview only');
createRoot(document.getElementById('app')).render(<Bekovich/>);
