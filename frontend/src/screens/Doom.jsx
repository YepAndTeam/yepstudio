import { useRef } from "react";

const DOOM_URL =
  "https://doomru.onrender.com/?iwad=freedoom1.wad&file=rus.pk3&warp=1,1&skill=3&nomelt=1";

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
  "Двери и рычаги открываются клавишей SPACE или E, когда стоишь рядом с ними.",
  "Для цветных дверей нужны ключ-карты того же цвета: красная, синяя, жёлтая. Ищи их на уровне.",
  "Следи за здоровьем и бронёй внизу экрана. Аптечки и броня лежат на уровне, подбирай их, просто наступив.",
  "Патроны ограничены. Не трать их на слабых врагов, меняй оружие клавишами 1 – 7.",
  "Секреты есть почти на каждом уровне: подозрительные стены иногда открываются по нажатию SPACE.",
  "Если нужно выйти, нажми ESC, а для полноэкранного режима используй кнопку fullscreen в самом окне игры.",
];

export default function Doom({ onBack }) {
  const frameRef = useRef(null);

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

        <div
          style={{
            width: "100%",
            height: "min(72vh, 650px)",
            minHeight: "400px",
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
          Игра рассчитана на компьютер с клавиатурой и мышью. На телефоне экранного
          управления нет, поэтому играть там неудобно.
        </div>
      </div>

      <div className="doom-footer">DOOM powered by UZDoom WebAssembly</div>
    </div>
  );
}