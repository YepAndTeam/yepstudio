import {api} from './api';
import {createDiscBridge} from './discPlayCore';
const bridge=createDiscBridge(api);
export const {attachDiscSession,discTempo,gameApi}=bridge;
