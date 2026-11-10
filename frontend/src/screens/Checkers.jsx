import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { confirmDialog, haptic, notify } from "../tg";
import { sfx } from "../sfx";
import { shareLink } from "../share";
import { Chip } from "../components/Common";
import { BackIcon, LinkIcon } from "../components/Icons";

const S = 40, SZ = S * 8;
const FILES = "abcdefgh";

// Спрайты 8x8: 1 = тело шашки, 2 = деталь дамки (рисуется цветом контура)
const SPR = {
  m: ["........", "..1111..", ".111111.", ".111111.", ".111111.", ".111111.", "..1111..", "........"],
  k: ["........", "..1111..", ".112211.", ".122221.", ".122221.", ".112211.", "..1111..", "........"],
};

// l/d - светлая и тёмная клетки, w/b - белые и чёрные шашки, wo/bo - их контуры
const PAL = {
  dark: { l: "#9A9AA2", d: "#4E4E55", w: "#FFFFFF", b: "#0B0B0C", wo: "#0B0B0C", bo: "#FFFFFF" },
  light: { l: "#F1F2F3", d: "#A9ADB5", w: "#FFFFFF", b: "#0B0B0C", wo: "#0B0B0C", bo: "#FFFFFF" },
  retro: { l: "#FFFFFF", d: "#808080", w: "#FFFFFF", b: "#000000", wo: "#000000", bo: "#FFFFFF" },
  terminal: { l: "#0C2A12", d: "#051008", w: "#33FF66", b: "#001A08", wo: "#001A08", bo: "#33FF66" },
  nyan: { l: "#FFD6FF", d: "#E27FD6", w: "#FFFFFF", b: "#2B0A3D", wo: "#2B0A3D", bo: "#FFFFFF" },
  tetris: { l: "#2A2A6A", d: "#14143A", w: "#00F0F0", b: "#A000F0", wo: "#05051A", bo: "#F4F4FF" },
};

const REASON = {
  no_moves: "нет ходов",
  no_pieces: "нет шашек",
  resign: "сдача",
  repetition: "повтор позиции",
  king_moves: "ходы дамками без взятий",
};

const outcome = (result, my) =>
  result === "1/2-1/2" ? "Ничья" : (result === "1-0") === (my === "w") ? "Победа" : "Поражение";

// "c3:e5:g7" -> ["c3","e5","g7"], "c3-d4" -> ["c3","d4"]
const parse = (u) => u.split(/[-:]/);

// верхний левый угол клетки на canvas
const xy = (sq, flip) => {
  const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1;
  return [(flip ? 7 - f : f) * S, (flip ? r : 7 - r) * S];
};

function paint(ctx, rows, ox, oy, color, chars) {
  ctx.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < 8; i++) if (chars.includes(row[i])) ctx.fillRect(ox + i * 4, oy + j * 4, 4, 4);
  });
}

function draw(ctx, st, sel, flip) {
  const pal = PAL[document.documentElement.dataset.theme] || PAL.dark;

  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const [x, y] = xy(FILES[f] + (r + 1), flip);
      ctx.fillStyle = (f + r) % 2 === 0 ? pal.d : pal.l;
      ctx.fillRect(x, y, S, S);
    }
  }

  const hl = (sq, color) => {
    const [x, y] = xy(sq, flip);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, S, S);
  };
  if (st.last) parse(st.last).forEach((sq) => hl(sq, "rgba(255,230,0,.3)"));
  sel.forEach((sq) => hl(sq, "rgba(255,230,0,.55)"));

  for (const [sq, ch] of Object.entries(st.board)) {
    const [x, y] = xy(sq, flip);
    const white = ch.toLowerCase() === "w";
    const rows = SPR[ch === ch.toUpperCase() ? "k" : "m"];
    const body = white ? pal.w : pal.b;
    const line = white ? pal.wo : pal.bo;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) paint(ctx, rows, x + 4 + dx, y + 4 + dy, line, "12");
    paint(ctx, rows, x + 4, y + 4, body, "1");
    paint(ctx, rows, x + 4, y + 4, line, "2");
  }

  // куда можно пойти дальше
  if (sel.length) {
    const n = sel.length;
    const next = new Set(
      st.legal.map(parse).filter((m) => m.length > n && sel.every((s, i) => m[i] === s)).map((m) => m[n])
    );
    ctx.fillStyle = "rgba(255,230,0,.9)";
    for (const t of next) {
      const [x, y] = xy(t, flip);
      ctx.fillRect(x + 16, y + 16, 8, 8);
    }
  }
}

/* ---------------- Партия ---------------- */

