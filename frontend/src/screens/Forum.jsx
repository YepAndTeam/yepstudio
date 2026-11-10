import { useMemo } from "react";
import { CATS } from "../constants";
import { useStore } from "../store";
import { Chip, Loading, Stat } from "../components/Common";
import { Pin, Plus } from "../components/Icons";
import { copyLink } from "../share";
export default function Forum({ openThread, openSheet, cat, setCat, sort, setSort }) {
  const { topics, me } = useStore();

  const list = useMemo(() => (topics || [])
    .filter((t) => cat === "Все" || t.category === cat)
    .sort((a, b) =>
      (Number(b.pinned) - Number(a.pinned)) ||
      (Number(b.rated) - Number(a.rated)) ||
      (sort === "top" ? b.votes - a.votes : b.id - a.id)), [topics, cat, sort]);

  if (!topics) return <Loading />;

  return (
    <>
      <div className="fhead">
        <div style={{ display: "flex", alignItems: "baseline" }}><h2>Форум</h2><span className="n">{topics.length}</span></div>
        <button type="button" className="newbtn" onClick={openSheet}><Plus /><span>Тема</span></button>
      </div>

      <div className="filters">
        <div className="chips scroll">
          {["Все", ...CATS].map((c) => <Chip key={c} label={c} on={cat === c} onClick={() => setCat(c)} />)}
        </div>
        <div className="seg">
          <button type="button" className={sort === "new" ? "on" : ""} onClick={() => setSort("new")}>Новые</button>
          <button type="button" className={sort === "top" ? "on" : ""} onClick={() => setSort("top")}>Популярные</button>
        </div>
      </div>

      {list.map((t) => (
        <button type="button" className="topic" key={t.id} onClick={() => openThread("t" + t.id)}>
          <div className="t1">
            <div className="meta"><span>{t.category}</span><Stat status={t.status} /></div>
            <div className="flags">{t.pinned && <Pin />}{t.rated && <span className="badge">Оценено</span>}</div>
          </div>
          <div className="title">{t.title}</div>
          {t.text && <div className="prev">{t.text}</div>}
          <div className="foot">
            <span className="au">{t.author_id === me?.id ? "Ты" : t.author}</span>
            <span className={`v ${t.voted ? "on" : ""}`}>▲ {t.votes}</span>
            <span>Ответов: {t.replies}</span>
            <span
  role="button"
  tabIndex={0}
  className="cp"
  onClick={(e) => { e.stopPropagation(); copyLink("t" + t.id); }}
>
  Ссылка
</span>
          </div>
        </button>
      ))}

      {!list.length && <div className="empty">В этой категории пока пусто. Будь первым.</div>}
    </>
  );
}
