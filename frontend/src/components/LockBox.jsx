import { useEffect, useRef, useState } from "react";
import PoopIcon from "./PoopIcon";
import { JeraIcon } from "./JeraIcon";
import { THEMES } from "../constants";
import { haptic } from "../tg";
import { sfx } from "../sfx";
import { deckSound } from "../deckSound";
const TRIES = 1;
const MIN_INK = 160;
// Keep in sync with the finite CSS sequences below.
const STAMP_MS = 1200;
const CHECK_MS = 360;
const CAMERA_MS = 700;
const OPEN_MS = 1100;
const byId = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

function TapeDeck({ slots, phase, prize, isDupe, onRemove }) {
  const interactive = phase === "lock";
  return (
    <div className="td-stage">
      <div className="td-ground" />
      <div className="td-camera">
        <div className="td-deck">
          <div className="td-top">
            <div className="td-brand"><span>YAB / AUDIO LAB</span><b>03</b></div>
            <div className="td-grille" />
            <div className="td-input-label">RUNE SEQUENCE</div>
            <div className="td-slots" aria-label="Порядок рун">
              {slots.map((rune, i) => (
                <button key={i} type="button"
                  className={"td-slot" + (rune ? " filled" : "") + (interactive && i === slots.findIndex(s => !s) ? " cur" : "")}
                  aria-label={"Гнездо " + (i + 1) + (rune ? ": " + rune + ", убрать" : ", пусто")}
                  disabled={!interactive || !rune} onClick={() => onRemove(i)}>
                  {rune || <span className="td-slot-mark">{i + 1}</span>}
                </button>
              ))}
            </div>
            <div className="td-top-footer"><span>MEMORY ENCODER</span><i className="td-led" /></div>
          </div>
          <div className="td-front">
            <div className="td-front-head"><span>THEME DECK</span><span>STEREO / Y-03</span></div>
            <div className="td-bay" />
            <div className="td-door"><span>EJECT</span><i /></div>
            <div className="td-tape" data-rarity={prize?.rarity} style={prize ? { "--tape-bg": prize.bg, "--tape-card": prize.card, "--tape-fg": prize.fg } : undefined}>
              <div className="td-tape-label"><span>{isDupe ? "ПОВТОРКА / RECYCLE" : prize?.rarity === "mythic" ? "МИФИЧЕСКАЯ / ЗОЛОТОЙ СМЫВ" : "SIDE A / THEME"}</span><b>{prize?.name || "YAB MIX"}</b></div>
              <div className="td-tape-window"><i />{prize?.id === "poop" ? <PoopIcon size={24} /> : <span />}<i /></div>
              <div className="td-tape-bottom"><i /><span>◀  YAB STUDIO  ▶</span><i /></div>
            </div>
            <div className="td-controls"><i /><i /><i /><span>▶ REC / PLAY</span><b className="td-led" /></div>
          </div>
          <div className="td-side" />
        </div>
      </div>
    </div>
  );
}

