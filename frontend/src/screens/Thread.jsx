import { useEffect, useRef, useState } from "react";
import { CYCLE, ST, dayLabel } from "../constants";
import { useStore } from "../store";
import { confirmDialog, haptic, notify } from "../tg";
import { BackIcon, Dots } from "../components/Icons";
import { Loading, Skeleton, Stat } from "../components/Common";

export default function Thread({ refId, onBack }) {
  const s = useStore();
  const { me, topics, home, comments, error, isMod } = s;
  const isTopic = refId[0] === "t";
  const id = Number(refId.slice(1));
  const item = isTopic ? (topics || []).find((t) => t.id === id) : (home?.posts || []).find((p) => p.id === id);

  const [menu, setMenu] = useState(false);
  const [text, setText] = useState("");
  const [replyId, setReplyId] = useState(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { s.loadComments(refId); }, [refId]); // eslint-disable-line

  const backBtn = <button type="button" className="back" onClick={onBack}><BackIcon /><span>Назад</span></button>;

  if (!item) {
    return (
      <>
        <div className="bar">{backBtn}</div>
        {topics || home ? <div className="empty">Эта запись недоступна.</div> : <Skeleton />}
      </>
    );
  }

  const all = comments[refId];
  const target = replyId && all ? all.find((c) => c.id === replyId) : null;
  const mod = isTopic && isMod;
  const who = (authorId, name) => (authorId === me?.id ? "Ты" : name);

  const ordered = [];
  if (all) {
    all.filter((c) => c.parent_id === null).forEach((r) => {
      ordered.push(r);
      all.filter((k) => k.parent_id === r.id).forEach((k) => ordered.push(k));
    });
  }

  const guard = (fn, msg) => async (...a) => {
    try { await fn(...a); } catch (e) { notify(msg + e.message); }
  };

  const send = async () => {
    const t = text.trim();
    if (t.length < 2) return notify("Напиши хотя бы 2 символа.");
    if (busy) return;
    setBusy(true);
    try {
      await s.sendComment(refId, t, replyId);
      setText(""); setReplyId(null); haptic();
    } catch (e) { notify("Не удалось отправить: " + e.message); }
    finally { setBusy(false); }
  };

  const startReply = (c) => {
    setReplyId(c.parent_id !== null ? c.parent_id : c.id);
    taRef.current?.focus();
  };

  const react = guard((cid, type) => { haptic(); return s.react(refId, cid, type); }, "Не удалось сохранить: ");
  const vote = guard(() => { haptic(); return s.voteTopic(id); }, "Не удалось проголосовать: ");
  const patch = guard((body) => s.patchTopic(id, body), "Не удалось: ");
  const nextStatus = item.status ? (CYCLE[CYCLE.indexOf(item.status) + 1] || "none") : "new";
  const remove = () => confirmDialog("Удалить тему?", guard(async () => {
    await s.deleteTopic(id); onBack();
  }, "Не удалось удалить: "));

  return (
    <>
      <div className="bar">
        {backBtn}
        {mod && <button type="button" className="dots" aria-label="Действия модератора" onClick={() => setMenu((m) => !m)}><Dots /></button>}
      </div>

      {mod && menu && (
        <div className="menu">
          <button type="button" onClick={() => patch({ pinned: !item.pinned })}>{item.pinned ? "Открепить" : "Закрепить"}</button>
          <button type="button" onClick={() => patch({ rated: !item.rated })}>{item.rated ? "Убрать «Оценено»" : "Оценить"}</button>
          <button type="button" onClick={() => patch({ status: nextStatus })}>Статус: {item.status ? ST[item.status] : "нет"}</button>
          <button type="button" onClick={remove}>Удалить тему</button>
        </div>
      )}

      {isTopic ? (
        <div className="card thread">
          <div className="meta">
            <span>{item.category}</span><Stat status={item.status} />
            {item.pinned && <span>Закреплено</span>}
            {item.rated && <span className="badge">Оценено</span>}
          </div>
          <h2>{item.title}</h2>
          <div className="small muted">{who(item.author_id, item.author)}</div>
          {item.text && <p className="body">{item.text}</p>}
          <div><button type="button" className={`votebtn ${item.voted ? "on" : ""}`} onClick={vote}>▲ {item.votes}</button></div>
        </div>
      ) : (
        <div className="card thread">
          <div className="small muted">{dayLabel(item.created_at)}</div>
          <h2>{item.title}</h2>
          <p className="body">{item.text}</p>
        </div>
      )}

      <div className="card tail">
        {!all ? (
          <div className="noc">{error ? "Не удалось загрузить." : "Загрузка…"}</div>
        ) : (
          <>
            <div className="between" style={{ paddingBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{isTopic ? "Ответы" : "Комментарии"}</h3>
              <span className="small muted">{all.length}</span>
            </div>
            {!all.length && <div className="noc">Пока никто не написал. Начни первым.</div>}
            {ordered.map((c) => (
              <div className={`cm ${c.parent_id === null ? "" : "reply"}`} key={c.id}>
                <div className="who"><b>{who(c.author_id, c.author)}</b>{c.staff && <i>Автор</i>}</div>
                <div className="tx">{c.text}</div>
                <div className="acts">
                  <button type="button" className={c.my === "like" ? "on" : ""} aria-label="Нравится" onClick={() => react(c.id, "like")}>▲ {c.likes}</button>
                  <button type="button" className={c.my === "dislike" ? "on" : ""} aria-label="Не нравится" onClick={() => react(c.id, "dislike")}>▼ {c.dislikes}</button>
                  <button type="button" className="rp" onClick={() => startReply(c)}>Ответить</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card compose">
        {target && (
          <div className="rep">
            <span>Ответ для {target.author_id === me?.id ? "себя" : target.author}</span>
            <button type="button" onClick={() => setReplyId(null)}>Отмена</button>
          </div>
        )}
        <textarea ref={taRef} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={isTopic ? "Напиши ответ" : "Напиши комментарий"} />
        <button type="button" className="send" disabled={busy} onClick={send}>Отправить</button>
      </div>
    </>
  );
}
