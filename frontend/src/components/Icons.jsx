
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