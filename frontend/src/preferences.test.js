import test from 'node:test';
import assert from 'node:assert/strict';
test('existing boolean preferences migrate and game sizes validate before persistence',async()=>{
 let saved=JSON.stringify({musicEnabled:false,tetrisController:false,gameScale:500});
 globalThis.localStorage={getItem:()=>saved,setItem:(_,v)=>{saved=v;}};
 globalThis.window={addEventListener(){}};
 const {getPreferences,setPreference}=await import('./preferences.js');
 assert.equal(getPreferences().musicEnabled,false);assert.equal(getPreferences().gameScale,100);
 setPreference('gameScale',75);setPreference('gameMaxWidth',640);
 assert.equal(getPreferences().gameScale,75);assert.equal(getPreferences().gameMaxWidth,640);
 setPreference('gameScale',0);setPreference('gameMaxWidth',999);
 assert.equal(getPreferences().gameScale,75);assert.equal(JSON.parse(saved).gameMaxWidth,640);
});
