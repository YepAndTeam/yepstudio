import { useState } from "react";
import { CATS } from "../constants";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { Chip } from "./Common";

export default function NewTopicSheet({ onClose, onCreated }) {
  const { createTopic } = useStore();
  const [cat, setCat] = useState("Идеи");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function publish() {
    const t = title.trim();
    if (t.length < 3) return notify("Название должно быть хотя бы из 3 символов.");
    if (busy) return;
    setBusy(true);
    try {
      await createTopic({ category: cat, title: t, text: text.trim() });
      haptic();
      onCreated();
    } catch (e) {
      notify("Не удалось опубликовать: " + e.message);
      setBusy(false);
    }
  }

  return (
    <div className="sheet-wrap">
      <button type="button" className="scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Новая тема">
        <h3>Новая тема</h3>
        <div className="chips scroll">
          {CATS.map((c) => <Chip key={c} label={c} on={cat === c} onClick={() => setCat(c)} />)}
        </div>
        <input type="text" maxLength={120} placeholder="Название темы" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea rows={4} maxLength={1000} placeholder="Расскажи подробнее" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="pub" disabled={busy} onClick={publish}>Опубликовать</button>
      </div>
    </div>
  );
}
