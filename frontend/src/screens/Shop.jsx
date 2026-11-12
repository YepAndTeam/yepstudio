import { lazy, Suspense, useState } from "react";
const DiscCollection=lazy(()=>import("./DiscCollection"));
import { useStore } from "../store";
import { JeraIcon } from "../components/JeraIcon";
import ThemeBox, { THEME_BOX_PRICE } from "./ThemeBox";

export default function Shop({ jera = 0 }) {
  const [box, setBox] = useState(null);
  const { me } = useStore();
  const price = me?.theme_box_price ?? THEME_BOX_PRICE;

  if(box==="discs")return <Suspense fallback={<p className="card">Загружаем DVD-плеер…</p>}><DiscCollection onBack={()=>setBox(null)} backLabel="Магазин"/></Suspense>;
  if (box === "themes") {
    return <ThemeBox jera={jera} onBack={() => setBox(null)} />;
  }

  return (
    <>
      <div className="card wallet">
        <div className="muted small">Твой баланс</div>
        <div className="wallet-sum">
          <JeraIcon size={30} />
          <b>{jera}</b>
        </div>
      </div>

      <div className="ggrid"><div className="gtile wide"><button type="button" className="topic gp" onClick={()=>setBox("discs")}><div className="title">DVD-архив</div><div className="prev">Коллекционные диски · редкость на обороте</div><div className="foot"><span className="badge">Открыть плеер</span></div></button></div>
      <div className="gtile wide">
        <button
          type="button"
          className="topic gp"
          onClick={() => setBox("themes")}
        >
          <div className="title">Коробка тем</div>
          <div className="prev">Кассетная установка · 3 руны</div>
          <div className="foot">
            <span className="badge">
              <JeraIcon size={14} /> {price}
            </span>
          </div>
        </button>
      </div>

        <div className="gtile soon wide">
          <button type="button" className="topic gp" disabled>
            <div className="title">Коробка титулов</div>
            <div className="prev">Титул рядом с твоим именем</div>
            <div className="foot">
              <span className="badge">Скоро</span>
            </div>
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
          Как получить Йеру
        </h3>
        <div className="small muted">
          Йера выдаётся за места в недельном топе игр: 1 место — 100, 2–3
          места — по 50, 4–10 места — по 20. Неделя закрывается автоматически,
          рекорды сбрасываются, а старые остаются во вкладке «За всё время».
        </div>
      </div>
    </>
  );
}
