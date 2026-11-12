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

test('Tetris order is a complete permutation and gap stays within a mobile-safe range',async()=>{
 const {getPreferences,setPreference}=await import('./preferences.js');
 setPreference('tetrisOrder','down,left,right,rotate');setPreference('tetrisGap',24);
 assert.equal(getPreferences().tetrisOrder,'down,left,right,rotate');assert.equal(getPreferences().tetrisGap,24);
 for(const bad of ['left,left,right,down','left,right,down','left,rotate,right,nope',null])setPreference('tetrisOrder',bad);
 for(const bad of [-1,25,'8',3.5])setPreference('tetrisGap',bad);
 assert.equal(getPreferences().tetrisOrder,'down,left,right,rotate');assert.equal(getPreferences().tetrisGap,24);
 setPreference('tetrisOrder','left,rotate,right,down');setPreference('tetrisGap',8);
 assert.equal(getPreferences().tetrisGap,8);
});
