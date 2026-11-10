import { useEffect, useRef } from "react";

const isTouch = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Экранные кнопки.
 *
 * keys: [{
 *   label,            // текст и ключ (должен быть уникальным)
 *   icon,             // необязательно: иконка вместо текста
 *   pos,              // необязательно: grid-area
 *   cls,              // необязательно: доп. класс кнопки (например "big")
 *   on(),             // нажатие
 *   off(),            // необязательно: отпускание (для зажатия: идти, стрелять)
 *   repeat,           // необязательно: мс между повторами on() при удержании
 * }]
 * row: четыре колонки вместо трёх
 * always: показывать и на десктопе (по умолчанию только на сенсорных экранах)
 * className: доп. класс контейнера (dpad, fire)
 *
 * Что исправлено по сравнению со старой версией:
 *  - pointer capture: палец, съехавший с кнопки, не «теряет» отпускание;
 *  - есть off(), поэтому можно держать кнопку (раньше было только нажатие);
 *  - repeat для удержания (сдвиг фигуры, поворот);
 *  - touch-action: none и запрет контекстного меню, иначе при долгом тапе
 *    WebView ловит выделение/увеличение и «съедает» нажатия;
 *  - всё отпускается при сворачивании аппа, чтобы не залипали клавиши;
 *  - on/off берутся из актуального props в момент вызова (нет устаревших замыканий).
 */
export default function Pad({ keys, row, always, className = "" }) {
  const active = useRef(new Map()); // pointerId -> { label, d, i }
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const call = (label, fn) => keysRef.current.find((k) => k.label === label)?.[fn]?.();

  const stop = (id) => {
    const a = active.current.get(id);
    if (!a) return;
    active.current.delete(id);
    clearTimeout(a.d);
    clearInterval(a.i);
    call(a.label, "off");
  };

  useEffect(() => {
    const releaseAll = () => [...active.current.keys()].forEach(stop);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
      releaseAll();
    };
  }, []);

  if (!always && !isTouch()) return null;

  const start = (e, k) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const a = { label: k.label };
    active.current.set(e.pointerId, a);
    call(k.label, "on");
    if (k.repeat) {
      a.d = setTimeout(() => {
        a.i = setInterval(() => call(k.label, "on"), k.repeat);
      }, 220);
    }
  };

  return (
    <div className={`pad ${row ? "row" : ""} ${className}`}>
      {keys.map((k) => (
        <button
          key={k.label}
          type="button"
          className={`padbtn ${k.cls || ""}`}
          style={k.pos ? { gridArea: k.pos } : undefined}
          aria-label={typeof k.label === "string" ? k.label : undefined}
          onPointerDown={(e) => start(e, k)}
          onPointerUp={(e) => stop(e.pointerId)}
          onPointerCancel={(e) => stop(e.pointerId)}
          onLostPointerCapture={(e) => stop(e.pointerId)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {k.icon ?? k.label}
        </button>
      ))}
    </div>
  );
}