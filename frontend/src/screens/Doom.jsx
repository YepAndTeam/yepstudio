import { useEffect, useRef, useState } from "react";
import { tg } from "../tg";

const DOOM_URL =
  "https://doomru.onrender.com/?iwad=freedoom1.wad&file=rus.pk3&warp=1,1&skill=3&nomelt=1";

const SIZE_KEY = "doom_height";
const MIN_H = 300;
const MAX_H = 900;
const DEFAULT_H = 520;

const PRESETS = [
  { label: "Малое", h: 360 },
  { label: "Среднее", h: 520 },
  { label: "Большое", h: 720 },
];

const clamp = (n) => Math.min(MAX_H, Math.max(MIN_H, Math.round(n)));

const readHeight = () => {
  try {
    const v = parseInt(localStorage.getItem(SIZE_KEY), 10);
    return Number.isFinite(v) ? clamp(v) : DEFAULT_H;
  } catch {
    return DEFAULT_H;
  }
};

const CONTROLS = [
  { key: "W A S D", text: "Движение" },
  { key: "МЫШЬ", text: "Поворот и прицел" },
  { key: "CTRL / ЛКМ", text: "Стрельба" },
  { key: "SPACE / E", text: "Открыть дверь, нажать кнопку" },
  { key: "SHIFT", text: "Бежать" },
  { key: "1 – 7", text: "Выбор оружия" },
  { key: "TAB", text: "Карта уровня" },
  { key: "ESC", text: "Меню и пауза" },
];

const RULES = [
  "Кликни по окну игры, чтобы клавиши и мышь заработали. Если управление не отвечает, кликни ещё раз.",
  "Цель уровня: найти выход. Он обычно отмечен табличкой EXIT или большой кнопкой на стене.",
  "Двери и рычаги открываются клавишей SPACE или E (на телефоне кнопкой USE), когда стоишь рядом с ними.",
  "Для цветных дверей нужны ключ-карты того же цвета: красная, синяя, жёлтая. Ищи их на уровне.",
  "Следи за здоровьем и бронёй внизу экрана. Аптечки и броня лежат на уровне, подбирай их, просто наступив.",
  "Патроны ограничены. Не трать их на слабых врагов, меняй оружие клавишами 1 – 7.",
  "Секреты есть почти на каждом уровне: подозрительные стены иногда открываются по нажатию SPACE.",
  "Для паузы и настроек нажми ESC (на телефоне кнопку ☰ вверху окна игры).",
];

const openOutside = () => {
  try {
    tg.openLink(DOOM_URL, { try_browser: true });
  } catch {
    window.open(DOOM_URL, "_blank", "noopener");
  }
};

export default function Doom({ onBack }) {
  const frameRef = useRef(null);
  const [height, setHeight] = useState(readHeight);
  const [showSize, setShowSize] = useState(false);

  // в некоторых окнах (например, Telegram на телефоне) изоляции нет, и игра там не запустится
  const canEmbed = typeof window !== "undefined" && window.crossOriginIsolated;

  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, String(height)); } catch {}
  }, [height]);

  const fitScreen = () => setHeight(clamp(window.innerHeight * 0.85));

  return (
    <div className="doom-screen">
      <div className="fhead">
        <button type="button" className="back" onClick={onBack}>
          ← Игры
        </button>

        <div className="doom-title">
          DOOM <span>1993</span>
        </div>
      </div>

      <div className="card doom-card">
        <div className="doom-info">
          <span>UZDOOM ENGINE</span>
          <span>WASM EDITION</span>
        </div>

        {canEmbed ? (
          <>
            <div
              style={{
                width: "100%",
                height: `${height}px`,
                background: "#000",
                overflow: "hidden",
                borderRadius: "8px",
              }}
              onClick={() => frameRef.current?.focus()}
            >
              <iframe
                ref={frameRef}
                title="UZDoom"
                src={DOOM_URL}
                allow="cross-origin-isolated; fullscreen; gamepad; autoplay"
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                  background: "#000",
                }}
              />
            </div>

            <div className="doom-tools">
              <button
                type="button"
                className="doom-tool"
                onClick={() => setShowSize((v) => !v)}
              >
                {showSize ? "Скрыть размер" : "Размер окна"}
              </button>
              <button type="button" className="doom-tool" onClick={openOutside}>
                Открыть в браузере
              </button>
            </div>

            {showSize && (
              <div className="doom-size">
                <div className="doom-size-row">
                  <span>Высота окна</span>
                  <b>{height}px</b>
                </div>
                <input
                  type="range"
                  min={MIN_H}
                  max={MAX_H}
                  step={10}
                  value={height}
                  onChange={(e) => setHeight(clamp(Number(e.target.value)))}
                  aria-label="Высота игрового окна"
                />
                <div className="doom-presets">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`doom-tool ${height === p.h ? "on" : ""}`}
                      onClick={() => setHeight(p.h)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button type="button" className="doom-tool" onClick={fitScreen}>
                    По экрану
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="doom-fallback">
            <div className="muted small">
              В этом окне игра не запустится. Открой её в браузере.
            </div>
            <button type="button" className="newbtn" onClick={openOutside}>
              Запустить Doom
            </button>
          </div>
        )}
      </div>

      <div className="card doom-rules">
        <h3>Управление</h3>
        <div className="doom-keys">
          {CONTROLS.map((c) => (
            <div key={c.key} className="doom-key">
              <span>{c.key}</span>
              {c.text}
            </div>
          ))}
        </div>

        <h3>Правила и как играть</h3>
        <ol className="doom-list">
          {RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>

        <div className="doom-note">
          На компьютере играй клавиатурой и мышью. На телефоне есть экранное управление:
          джойстик слева для движения, FIRE для стрельбы, USE открывает двери, JUMP
          прыгает, кнопка ☰ вверху открывает меню. Первая загрузка может занять до минуты.
        </div>
      </div>

      <div className="doom-footer">DOOM powered by UZDoom WebAssembly</div>
    </div>
  );
}