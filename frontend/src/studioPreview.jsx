import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store";
import { THEMES } from "./constants";
import { installStudioPreview } from "./studioPreviewData";
import "./styles.css";
import "./fontPreview.css";

if(!import.meta.env.DEV)throw Error("Local preview is development-only");
const params=new URLSearchParams(location.search);
const inside=params.get("device")==="1";
if(inside){
  const theme=params.get("theme") || "dark";
  installStudioPreview(params.get("scene") || "registration",theme);
  document.documentElement.dataset.theme=theme;
  const font=params.get("font");
  if(["handjet","tiny5"].includes(font))document.documentElement.dataset.previewFont=font;
  try{localStorage.setItem("yab_theme",theme);}catch{}
  createRoot(document.getElementById("app")).render(<StoreProvider><App /></StoreProvider>);
}else{
  createRoot(document.getElementById("app")).render(<PreviewShell />);
}
function PreviewShell(){
  const [scene,setScene]=useState(params.get("scene") || "registration"),[theme,setTheme]=useState(params.get("theme")||"dark"),[size,setSize]=useState("360x640"),[revision,setRevision]=useState(0),[font,setFont]=useState("original");
  const [width,height]=size.split("x").map(Number);
  return <main style={{width:"100%",height:"100dvh",overflow:"auto",padding:12,boxSizing:"border-box",background:"#161a1a",color:"#eee",fontFamily:"system-ui"}}>
    <div style={{maxWidth:1000,margin:"0 auto",display:"flex",flexDirection:"column",gap:10}}>
      <b>YAB STUDIO · локальный стенд</b>
      <span style={{fontSize:12,color:"#b8c6be"}}>Настоящие экраны приложения, тестовые данные. Регистрация, баланс и запуск меняются только здесь.</span>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        <label style={{fontSize:12}}>Сценарий <select value={scene} onChange={e=>setScene(e.target.value)}>
          <option value="drive">После полуночи · новая игра</option><option value="race_betting">Скачки · ставки</option><option value="race_quarter">Скачки · перерыв / четвертьфинал</option><option value="race_running">Скачки · заезд</option><option value="race_finished">Скачки · финиш</option><option value="registration">Бесплатная регистрация</option><option value="active">Турнир идёт</option><option value="finished">Итоги и голосование</option><option value="paid">Платная регистрация</option><option value="empty">Пусто — создать в админке</option><option value="letter">Письмо — 5 игр</option><option value="daily">Ежедневная награда · 25 Йер</option><option value="daily7">Седьмой день · 50 Йер</option>
        </select></label>
        <button type="button" onClick={()=>setScene("race_betting")}>Скачки: ставки</button>
        <button type="button" onClick={()=>setScene("race_quarter")}>Скачки: четвертьфинал</button>
        <button type="button" onClick={()=>setScene("race_running")}>Скачки: заезд</button>
        <button type="button" onClick={()=>setScene("race_finished")}>Скачки: финиш</button>
        <label style={{fontSize:12}}>Тема <select value={theme} onChange={e=>setTheme(e.target.value)}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label style={{fontSize:12}}>Экран <select value={size} onChange={e=>setSize(e.target.value)}><option value="320x568">320 × 568</option><option value="360x640">360 × 640</option><option value="390x844">390 × 844</option><option value="430x932">430 × 932</option></select></label>
        <label style={{fontSize:12}}>Шрифт <select value={font} onChange={e=>setFont(e.target.value)}><option value="handjet">Handjet</option><option value="tiny5">Tiny5</option><option value="original">Текущий шрифт темы</option></select></label>
        <button type="button" onClick={()=>setRevision(v=>v+1)}>Начать заново</button>
        <a href="/tournament-dino.png" target="_blank" rel="noreferrer" style={{color:"#edbe63",fontSize:12}}>Обложка для Telegram</a>
      </div>
      <span style={{fontSize:12,color:"#b8c6be"}}>Студия: новости, турниры и зал славы. Сообщество: форум и FAQ. Игры: кнопка «Задания». Профиль: достижения, коллекция и админка. В сценарии итогов можно проверить зал славы.</span>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>{["Handjet","Tiny5"].map(name=><div key={name} style={{border:"1px solid #69786f",padding:12,borderRadius:8}}><small style={{fontFamily:"system-ui"}}>{name}</small><div style={{fontFamily:name,fontSize:24}}>Баланс 429 Йер · 01:28:59</div><div style={{fontFamily:name,fontSize:18}}>0123456789 · 1250 очков<br/>Тетрис · Редкая<br/>Цветные объёмные блоки и своя мелодия.</div></div>)}</div>
      <iframe key={scene+theme+size+revision+font} title="Мобильный стенд приложения" src={`/studio-preview.html?device=1&scene=${scene}&theme=${theme}&v=${revision}&font=${font}`}
        style={{width,height,maxWidth:"100%",flexShrink:0,margin:"8px auto 18px",display:"block",border:"2px solid #69786f",borderRadius:10,background:"#0b0b0c"}} />
    </div>
  </main>;
}