function Match({ id, onBack }) {
  const { me, theme } = useStore();
  const [st, setSt] = useState(null);
  const [sel, setSel] = useState([]); // выбранный путь: [откуда, промежуточные..., ]
  const [err, setErr] = useState(null);
  const [called, setCalled] = useState(-1); // сколько было ходов, когда позвали соперника
  const cv = useRef(null);
  const stRef = useRef(null);
  const prevLen = useRef(0);

  const apply = (r, quiet) => {
    if (!quiet && prevLen.current > 0 && r.moves.length > prevLen.current) {
      sfx.jump();
      haptic();
    }
    prevLen.current = r.moves.length;
    stRef.current = r;
    setSt(r);
  };

  const load = () =>
    api(`/checkers/${id}`)
      .then((r) => apply(r))
      .catch((e) => setErr(e.message));

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const s = stRef.current;
      if (s && (s.status === "finished" || s.status === "cancelled")) return;
      load();
    }, 2500);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line

  const flip = st?.my === "b";

  useEffect(() => {
    if (!st || !cv.current) return;
    const dpr = window.devicePixelRatio || 1;
    cv.current.width = SZ * dpr;
    cv.current.height = SZ * dpr;
    const ctx = cv.current.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    draw(ctx, st, sel, flip);
  }, [st, sel, flip, theme]);

  const send = (move) => {
    setSel([]);
    api(`/checkers/${id}/move`, "POST", { move })
      .then((r) => {
        apply(r, true);
        sfx.jump();
        haptic();
      })
      .catch((e) => {
        notify(e.message);
        load();
      });
  };

  const tap = (sq) => {
    if (!st || st.status !== "active" || st.my !== st.turn) return;
    const moves = st.legal.map(parse);
    if (sel.length) {
      // повторный тап по последней выбранной клетке = шаг назад
      if (sel[sel.length - 1] === sq) return setSel(sel.slice(0, -1));
      const next = [...sel, sq];
      const hit = moves.filter((m) => next.every((s, i) => m[i] === s));
      if (hit.length) {
        const done = hit.find((m) => m.length === next.length);
        if (done) return send(st.legal[moves.indexOf(done)]);
        return setSel(next); // серия взятий ещё не закончена
      }
    }
    setSel(moves.some((m) => m[0] === sq) ? [sq] : []);
  };

  const onDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return;
    const f = flip ? 7 - c : c;
    const rank = flip ? r : 7 - r;
    tap(FILES[f] + (rank + 1));
  };

  const act = (path, then) =>
    api(`/checkers/${id}/${path}`, "POST")
      .then((r) => (then ? then() : apply(r, true)))
      .catch((e) => notify(e.message));

  if (!st) {
    return (
      <>
        <div className="fhead">
          <button type="button" className="back" onClick={onBack}>
            <BackIcon /> Шашки
          </button>
        </div>
        <div className="empty">{err || "Загрузка…"}</div>
      </>
    );
  }

  const mine = st.creator_id === me?.id;

  // соперник ушёл (минуту не открывал партию), а сейчас его ход
  const canCall = st.status === "active" && st.my && st.turn !== st.my && st.opp_away && called !== st.moves.length;
  const call = () =>
    api(`/checkers/${id}/call`, "POST")
      .then(() => {
        setCalled(st.moves.length);
        notify("Позвали соперника");
      })
      .catch((e) => notify(e.message));
  let status = "";
  if (st.status === "open") status = mine ? "Ждём соперника. Отправь ему ссылку." : "Тебя вызвали на партию";
  else if (st.status === "active") {
    status = st.my ? (st.turn === st.my ? "Твой ход" : "Ход соперника") : st.turn === "w" ? "Ходят белые" : "Ходят чёрные";
    if (st.must_capture) status += " · Бить обязательно";
  } else if (st.status === "finished") {
    const who = st.my ? outcome(st.result, st.my) : st.result === "1/2-1/2" ? "Ничья" : st.result === "1-0" ? "Победили белые" : "Победили чёрные";
    status = `${who} (${REASON[st.reason] || st.reason || "конец"})`;
  }

  const count = (c) => Object.values(st.board).filter((p) => p.toLowerCase() === c).length;

  const bar = (p, color) => (
    <div className="between">
      <span>
        {color === "w" ? "○" : "●"} {p.name ? (p.id === me?.id ? "Ты" : p.name) : "—"} · {count(color)}
      </span>
      {st.status === "active" && st.turn === color && <span className="badge">ход</span>}
    </div>
  );

  const list = [];
  st.moves.forEach((m, i) => list.push(i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m));

  return (
    <>
      <div className="fhead">
        <button type="button" className="back" onClick={onBack}>
          <BackIcon /> Шашки
        </button>
        {(st.status === "open" || st.status === "active") && (
          <button
            type="button"
            className="snd"
            aria-label="Скопировать ссылку"
            onClick={() => shareLink(`game_checkers_${id}`, "Сыграем партию в шашки?")}
          >
            <LinkIcon />
          </button>
        )}
      </div>

      <div className="card gm">
        <div style={{ paddingBottom: 10 }}>{flip ? bar(st.white, "w") : bar(st.black, "b")}</div>
        <canvas
          ref={cv}
          onPointerDown={onDown}
          style={{ width: "100%", maxWidth: 420, margin: "0 auto", aspectRatio: "1 / 1", display: "block", touchAction: "none" }}
        />
        <div style={{ paddingTop: 10 }}>{flip ? bar(st.black, "b") : bar(st.white, "w")}</div>
        <div className="small muted" style={{ paddingTop: 10 }}>{status}</div>
      </div>

      {st.status === "open" && !mine && (
        <button type="button" className="send" style={{ alignSelf: "stretch" }} onClick={() => act("join")}>
          Принять вызов
        </button>
      )}
      {st.status === "open" && mine && (
        <button type="button" className="send" style={{ alignSelf: "stretch" }} onClick={() => act("cancel", onBack)}>
          Отменить вызов
        </button>
      )}
      {st.status === "active" && st.my && (
        <button
          type="button"
          className="send"
          style={{ alignSelf: "stretch" }}
          onClick={() => confirmDialog("Сдаться?", () => act("resign"))}
        >
          Сдаться
        </button>
      )}

      {canCall && (
        <button type="button" className="send" style={{ alignSelf: "stretch" }} onClick={call}>
          Позвать соперника
        </button>
      )}

      {list.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ maxHeight: 72, overflowY: "auto", overflowWrap: "anywhere" }}>
            {list.join(" ")}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Лобби ---------------- */

