export const tg = window.Telegram?.WebApp;

export const haptic = () => { try { tg.HapticFeedback.impactOccurred("light"); } catch {} };
export const notify = (msg) => { try { tg.showAlert(msg); } catch { alert(msg); } };
export const confirmDialog = (msg, onOk) => {
  try { tg.showConfirm(msg, (ok) => ok && onOk()); }
  catch { if (confirm(msg)) onOk(); }
};
