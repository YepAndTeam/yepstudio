import { useEffect, useRef } from "react";
import { stickVector } from "../arcadeInput";

export default function ArcadeStick({ enabled, onActivate, onChange }) {
  const base=useRef(null),knob=useRef(null),pointer=useRef(null),center=useRef(null);
  const callbacks=useRef({onActivate,onChange});
  useEffect(()=>{callbacks.current={onActivate,onChange};},[onActivate,onChange]);
  const reset=()=>{
    const id=pointer.current;pointer.current=null;
    if(id!==null&&base.current?.hasPointerCapture(id))base.current.releasePointerCapture(id);
    if(knob.current)knob.current.style.transform="translate(0px,0px)";
    if(base.current)base.current.dataset.held="0";
    callbacks.current.onChange({x:0,y:0});
  };
  useEffect(()=>{
    const clear=()=>reset();
    window.addEventListener("blur",clear);
    document.addEventListener("visibilitychange",clear);
    return ()=>{window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",clear);callbacks.current.onChange({x:0,y:0});};
  },[]);
  useEffect(()=>{if(!enabled)reset();},[enabled]);
  const move=e=>{
    if(e.pointerId!==pointer.current)return;
    e.preventDefault();
    const v=stickVector(e.clientX-center.current.x,e.clientY-center.current.y);
    knob.current.style.transform="translate("+v.px+"px,"+v.py+"px)";
    callbacks.current.onChange({x:v.x,y:v.y});
  };
  return <div className="arcade-stick" ref={base} role="group" aria-label="Джойстик: вперёд, назад и поворот" data-held="0"
    onPointerDown={e=>{
      if(pointer.current!==null)return;
      e.preventDefault();callbacks.current.onActivate();
      const r=base.current.getBoundingClientRect();center.current={x:r.left+r.width/2,y:r.top+r.height/2};
      pointer.current=e.pointerId;base.current.setPointerCapture(e.pointerId);base.current.dataset.held="1";move(e);
    }} onPointerMove={move}
    onPointerUp={e=>{if(e.pointerId===pointer.current)reset();}}
    onPointerCancel={e=>{if(e.pointerId===pointer.current)reset();}}
    onLostPointerCapture={e=>{if(e.pointerId===pointer.current)reset();}}>
    <span className="arcade-arrows" aria-hidden="true">✛</span>
    <span className="arcade-gate" aria-hidden="true" />
    <span className="arcade-knob" ref={knob} aria-hidden="true"><i /><b /></span>
  </div>;
}
