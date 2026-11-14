import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTheme} from './themeScope.js';
test('old mode keeps the selected theme everywhere',()=>{for(const area of ['shell','play','games','yaabik','preview'])assert.equal(resolveTheme({selected:'nyan',mode:'global',area}),'nyan');});
test('scoped mode isolates shell and can optionally include games menu',()=>{assert.equal(resolveTheme({selected:'nyan',base:'light',mode:'scoped'}),'light');for(const area of ['play','yaabik','preview'])assert.equal(resolveTheme({selected:'nyan',mode:'scoped',area}),'nyan');assert.equal(resolveTheme({selected:'nyan',mode:'scoped',area:'games'}),'dark');assert.equal(resolveTheme({selected:'nyan',mode:'scoped',area:'games',includeGamesMenu:true}),'nyan');});
