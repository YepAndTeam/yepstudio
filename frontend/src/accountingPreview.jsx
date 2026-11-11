import { createRoot } from "react-dom/client";
import Accounting from "./components/Accounting";
if(!import.meta.env.DEV)throw Error('Local accounting preview only');
createRoot(document.getElementById('app')).render(<Accounting local/>);
