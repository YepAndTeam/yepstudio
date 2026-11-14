import catalog from '../../bekovich_catalog.json' with {type:'json'};
export const COMMUNITY_BADGE_TITLES=catalog.community_titles;

export function nextCommunityBadgeTitle(current) {
 const index = COMMUNITY_BADGE_TITLES.indexOf(current);
 return {prefix:'', title:COMMUNITY_BADGE_TITLES[(index+1)%COMMUNITY_BADGE_TITLES.length]};
}
