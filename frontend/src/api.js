import { tg } from "./tg";

// В Telegram берём настоящий initData, в браузере при `npm run dev` шлём "dev"
// (бэкенд примет его только если задан DEV_USER_ID, см. патч auth.py)
const initData = () => tg?.initData || (import.meta.env.DEV ? "dev" : "");

const gameRuns = new Map();

async function request(path, method = "GET", body) {
  const controller = method === "GET" && path.startsWith("/races") ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
  const r = await fetch("/api" + path, {
    method,
    headers: { "X-Init-Data": initData(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller?.signal,
  });
  if (!r.ok) {
    let detail = "";
    try { detail = JSON.stringify((await r.json()).detail || ""); } catch {}
    throw new Error(r.status + " " + detail);
  }
  return await r.json();
  } catch (error) {
    if (controller?.signal.aborted) throw new Error("Сервер не ответил за 15 секунд. Повторяем загрузку скачек…");
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Keep each score tied to its server-issued run, including slow start requests.
export async function api(path, method = "GET", body) {
  if (path === "/game/start" && method === "POST") {
    const start = request(path, method, body);
    gameRuns.set(body?.game || "dino", start);
    return start;
  }
  if (path === "/game/score" && method === "POST") {
    const pending = gameRuns.get(body?.game || "dino");
    const run = pending ? await pending : null;
    return request(path, method, { ...body, run_id: run?.run_id });
  }
  return request(path, method, body);
}
