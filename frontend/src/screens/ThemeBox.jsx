import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { JeraIcon } from "../components/JeraIcon";
import LockBox from "../components/LockBox";
import PoopIcon from "../components/PoopIcon";
import { THEMES } from "../constants";

export const THEME_BOX_PRICE = 100;

function ThemePreview({ id, size = 48 }) {
  const theme = THEMES.find((item) => item.id === id);

  if (!theme) {
    return <div style={{ width: size, height: size * 0.7, flex: "none" }} />;
  }

  return (
    <span
      className={"pv" + (theme.rarity === "mythic" ? " mythic-preview" : "")}
      style={{
        background: theme.bg,
        width: size,
        height: size * 0.7,
        padding: 5,
        borderRadius: 8,
        flex: "none",
      }}
    >
      {theme.id === "poop" && <PoopIcon size={size * .55} />}
      <i
        style={{
          background: theme.card,
          display: "block",
          height: "100%",
          padding: 4,
          borderRadius: 5,
        }}
      >
        <b
          style={{
            background: theme.fg,
            display: "block",
            height: 4,
            borderRadius: 2,
            width: "70%",
          }}
        />
        <b
          style={{
            background: theme.fg,
            display: "block",
            height: 4,
            borderRadius: 2,
            width: "40%",
            marginTop: 3,
          }}
        />
      </i>
    </span>
  );
}

export default function ThemeBox({ jera = 0, onBack }) {
  const { theme, setTheme, syncEconomy } = useStore();
  const [shop, setShop] = useState(null);
  const [error, setError] = useState("");
  const purchase = useRef(null);
  const requestId = useRef(null);
  useEffect(() => {
    let active=true;
    api("/shop").then(value=>{if(active){setShop(value);syncEconomy(value);purchase.current=value.active_box?.id || null;}})
      .catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[syncEconomy]);
  async function buyBox() {
    if (!requestId.current) requestId.current=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
    try {
      const result=await api("/shop/theme-box/buy","POST",{request_id:requestId.current});
      purchase.current=result.box_id;
      setShop(value=>({...value,balance:result.balance,active_box:{id:result.box_id}}));
      setError("");syncEconomy(result);
      return result;
    } catch(e){setError(e.message);throw e;}
  }
  async function handleUnlock(attempt) {
    try {
      if (!purchase.current) {
        throw new Error("Кассета уже обработана. Вернись в магазин и открой историю круток.");
      }
      const result=await api("/shop/theme-box/unlock","POST",{box_id:purchase.current,runes:attempt});
      purchase.current=null;requestId.current=null;
      const state=result.shop;
      if(state)setShop(state);
      else setShop(value=>({...value,balance:result.balance,active_box:null}));
      syncEconomy(state || result);
      setError("");return result;
    }catch(e){setError(e.message);throw e;}
  }
  const history=shop?.history || [];
  const rarities=shop?.rarities || [];

  return (
    <>
      <div className="bar">
        <button type="button" className="back" onClick={onBack}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Назад
        </button>
      </div>

      <div className="card wallet">
        <div className="muted small">Твой баланс</div>
        <div className="wallet-sum">
          <JeraIcon size={28} />
          <b>{shop?.balance ?? jera}</b>
        </div>
      </div>

      {error && <div className="card small" role="status">{error}</div>}
      {shop ? <LockBox
        title="Коробка тем"
        price={shop.price}
        balance={shop.balance}
        onBuy={buyBox}
        onUnlock={handleUnlock}
        onApply={setTheme}
        activeTheme={theme}
        resumeAvailable={Boolean(shop.active_box)}
        lostText="Раз код не вспомнили — Бека выкупит его у вас обратно за пол цены"
      /> : !error && <div className="card small muted">Загружаем магазин…</div>}

      {/* Что можно выбить */}
      <div className="card">
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>
          Что можно выбить
        </h3>

        {rarities.map((group) => (
          <div key={group.key} style={{ marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                fontSize: 13,
                fontWeight: 600,
                color: group.color,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: group.color,
                }}
              />
              {group.title} · {group.chance}%
            </div>

            {group.items.length === 0 ? (
              <div
                className="small muted"
                style={{ paddingLeft: 16, opacity: 0.55 }}
              >
                — скоро появятся —
              </div>
            ) : (
              <div className="col" style={{ gap: 10 }}>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <ThemePreview id={item.id} />
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </div>

                    <span className="muted small" style={{ flex: "none" }}>
                      {Number(item.chance.toFixed(2))!==item.chance?"≈ ":""}{Number(item.chance.toFixed(2)).toLocaleString("ru-RU")}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {shop && <div className="card small muted">Кассета — {shop.price} Йер. За ошибку возвращаем {shop.failure_refund}. За повторку: обычная — 25, редкая — 50, мифическая — 100 Йер.</div>}

      {/* История открытий */}
      <div className="card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>
          Твои крутки
        </h3>

        {history.length === 0 ? (
          <div className="small muted">
            Пока пусто. Открой первую коробку.
          </div>
        ) : (
          <div className="col" style={{ gap: 11 }}>
            {history.slice(0, 15).map((roll) => (
              <div
                key={roll.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {roll.success ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <ThemePreview id={roll.themeId} size={42} />
                      <span style={{ fontWeight: 500 }}>
                        {THEMES.find((item) => item.id === roll.themeId)
                          ?.name || roll.themeId}
                      </span>
                    </div>

                    <span
                      className="small"
                      style={{
                        color: roll.isDupe ? "var(--muted)" : "var(--coin)",
                        flex: "none",
                      }}
                    >
                      {roll.isDupe ? `Повторка · +${roll.refund} Йер` : "новая"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="muted">Запись не расшифрована</span>
                    <span className="small muted">+{roll.refund} Йер</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

