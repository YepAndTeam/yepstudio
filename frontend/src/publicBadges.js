import {api} from './api';
import {createPublicBadgeCache} from './publicBadgeCache';
export const publicBadgeCache=createPublicBadgeCache(ids=>api('/bekovich/badges/lookup','POST',{ids}));
