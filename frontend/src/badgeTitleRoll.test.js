import test from 'node:test';
import assert from 'node:assert/strict';
import {rollBadgeTitle,rollStudioBadge} from './badgeTitleRoll.js';
import {BADGE_STUDIES} from './badgeStudies.js';
import {COMMUNITY_BADGE_TITLES} from './communityBadgeTitles.js';
test('source split is 50/50 and community phrases stay whole',()=>{
 for(const sourceRoll of [0,.499999]){
  let calls=0;const result=rollBadgeTitle(()=>calls++===0?sourceRoll:.999999);
  assert.equal(result.prefix,'');assert.equal(result.title,COMMUNITY_BADGE_TITLES.at(-1));
 }
 for(const sourceRoll of [.5,.999999]){
  let calls=0;const result=rollBadgeTitle(()=>calls++===0?sourceRoll:0);
  assert.ok(result.prefix);assert.ok(result.title);
 }
});
test('each of the six finishes can be paired with either title source',()=>{
 for(let i=0;i<BADGE_STUDIES.length;i++)for(const source of [.1,.9]){
  const rolls=[(i+.5)/BADGE_STUDIES.length,source,0,0];let call=0;
  const badge=rollStudioBadge(()=>rolls[call++]);
  assert.equal(badge.finish,BADGE_STUDIES[i].finish);
  assert.equal(badge.frame,BADGE_STUDIES[i].frame);
  assert.ok(badge.title);
  assert.equal(Boolean(badge.prefix),source>=.5);
 }
});