export default function LockBox({
  title = "Кассета с темой",
  price,
  balance,
  onBuy, // async () => { runes: string[] }  // 3 руны в правильном порядке
  onUnlock, // async (runes: string[]) => { ok, themeId, left, refund }
  onApply,
  activeTheme,
  resumeAvailable = false,
  lostText = "Раз код не вспомнили — Бека выкупит его у вас обратно за пол цены",
}) {
  // idle | buying | sign | stamp | lock | check | pullback | open | lost | reveal
  const [phase, setPhase] = useState("idle");
  const [secret, setSecret] = useState([]); // правильный порядок (только в sign)
  const [slots, setSlots] = useState(["", "", ""]); // то, что игрок поставил
  const [pool, setPool] = useState([]); // руны, которые ещё не в слотах
  const [left, setLeft] = useState(TRIES);
  const [wrong, setWrong] = useState(false);
  const [prizeId, setPrizeId] = useState(null);
  const [isDupe, setIsDupe] = useState(false);
  const [muted, setMuted] = useState(sfx.muted);
  const [signalPaused, setSignalPaused] = useState(true);
  const arena = useRef(null);
  const [refund, setRefund] = useState(0);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const cv = useRef(null);
  const timers = useRef(new Map());
  const [reducedMotion, setReducedMotion] = useState(false);

  // Resolve pending waits on unmount, without leaving delayed state updates.
  function wait(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.current.delete(id);
        resolve();
      }, ms);
      timers.current.set(id, resolve);
    });
  }
  const ink = useRef({ down: false, x: 0, y: 0, len: 0 });

  useEffect(() => {
    alive.current = true;
    const pendingTimers = timers.current;
    return () => {
      alive.current = false;
      deckSound.stop();
      for (const [id, resolve] of pendingTimers) {
        clearTimeout(id);
        resolve();
      }
      pendingTimers.clear();
    };
  }, []);

  // No idle loop; only observe the preference for finite sequences.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    media.addEventListener("change", sync);
    sync();
    return () => media.removeEventListener("change", sync);
  }, []);

  // A tiny opacity-only LED; pause completely offscreen and in the background.
  useEffect(() => {
    let visible = false;
    const sync = () => {
      setSignalPaused(!visible || document.hidden);
      if (document.hidden) deckSound.stop();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(arena.current);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);

  // Initialize once: resetting canvas dimensions would erase the signature.
  // canvas для подписи
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.offsetWidth * dpr;
    c.height = c.offsetHeight * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.lineWidth = 2.5;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = getComputedStyle(c).getPropertyValue("--paper-fg").trim() || "#1b1b2f";
  }, []);

  /* ---------- подпись ---------- */
  const pos = (e) => {
    const r = cv.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e) {
    cv.current.setPointerCapture(e.pointerId);
    Object.assign(ink.current, { down: true, ...pos(e) });
  }

  function move(e) {
    const s = ink.current;
    if (!s.down) return;
    const p = pos(e);
    const g = cv.current.getContext("2d");
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    s.len += Math.hypot(p.x - s.x, p.y - s.y);
    s.x = p.x;
    s.y = p.y;
    if (s.len > MIN_INK && !ready) setReady(true);
  }

  function up() {
    ink.current.down = false;
  }

  function clearInk() {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d");
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.restore();
    ink.current.down = false;
    ink.current.len = 0;
    setReady(false);
  }

  /* ---------- покупка ---------- */
  async function buy() {
    if (phase !== "idle" || busy.current || (!resumeAvailable && balance < price)) return;
    busy.current = true;
    deckSound.unlock();
    haptic();
    setPhase("buying");
    try {
      const res = await onBuy();
      if (!alive.current) return;
      setSecret(res.runes);
      setSlots(["", "", ""]);
      setPool([]);
      setLeft(TRIES);
      clearInk();
      setPhase("sign");
    } catch {
      if (alive.current) setPhase("idle");
    } finally {
      busy.current = false;
    }
  }

  async function sign() {
    if (phase !== "sign" || !ready || busy.current) return;
    busy.current = true;
    up();
    haptic();
    setPhase("stamp");
    await wait(reducedMotion ? 40 : STAMP_MS);
    if (!alive.current) return;

    // после печати секрет больше не храним в DOM
    // создаём перемешанный пул из тех же 3 рун
    const shuffled = [...secret].sort(() => Math.random() - 0.5);
    setPool(shuffled);
    setSecret([]); // очищаем
    setPhase("lock");
    busy.current = false;
  }

  /* ---------- расстановка рун ---------- */
  function placeRune(rune, fromPoolIndex) {
    if (phase !== "lock" || busy.current) return;

    const empty = slots.findIndex((s) => !s);
    if (empty === -1) return;

    deckSound.unlock();
    haptic();
    const nextSlots = [...slots];
    nextSlots[empty] = rune;
    setSlots(nextSlots);

    const nextPool = [...pool];
    nextPool.splice(fromPoolIndex, 1);
    setPool(nextPool);

    // все 3 слота заполнены → проверяем
    if (nextSlots.every(Boolean)) {
      submit(nextSlots);
    }
  }

  function removeFromSlot(index) {
    if (phase !== "lock" || busy.current) return;
    const rune = slots[index];
    if (!rune) return;

    haptic();
    const nextSlots = [...slots];
    nextSlots[index] = "";
    setSlots(nextSlots);
    setPool((p) => [...p, rune]);
  }

  async function submit(value) {
    if (busy.current) return;
    busy.current = true;
    deckSound.play("read");
    setPhase("check");
    try {
      const [res] = await Promise.all([
        onUnlock(value),
        wait(reducedMotion ? 0 : CHECK_MS),
      ]);
      if (!alive.current) return;

      if (res.ok) {
        haptic();
        setPrizeId(res.themeId);
        setIsDupe(Boolean(res.isDupe));
        setRefund(res.refund ?? 0);
        setPhase("pullback");
        await wait(reducedMotion ? 40 : CAMERA_MS);
        if (!alive.current) return;
        setPhase("open");
        deckSound.play("eject", reducedMotion);
        await wait(reducedMotion ? 40 : OPEN_MS);
        if (!alive.current) return;
        setPhase("reveal");
        if (res.isDupe) {
          await wait(reducedMotion ? 200 : 1100);
          if (!alive.current) return;
          setPhase("recycle");
          deckSound.play("recycle");
          await wait(reducedMotion ? 40 : 650);
          if (alive.current) setPhase("recycled");
        }
      } else if (res.left > 0) {
        setLeft(res.left);
        setSlots(["", "", ""]);
        // возвращаем руны в пул (перемешиваем)
        setPool([...value].sort(() => Math.random() - 0.5));
        setWrong(true);
        setPhase("lock");
        await wait(reducedMotion ? 0 : 450);
        if (alive.current) setWrong(false);
      } else {
        setLeft(0);
        setRefund(res.refund ?? 0);
        setPhase("lost");
      }
    } catch {
      if (alive.current) {
        setSlots(["", "", ""]);
        setPool([...value]);
        setPhase("lock");
      }
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    if (busy.current) return;
    setWrong(false);
    setRefund(0);
    deckSound.stop();
    setIsDupe(false);
    setPrizeId(null);
    setSlots(["", "", ""]);
    setPool([]);
    setSecret([]);
    setPhase("idle");
  }

  const prize = prizeId ? byId(prizeId) : null;
  const canBuy = phase === "idle" && (resumeAvailable || balance >= price);
  const isOpen = ["open", "reveal", "recycle", "recycled"].includes(phase);
  const coin = <JeraIcon size={18} />;
  return (
    <div className="card boxcard lockbox tape-box">
      <div
        className={"arena" + (wrong ? " wrong" : "")}
        ref={arena}
        data-signal={signalPaused ? "paused" : "running"}
        data-phase={phase}
        data-open={isOpen ? "1" : "0"}
      >
        <TapeDeck slots={slots} phase={phase} prize={prize} isDupe={isDupe} onRemove={removeFromSlot} />

        {/* договор */}
        <div className="contract">
          <div className="sheet-head">
            <h4>ДОГОВОР</h4>
            <div className="sheet-runes">
              {secret.map((r, i) => (
                <span key={i} className="rune">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <p>Я обязуюсь запомнить порядок рун. Забуду — пеняю на себя.</p>
          <div className="sig">
            <canvas
              ref={cv}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
            <span className="sig-x">✕</span>
          </div>
          <span className="seal">
            ПОДПИ
            <br />
            САНО
          </span>
        </div>


      </div>

      <button type="button" className="td-sound" aria-pressed={!muted}
        aria-label={muted ? "Включить звук установки" : "Выключить звук установки"}
        onClick={() => { const next = sfx.toggle(); setMuted(next); if (next) deckSound.stop(); else deckSound.unlock(); }}>
        {muted ? "Звук: выкл" : "Звук: вкл"}
      </button>
      <div className="bx-info" aria-live="polite">
        {(phase === "idle" || phase === "buying") && (
          <>
            <h3>{title}</h3>
            {!resumeAvailable && balance < price && (
              <p>Не хватает Йеры. Играй и попадай в недельный топ.</p>
            )}
            <div className="bx-btns">
              <button type="button" className="pub" disabled={!canBuy} onClick={buy}>
                {resumeAvailable ? "Продолжить кассету" : price===0 ? "Открыть бесплатно" : <>Купить {coin} {price}</>}
              </button>
            </div>
          </>
        )}

        {phase === "sign" && (
          <div className="bx-btns">
            <button type="button" className="pub alt" onClick={clearInk}>
              Стереть
            </button>
            <button type="button" className="pub" disabled={!ready} onClick={sign}>
              Подписать
            </button>
          </div>
        )}

        {phase === "stamp" && <h3>Оформляем…</h3>}

        {(phase === "lock" || phase === "check") && (
          <>
            <p className="td-hint">{phase === "check" ? "Проверяем последовательность…" : "Вставь руны в гнёзда на панели"}</p>
            <div className="tries" aria-label={"Попыток: " + left}>
              {Array.from({ length: TRIES }, (_, i) => (
                <b key={i} className={i < left ? "on" : ""} />
              ))}
            </div>

            <div className="rune-pool">
              {pool.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="rune-btn"
                  disabled={phase === "check"}
                  onClick={() => placeRune(r, i)}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "pullback" && <h3>Код принят</h3>}
        {phase === "open" && <h3>Выдаём кассету…</h3>}

        {phase === "lost" && (
  <>
    <h3>Запись не расшифрована</h3>
    <p>{lostText}<br />Возвращено: {coin} {refund}</p>
    <div className="bx-btns">
      <button type="button" className="pub" onClick={reset}>Ок</button>
    </div>
  </>
)}

        {["reveal", "recycle", "recycled"].includes(phase) && prize && (
          <>
            <h3>{isDupe ? "Повторка" : prize.name}</h3>
            {!isDupe && prize.rarity === "mythic" && <span className="mythic-reward">Мифическая · Золотой смыв</span>}
            <p>{isDupe ? (phase === "recycled" ? `Кассета утилизирована. Возвращено ${refund} Йер.` : prize.name + " уже есть. Утилизируем кассету…") : "Тема добавлена в твою коллекцию."}</p>
            <div className="bx-btns">
              {!isDupe && <button
                type="button"
                className="pub"
                disabled={activeTheme === prize.id}
                onClick={() => {
                  haptic();
                  onApply(prize.id);
                }}
              >
                {activeTheme === prize.id ? "Применено" : "Применить"}
              </button>}
              <button type="button" className="pub alt" disabled={isDupe && phase !== "recycled"} onClick={reset}>
                Ещё один
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}