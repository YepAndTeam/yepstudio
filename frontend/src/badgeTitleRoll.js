import {COMMUNITY_BADGE_TITLES} from './communityBadgeTitles.js';
import {sampleBadgeTitle} from './badgeWords.js';
import {BADGE_STUDIES} from './badgeStudies.js';

export function rollBadgeTitle(random=Math.random) {
 if(random()<0.5)return {prefix:'',title:COMMUNITY_BADGE_TITLES[Math.floor(random()*COMMUNITY_BADGE_TITLES.length)]};
 return sampleBadgeTitle(random);
}

export function rollStudioBadge(random=Math.random) {
 const finish=BADGE_STUDIES[Math.floor(random()*BADGE_STUDIES.length)];
 return {...finish,...rollBadgeTitle(random)};
}
