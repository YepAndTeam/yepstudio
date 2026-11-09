import { tg } from "./tg";

// В Telegram берём настоящий initData, в браузере при `npm run dev` шлём "dev"
// (бэкенд примет его только если задан DEV_USER_ID, см. патч auth.py)
const initData = () => tg?.initData || (import.meta.env.DEV ? "dev" : "");

export async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "X-Init-Data": initData(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let detail = "";
    try { detail = JSON.stringify((await r.json()).detail || ""); } catch {}
    throw new Error(r.status + " " + detail);
  }
  return r.json();
}
