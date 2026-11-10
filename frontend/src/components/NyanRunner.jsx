import { useEffect, useRef } from "react";
import { drawNyanCat, drawNyanTrail } from "../nyan";

export default function NyanRunner() {
  const cv = useRef(null);
  useEffect(() => {
    const ctx = cv.current.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let f = 0;
    const id = setInterval(() => {
      ctx.clearRect(0, 0, 62, 26);
      drawNyanTrail(ctx, 34, 1, f);
      drawNyanCat(ctx, 34, 1, f, true);
      f++;
    }, 120);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="runner">
      <canvas ref={cv} width="62" height="26" />
    </div>
  );
}