import {BADGE_STUDIES} from '../badgeStudies';
import {BadgeModule,badgeFinish} from './ScreenBadge';
import './StudioBadge.css';
export default function StudioBadge({badge=BADGE_STUDIES[0],compact=false,iconOnly=false,animated=false,inline=false}){
 const finish=badgeFinish(badge),title=[badge.prefix,badge.title].filter(Boolean).join(' ');
 if(inline)return <span className="studio-screen-inline" style={{background:finish.screen,color:finish.ink,borderColor:finish.body}}><i/>{title}</span>;
 if(iconOnly)return <svg className="studio-badge-stamp" viewBox="0 0 100 65" aria-hidden="true"><rect x="3" y="5" width="94" height="54" rx="7" fill={finish.body} stroke={finish.edge} strokeWidth="3"/><rect x="12" y="16" width="76" height="30" rx="4" fill={finish.screen}/><path d="M21 27h58M21 35h40" stroke={finish.ink} strokeWidth="3"/><circle cx="86" cy="11" r="2" fill={finish.ink}/></svg>;
 return <span className={'studio-screen-badge'+(compact?' screen-compact':'')+(animated?' screen-arriving':'')} role="img" aria-label={title+', бейджик '+badge.serial}><BadgeModule finish={finish} title={title} serial={badge.serial}/></span>;
}
