import test from 'node:test';
import assert from 'node:assert/strict';
import {companionGreeting,companionIdle} from './yaabikPersonality.js';
test('return greetings prioritize absence and then learned habits',()=>{assert.match(companionGreeting({away_ms:86400000,habits:{pets:20}}),/соскучился/);assert.match(companionGreeting({habits:{pets:20}}),/погладить/);assert.match(companionGreeting({habits:{songs:4}}),/танцы/);});
test('idle lines reflect favourite owned disc and repeated activities',()=>{assert.match(companionIdle({songs:10},'Portal'),/Portal/);assert.match(companionIdle({pets:10}),/поглаживания/);assert.match(companionIdle({stars:5,songs:1}),/созвездие/);});
