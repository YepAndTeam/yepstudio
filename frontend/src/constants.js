export const CATS = ["Идеи", "Вопросы", "Баги", "Обсуждение"];
export const ST = { new: "Новая", planned: "В планах", in_progress: "В работе", done: "Готово" };
export const CYCLE = ["new", "planned", "in_progress", "done"];
export const STAGES = ["Идея", "Прототип", "Разработка", "Релиз"];

export function dayLabel(iso) {
  const d = new Date(iso), n = new Date();
  const sod = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(n) - sod(d)) / 864e5);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
// lock позже заполним условиями разблокировки (рекорд в игре, «Оценено», друзья)
export const THEMES = [
  { id: "dark",     name: "Тёмная",   bg: "#0B0B0C", card: "#151516", fg: "#F4F4F5" },
  { id: "light",    name: "Светлая",  bg: "#E9EAEC", card: "#FFFFFF", fg: "#0B0B0C" },
  { id: "retro",    name: "Ретро 98", bg: "#008080", card: "#C0C0C0", fg: "#000000" },
  { id: "terminal", name: "Терминал", bg: "#000000", card: "#050805", fg: "#33FF66" },
  { id: "nyan", name: "Nyan Cat", bg: "#003366", card: "#FF99FF", fg: "#2B0A3D" },
  { id: "tetris", name: "Тетрис", bg: "#0A0A1F", card: "#14143A", fg: "#F4F4FF" },
];
export const THEME_IDS = THEMES.map((t) => t.id);