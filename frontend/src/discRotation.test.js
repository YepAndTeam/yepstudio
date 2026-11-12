import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDiscAngle,discBackVisible,secretDiscOpacity} from './discRotation.js';
test('rarity becomes visible only when the back faces the viewer',()=>{
 for(const angle of [0,45,90,270,360])assert.equal(discBackVisible(angle),false);
 for(const angle of [120,152,180,208,240])assert.equal(discBackVisible(angle),true);
});
test('SECRET appears only at grazing angles on the back, with identical full turns',()=>{
 for(const angle of [0,90,180,270,360])assert.equal(secretDiscOpacity(angle),0);
 assert.equal(secretDiscOpacity(152),1);assert.equal(secretDiscOpacity(208),1);
 assert.equal(secretDiscOpacity(-152),1);assert.equal(secretDiscOpacity(512),1);
 assert.equal(normalizeDiscAngle(-180),180);
});
