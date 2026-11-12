import {useEffect,useState} from 'react';
import {createGameClock,formatGameTime} from '../gameClock.js';
import {discTempo} from '../discPlaySession';
export default function GameTimers({stateRef}){
 const [display,setDisplay]=useState({real:'00:00',game:'00:00',speed:1});
 useEffect(()=>{
  const sample=createGameClock();
  const tick=()=>{const clock=sample(stateRef.current,performance.now(),!document.hidden);const next={real:formatGameTime(clock.real),game:formatGameTime(clock.game),speed:Number(discTempo().toFixed(2))};setDisplay(old=>old.real===next.real&&old.game===next.game&&old.speed===next.speed?old:next);};
  tick();const timer=setInterval(tick,100);document.addEventListener('visibilitychange',tick);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
 },[stateRef]);
 return <div className="game-timers" role="group" aria-label="Время текущей игры"><div><small>Реальное время</small><b>{display.real}</b></div><span className="game-timers-speed">×{display.speed}</span><div><small>Время в игре</small><b>{display.game}</b></div></div>;
}
