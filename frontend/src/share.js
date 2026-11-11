import { tg, notify } from "./tg";

// Впиши свою ссылку: https://t.me/ИМЯ_БОТА/SHORTNAME (SHORTNAME из BotFather -> Mini App).
// Если short name не задан, просто https://t.me/ИМЯ_БОТА
const SITE = "https://yepstudio.onrender.com";

// ref: "t12" (тема), "n3" (новость), "game_dino" (игра).
// В startapp можно только буквы, цифры, _ и -
export const appLink = (ref) => ref.startsWith("tour_") ? `${SITE}/tournaments/${encodeURIComponent(ref.slice(5))}` : `${SITE}/s/${ref}`;
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // запасной вариант для вебвью, где clipboard API закрыт
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyLink(ref) {
  const ok = await copy(appLink(ref));
  notify(ok ? "Ссылка скопирована" : "Не удалось скопировать");
}

// Открывает выбор чата в Telegram с готовым текстом
export function shareLink(ref, text) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(appLink(ref))}&text=${encodeURIComponent(text)}`;
  try {
    tg.openTelegramLink(url);
  } catch {
    window.open(url, "_blank");
  }
}

export const shareRecord = (game, title, score) =>
  shareLink(`game_${game}`, `Мой рекорд в «${title}»: ${score}. Сможешь побить?`);