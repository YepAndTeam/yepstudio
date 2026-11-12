import { useId, useMemo } from "react";

// Пиксельная монета с руной Йера. Сетка 36x36, 3D-толщина набирается слоями.
const DISC = "M12 1h12v1h-12zM10 2h16v1h-16zM8 3h20v1h-20zM7 4h22v1h-22zM6 5h24v1h-24zM5 6h26v1h-26zM4 7h28v1h-28zM3 8h30v1h-30zM3 9h30v1h-30zM2 10h32v1h-32zM2 11h32v1h-32zM1 12h34v1h-34zM1 13h34v1h-34zM1 14h34v1h-34zM1 15h34v1h-34zM1 16h34v1h-34zM1 17h34v1h-34zM1 18h34v1h-34zM1 19h34v1h-34zM1 20h34v1h-34zM1 21h34v1h-34zM1 22h34v1h-34zM1 23h34v1h-34zM2 24h32v1h-32zM2 25h32v1h-32zM3 26h30v1h-30zM3 27h30v1h-30zM4 28h28v1h-28zM5 29h26v1h-26zM6 30h24v1h-24zM7 31h22v1h-22zM8 32h20v1h-20zM10 33h16v1h-16zM12 34h12v1h-12z";
const FIELD = "M14 3h8v1h-8zM11 4h14v1h-14zM10 5h16v1h-16zM8 6h20v1h-20zM7 7h22v1h-22zM6 8h24v1h-24zM6 9h24v1h-24zM5 10h26v1h-26zM4 11h28v1h-28zM4 12h28v1h-28zM4 13h28v1h-28zM3 14h30v1h-30zM3 15h30v1h-30zM3 16h30v1h-30zM3 17h30v1h-30zM3 18h30v1h-30zM3 19h30v1h-30zM3 20h30v1h-30zM3 21h30v1h-30zM4 22h28v1h-28zM4 23h28v1h-28zM4 24h28v1h-28zM5 25h26v1h-26zM6 26h24v1h-24zM6 27h24v1h-24zM7 28h22v1h-22zM8 29h20v1h-20zM10 30h16v1h-16zM11 31h14v1h-14zM14 32h8v1h-8z";
const RUNE = "M21 9h2v1h-2zM21 10h3v1h-3zM11 11h2v1h-2zM20 11h5v1h-5zM10 12h4v1h-4zM20 12h2v1h-2zM23 12h3v1h-3zM9 13h2v1h-2zM12 13h3v1h-3zM19 13h2v1h-2zM24 13h3v1h-3zM8 14h2v1h-2zM13 14h3v1h-3zM19 14h2v1h-2zM25 14h3v1h-3zM7 15h2v1h-2zM14 15h2v1h-2zM18 15h2v1h-2zM26 15h3v1h-3zM6 16h2v1h-2zM15 16h1v1h-1zM17 16h3v1h-3zM27 16h3v1h-3zM5 17h2v1h-2zM17 17h2v1h-2zM28 17h3v1h-3zM5 18h3v1h-3zM16 18h2v1h-2zM28 18h3v1h-3zM6 19h3v1h-3zM16 19h2v1h-2zM19 19h2v1h-2zM27 19h3v1h-3zM7 20h3v1h-3zM15 20h2v1h-2zM19 20h3v1h-3zM26 20h3v1h-3zM8 21h3v1h-3zM15 21h2v1h-2zM20 21h3v1h-3zM25 21h3v1h-3zM9 22h3v1h-3zM14 22h2v1h-2zM21 22h6v1h-6zM10 23h6v1h-6zM22 23h4v1h-4zM11 24h4v1h-4zM23 24h2v1h-2zM12 25h2v1h-2zM13 26h1v1h-1z";
const SHADOW = "M22 12h1v1h-1zM11 13h1v1h-1zM21 13h2v1h-2zM10 14h2v1h-2zM21 14h1v1h-1zM9 15h2v1h-2zM16 15h1v1h-1zM20 15h2v1h-2zM8 16h2v1h-2zM16 16h1v1h-1zM20 16h1v1h-1zM7 17h2v1h-2zM16 17h1v1h-1zM19 17h2v1h-2zM18 18h2v1h-2zM31 18h1v1h-1zM18 19h1v1h-1zM30 19h2v1h-2zM17 20h2v1h-2zM29 20h2v1h-2zM17 21h1v1h-1zM28 21h2v1h-2zM16 22h2v1h-2zM27 22h2v1h-2zM16 23h1v1h-1zM26 23h2v1h-2zM15 24h2v1h-2zM25 24h2v1h-2zM14 25h2v1h-2zM24 25h2v1h-2zM14 26h1v1h-1zM14 27h1v1h-1z";
const RIM_L = "M12 1h12v1h-12zM10 2h16v1h-16zM8 3h6v1h-6zM22 3h6v1h-6zM7 4h4v1h-4zM25 4h3v1h-3zM6 5h4v1h-4zM26 5h1v1h-1zM5 6h3v1h-3zM4 7h3v1h-3zM3 8h3v1h-3zM3 9h3v1h-3zM2 10h3v1h-3zM2 11h2v1h-2zM1 12h3v1h-3zM1 13h3v1h-3zM1 14h2v1h-2zM1 15h2v1h-2zM1 16h2v1h-2zM1 17h2v1h-2zM1 18h2v1h-2zM1 19h2v1h-2zM1 20h2v1h-2zM1 21h2v1h-2zM1 22h3v1h-3zM1 23h3v1h-3zM2 24h2v1h-2zM2 25h3v1h-3zM3 26h3v1h-3zM3 27h2v1h-2z";
const RIM_D = "M31 8h2v1h-2zM30 9h3v1h-3zM31 10h3v1h-3zM32 11h2v1h-2zM32 12h3v1h-3zM32 13h3v1h-3zM33 14h2v1h-2zM33 15h2v1h-2zM33 16h2v1h-2zM33 17h2v1h-2zM33 18h2v1h-2zM33 19h2v1h-2zM33 20h2v1h-2zM33 21h2v1h-2zM32 22h3v1h-3zM32 23h3v1h-3zM32 24h2v1h-2zM31 25h3v1h-3zM30 26h3v1h-3zM30 27h3v1h-3zM29 28h3v1h-3zM28 29h3v1h-3zM9 30h1v1h-1zM26 30h4v1h-4zM8 31h3v1h-3zM25 31h4v1h-4zM8 32h6v1h-6zM22 32h6v1h-6zM10 33h16v1h-16zM12 34h12v1h-12z";

