import { useEffect, useRef } from "react";
import { drawPoop } from "../poop";
export default function PoopIcon({ size = 28 }) {
  const canvas = useRef(null);
  useEffect(() => {
    const g = canvas.current.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0,0,40,44);
    drawPoop(g,0,0,40,44);
  }, []);
  return <canvas ref={canvas} width={40} height={44} className="poop-icon" aria-hidden="true" style={{ width:size, height:size*1.1 }} />;
}