function Lobby({ onBack, open }) {
  const [data, setData] = useState(null);
  const [color, setColor] = useState("random");
  const [err, setErr] = useState(null);

  const load = () =>
    api("/checkers")
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e.message || "Ошибка загрузки"));
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const create = () =>
    api("/checkers", "POST", { color })
      .then((r) => open(r.id))
      .catch((e) => notify(e.message));

  const row = (g, lobby) => {
    let badge = null;
    if (g.status === "finished") badge = outcome(g.result, g.my);
    else if (g.status === "active" && g.turn === g.my) badge = "Твой ход";
    const title = lobby
      ? `Вызов от ${g.creator || "?"}`
      : g.opponent
      ? `С ${g.opponent}`
      : "Ждёт соперника";
    return (
      <button type="button" className="topic" key={g.id} onClick={() => open(g.id)}>
        <div className="t1">
          <div className="title" style={{ marginTop: 0 }}>{title}</div>
          {badge && <span className="badge">{badge}</span>}
        </div>
        <div className="foot">
          <span>{g.status === "open" ? "Ожидает" : g.status === "active" ? "Идёт" : "Закончена"}</span>
          {g.status !== "open" && <span>Ходов: {g.moves}</span>}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="fhead">
        <button type="button" className="back" onClick={onBack}>
          <BackIcon /> Игры
        </button>
      </div>

      <div className="filters">
        <div className="chips scroll">
          {[["white", "Белые"], ["black", "Чёрные"], ["random", "Случайно"]].map(([v, l]) => (
            <Chip key={v} label={l} on={color === v} onClick={() => setColor(v)} />
          ))}
        </div>
        <button type="button" className="send" style={{ alignSelf: "stretch", margin: "8px 4px 0" }} onClick={create}>
          Бросить вызов
        </button>
      </div>

      {!data ? (
        <div className="empty">{err || "Загрузка…"}</div>
      ) : (
        <>
          {data.lobby.length > 0 && (
            <>
              <div className="small muted" style={{ padding: "0 4px" }}>Открытые вызовы</div>
              {data.lobby.map((g) => row(g, true))}
            </>
          )}
          <div className="small muted" style={{ padding: "0 4px" }}>Мои партии</div>
          {data.mine.length ? data.mine.map((g) => row(g, false)) : <div className="empty">Пока нет партий. Брось вызов.</div>}
        </>
      )}
    </>
  );
}

/* ---------------- Экран ---------------- */

export default function Checkers({ onBack, arg }) {
  const [gid, setGid] = useState(arg && /^\d+$/.test(arg) ? Number(arg) : null);
  if (gid) return <Match id={gid} onBack={() => setGid(null)} />;
  return <Lobby onBack={onBack} open={setGid} />;
}