const Face = ({ style, className }) => {
 const shine=useId().replace(/:/g,'');
 return (
  <svg
    className={className}
    style={style}
    viewBox="0 0 36 36"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    <defs><linearGradient id={shine+'-shine'} x1="0" y1="1" x2="1" y2="0"><stop offset=".25" stopColor="#fff" stopOpacity="0"/><stop offset=".48" stopColor="#fff" stopOpacity=".7"/><stop offset=".65" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
    <path d={DISC} fill="currentColor" />
    <path d={RIM_L} fill="#fff" opacity="0.4" />
    <path d={RIM_D} fill="#000" opacity="0.25" />
    <path d={FIELD} fill="#000" opacity="0.5" />
    <path d={SHADOW} fill="#000" opacity="0.55" />
    <path d={RUNE} fill="currentColor" />
    <path className="jc-reflection" d={DISC} fill={`url(#${shine}-shine)`}/>
  </svg>
);
};

const Edge = ({ style }) => (
  <svg className="jc-layer" style={style} viewBox="0 0 36 36" shapeRendering="crispEdges" aria-hidden="true">
    <path d={DISC} fill="currentColor" />
    <path d={DISC} fill="#000" opacity="0.45" />
  </svg>
);

export const JeraIcon = ({ size = 18, spin = true }) => {
  const half = Math.max(1.25, size * 0.095);        // половина толщины монеты, px
  const n = 5;                                  // слоёв на каждую сторону
  const edges = useMemo(
    () => Array.from({ length: 2 * n - 1 }, (_, i) => ((i - (n - 1)) / n) * half),
    [half]
  );
  return (
    <span
      className={`jera-coin ${spin ? "spin" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Йера"
    >
      <span className="jc-body">
        {edges.map((z, i) => (
          <Edge key={i} style={{ transform: `translateZ(${z}px)` }} />
        ))}
        <Face className="jc-layer" style={{ transform: `translateZ(${half}px)` }} />
        <Face className="jc-layer" style={{ transform: `rotateY(180deg) translateZ(${half}px)` }} />
      </span>
    </span>
  );
};