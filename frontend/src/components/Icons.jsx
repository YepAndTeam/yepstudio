const p = (size, children, cls) => (
  <svg
    className={cls}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
export const Chevron = () => p(18, <path d="M9 5l7 7-7 7" />);
export const BackIcon = () => p(20, <path d="M15 5l-7 7 7 7" />);
export const Plus = () => p(18, <path d="M12 5v14M5 12h14" />);
export const Dots = () => p(20, <><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></>);
export const Pin = () => (
  <svg className="pin" width="16" height="16" viewBox="0 0 24 24" role="img" aria-label="Закреплено">
    <path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 13v7" />
  </svg>
);
export const NavNews = () => p(22, <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 16.5h3.5" /></>);
export const NavForum = () => p(22, <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4 3.5V17H6a2 2 0 0 1-2-2z" />);
export const NavProfile = () => p(22, <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>);
export const Bell = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const NavGame = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="7" width="18" height="11" rx="4" />
    <path d="M8 10v5M5.5 12.5h5" />
    <circle cx="15.5" cy="11.5" r=".8" />
    <circle cx="18" cy="13.5" r=".8" />
  </svg>
);

export const Sound = () => p(22, <>
  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
  <path d="M15.5 9a4 4 0 0 1 0 6" />
  <path d="M18 6.5a8 8 0 0 1 0 11" />
</>);

export const SoundOff = () => p(22, <>
  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
  <path d="M16 9.5l5 5M21 9.5l-5 5" />
</>);
export const LinkIcon = () => p(20, <>
  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
  <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
</>);

/* ===== Иконки экранных кнопок (Pad). Тот же штрих 1.8, скруглённые концы ===== */
export const PadLeft = () => p(26, <path d="M19 12H6M11.5 6L5.5 12l6 6" />);
export const PadRight = () => p(26, <path d="M5 12h13M12.5 6l6 6-6 6" />);
export const PadUp = () => p(26, <path d="M12 19V6M6 11.5l6-6 6 6" />);
export const PadDown = () => p(26, <path d="M12 5v13M6 12.5l6 6 6-6" />);
// двойной шеврон вниз: «сбросить» (тетрис)
export const PadDrop = () => p(26, <path d="M6 6.5l6 6 6-6M6 12.5l6 6 6-6" />);
// стрелка вверх над чертой: прыжок
export const PadJump = () => p(26, <path d="M12 20V9.5M7 13.5l5-5 5 5M7.5 4.5h9" />);
// круговая стрелка: поворот
export const PadRotate = () => p(26, <>
  <path d="M18.5 12a6.5 6.5 0 1 1-2-4.7" />
  <path d="M18.5 4.5v3.8h-3.8" />
</>);
// прицел: огонь
export const PadFire = () => p(30, <>
  <circle cx="12" cy="12" r="5.5" />
  <circle cx="12" cy="12" r=".9" />
  <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
</>);
export const KeyIcon = () => p(20, <>
  <circle cx="8" cy="15" r="4" />
  <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
</>);

/* ===== Йера (валюта) =====
   Угловая руна из двух зеркальных крюков, соединённых диагональю.
   Рисуется острыми углами (miter), цвет берёт из currentColor.
   spin=true включает вращение вокруг вертикальной оси (стили .jera-spin в CSS). */
const FACE = "M11 0h3v1h-3zM10 1h5v1h-5zM9 2h7v1h-7zM8 3h4v1h-4zM13 3h4v1h-4zM7 4h4v1h-4zM14 4h4v1h-4zM6 5h4v1h-4zM15 5h4v1h-4zM5 6h4v1h-4zM16 6h4v1h-4zM4 7h4v1h-4zM17 7h4v1h-4zM3 8h4v1h-4zM18 8h4v1h-4zM2 9h4v1h-4zM19 9h4v1h-4zM1 10h4v1h-4zM19 10h4v1h-4zM0 11h4v1h-4zM18 11h4v1h-4zM0 12h4v1h-4zM17 12h4v1h-4zM0 13h6v1h-6zM16 13h4v1h-4zM2 14h6v1h-6zM15 14h4v1h-4zM4 15h6v1h-6zM14 15h4v1h-4zM5 16h6v1h-6zM14 16h3v1h-3zM7 17h6v1h-6zM9 18h6v1h-6zM11 19h6v1h-6zM12 20h6v1h-6zM8 21h3v1h-3zM14 21h6v1h-6zM7 22h4v1h-4zM16 22h6v1h-6zM6 23h4v1h-4zM18 23h6v1h-6zM5 24h4v1h-4zM19 24h6v1h-6zM4 25h4v1h-4zM21 25h4v1h-4zM3 26h4v1h-4zM20 26h4v1h-4zM2 27h4v1h-4zM19 27h4v1h-4zM2 28h5v1h-5zM18 28h4v1h-4zM3 29h5v1h-5zM17 29h4v1h-4zM4 30h5v1h-5zM16 30h4v1h-4zM5 31h5v1h-5zM15 31h4v1h-4zM6 32h5v1h-5zM14 32h4v1h-4zM7 33h5v1h-5zM13 33h4v1h-4zM8 34h8v1h-8zM9 35h6v1h-6zM10 36h4v1h-4zM11 37h2v1h-2z";
const LIGHT = "M11 0h3v1h-3zM10 1h1v1h-1zM14 1h1v1h-1zM9 2h1v1h-1zM15 2h1v1h-1zM8 3h1v1h-1zM13 3h1v1h-1zM16 3h1v1h-1zM7 4h1v1h-1zM14 4h1v1h-1zM17 4h1v1h-1zM6 5h1v1h-1zM15 5h1v1h-1zM18 5h1v1h-1zM5 6h1v1h-1zM16 6h1v1h-1zM19 6h1v1h-1zM4 7h1v1h-1zM17 7h1v1h-1zM20 7h1v1h-1zM3 8h1v1h-1zM18 8h1v1h-1zM21 8h1v1h-1zM2 9h1v1h-1zM19 9h1v1h-1zM22 9h1v1h-1zM1 10h1v1h-1zM19 10h1v1h-1zM0 11h1v1h-1zM18 11h1v1h-1zM0 12h1v1h-1zM17 12h1v1h-1zM0 13h1v1h-1zM4 13h2v1h-2zM16 13h1v1h-1zM2 14h1v1h-1zM6 14h2v1h-2zM15 14h1v1h-1zM4 15h1v1h-1zM8 15h2v1h-2zM14 15h1v1h-1zM5 16h1v1h-1zM10 16h1v1h-1zM14 16h1v1h-1zM7 17h1v1h-1zM11 17h2v1h-2zM9 18h1v1h-1zM13 18h2v1h-2zM11 19h1v1h-1zM15 19h2v1h-2zM12 20h1v1h-1zM17 20h1v1h-1zM8 21h3v1h-3zM14 21h1v1h-1zM18 21h2v1h-2zM7 22h1v1h-1zM16 22h1v1h-1zM20 22h2v1h-2zM6 23h1v1h-1zM18 23h1v1h-1zM22 23h2v1h-2zM5 24h1v1h-1zM19 24h1v1h-1zM24 24h1v1h-1zM4 25h1v1h-1zM21 25h1v1h-1zM3 26h1v1h-1zM20 26h1v1h-1zM2 27h1v1h-1zM19 27h1v1h-1zM2 28h1v1h-1zM6 28h1v1h-1zM18 28h1v1h-1zM3 29h1v1h-1zM7 29h1v1h-1zM17 29h1v1h-1zM4 30h1v1h-1zM8 30h1v1h-1zM16 30h1v1h-1zM5 31h1v1h-1zM9 31h1v1h-1zM15 31h1v1h-1zM6 32h1v1h-1zM10 32h1v1h-1zM14 32h1v1h-1zM7 33h1v1h-1zM11 33h1v1h-1zM13 33h1v1h-1zM8 34h1v1h-1zM12 34h1v1h-1zM9 35h1v1h-1zM10 36h1v1h-1zM11 37h1v1h-1z";
const DARK = "M12 2h1v1h-1zM11 3h1v1h-1zM10 4h1v1h-1zM9 5h1v1h-1zM8 6h1v1h-1zM7 7h1v1h-1zM6 8h1v1h-1zM5 9h1v1h-1zM4 10h1v1h-1zM22 10h1v1h-1zM3 11h1v1h-1zM21 11h1v1h-1zM3 12h1v1h-1zM20 12h1v1h-1zM1 13h1v1h-1zM19 13h1v1h-1zM3 14h1v1h-1zM18 14h1v1h-1zM17 15h1v1h-1zM6 16h1v1h-1zM15 16h2v1h-2zM8 17h1v1h-1zM10 18h1v1h-1zM13 20h1v1h-1zM15 21h1v1h-1zM10 22h1v1h-1zM17 22h1v1h-1zM9 23h1v1h-1zM8 24h1v1h-1zM20 24h1v1h-1zM7 25h1v1h-1zM24 25h1v1h-1zM6 26h1v1h-1zM23 26h1v1h-1zM5 27h1v1h-1zM22 27h1v1h-1zM21 28h1v1h-1zM20 29h1v1h-1zM19 30h1v1h-1zM18 31h1v1h-1zM17 32h1v1h-1zM16 33h1v1h-1zM15 34h1v1h-1zM14 35h1v1h-1zM13 36h1v1h-1zM12 37h1v1h-1z";
const SIDE = "M12 1h3v1h-3zM11 2h5v1h-5zM10 3h7v1h-7zM9 4h4v1h-4zM14 4h4v1h-4zM8 5h4v1h-4zM15 5h4v1h-4zM7 6h4v1h-4zM16 6h4v1h-4zM6 7h4v1h-4zM17 7h4v1h-4zM5 8h4v1h-4zM18 8h4v1h-4zM4 9h4v1h-4zM19 9h4v1h-4zM3 10h4v1h-4zM20 10h4v1h-4zM2 11h4v1h-4zM20 11h4v1h-4zM1 12h4v1h-4zM19 12h4v1h-4zM1 13h4v1h-4zM18 13h4v1h-4zM1 14h6v1h-6zM17 14h4v1h-4zM3 15h6v1h-6zM16 15h4v1h-4zM5 16h6v1h-6zM15 16h4v1h-4zM6 17h6v1h-6zM15 17h3v1h-3zM8 18h6v1h-6zM10 19h6v1h-6zM12 20h6v1h-6zM13 21h6v1h-6zM9 22h3v1h-3zM15 22h6v1h-6zM8 23h4v1h-4zM17 23h6v1h-6zM7 24h4v1h-4zM19 24h6v1h-6zM6 25h4v1h-4zM20 25h6v1h-6zM5 26h4v1h-4zM22 26h4v1h-4zM4 27h4v1h-4zM21 27h4v1h-4zM3 28h4v1h-4zM20 28h4v1h-4zM3 29h5v1h-5zM19 29h4v1h-4zM4 30h5v1h-5zM18 30h4v1h-4zM5 31h5v1h-5zM17 31h4v1h-4zM6 32h5v1h-5zM16 32h4v1h-4zM7 33h5v1h-5zM15 33h4v1h-4zM8 34h5v1h-5zM14 34h4v1h-4zM9 35h8v1h-8zM10 36h6v1h-6zM11 37h4v1h-4zM12 38h2v1h-2z";

export const JeraIcon = ({ size = 18, spin = true }) => (
  <svg
    className={`jera ${spin ? "jera-spin" : ""}`}
    width={(size * 26) / 39}
    height={size}
    viewBox="0 0 26 39"
    shapeRendering="crispEdges"
    role="img"
    aria-label="Йера"
  >
    <path d={SIDE} fill="currentColor" />
    <path d={SIDE} fill="#000" opacity="0.55" />
    <path d={FACE} fill="currentColor" />
    <path d={DARK} fill="#000" opacity="0.2" />
    <path d={LIGHT} fill="#fff" opacity="0.35" />
  </svg>
);