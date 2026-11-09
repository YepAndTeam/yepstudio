import { ST } from "../constants";
import { useStore } from "../store";

export const Dot = ({ status }) => <span className={`dot ${status || ""}`} />;

export const Stat = ({ status }) =>
  status && ST[status] ? <span className="st"><Dot status={status} />{ST[status]}</span> : null;

export const Chip = ({ label, on, onClick }) => (
  <button type="button" className={`chip ${on ? "on" : ""}`} onClick={onClick}><span>{label}</span></button>
);

export const Skeleton = () => <><div className="skel" /><div className="skel" /><div className="skel" /></>;

export function ErrorCard() {
  const { error, boot } = useStore();
  const hint = /401/.test(error || "") ? "Открой приложение из Telegram." : "Не удалось загрузить данные.";
  return <div className="empty">{hint}<br /><button type="button" onClick={boot}>Повторить</button></div>;
}

export const Loading = () => {
  const { error } = useStore();
  return error ? <ErrorCard /> : <Skeleton />;
};
