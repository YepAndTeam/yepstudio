import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store";
import { THEMES } from "./constants";
import { installStudioPreview } from "./studioPreviewData";
import "./styles.css";

if(!import.meta.env.DEV)throw Error("Local preview is development-only");
const params=new URLSearchParams(location.search);
const inside=params.get("device")==="1";
if(inside){
  const theme=params.get("theme") || "dark";
  installStudioPreview(params.get("scene") || "registration",theme);
  document.documentElement.dataset.theme=theme;
  try{localStorage.setItem("yab_theme",theme);}catch{}
  createRoot(document.getElementById("app")).render(<StoreProvider><App /></StoreProvider>);
}else{
  createRoot(document.getElementById("app")).render(<PreviewShell />);
}
function PreviewShell(){
  const [scene,setScene]=useState("registration"),[theme,setTheme]=useState("dark"),[size,setSize]=useState("360x640"),[revision,setRevision]=useState(0);
  const [width,height]=size.split("x").map(Number);
  return <main style={{width:"100%",height:"100dvh",overflow:"auto",padding:12,boxSizing:"border-box",background:"#161a1a",color:"#eee",fontFamily:"system-ui"}}>
    <div style={{maxWidth:1000,margin:"0 auto",display:"flex",flexDirection:"column",gap:10}}>
      <b>YAB STUDIO · локальный стенд</b>
      <span style={{fontSize:12,color:"#b8c6be"}}>Настоящие экраны приложения, тестовые данные. Регистрация, баланс и запуск меняются только здесь.</span>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        <label style={{fontSize:12}}>Сценарий <select value={scene} onChange={e=>setScene(e.target.value)}>
          <option value="registration">Бесплатная регистрация</option><option value="active">Турнир идёт</option><option value="finished">Итоги и голосование</option><option value="paid">Платная регистрация</option><option value="empty">Пусто — создать в админке</option><option value="letter">Письмо — 5 игр</option>
        </select></label>
        <label style={{fontSize:12}}>Тема <select value={theme} onChange={e=>setTheme(e.target.value)}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label style={{fontSize:12}}>Экран <select value={size} onChange={e=>setSize(e.target.value)}><option value="320x568">320 × 568</option><option value="360x640">360 × 640</option><option value="390x844">390 × 844</option><option value="430x932">430 × 932</option></select></label>
        <button type="button" onClick={()=>setRevision(v=>v+1)}>Начать заново</button>
        <a href="/tournament-dino.png" target="_blank" rel="noreferrer" style={{color:"#edbe63",fontSize:12}}>Обложка для Telegram</a>
      </div>
      <span style={{fontSize:12,color:"#b8c6be"}}>В телефоне: «Новости» — баннер и переход в турнир; регистрация в «Игра → Состязания». «Профиль» — создание, запуск, отмена и тестовый кошелёк. Для конверта выбери сценарий письма и экран 320 × 568.</span>
      <iframe key={scene+theme+size+revision} title="Мобильный стенд приложения" src={`/studio-preview.html?device=1&scene=${scene}&theme=${theme}&v=${revision}`}
        style={{width,height,maxWidth:"100%",flexShrink:0,margin:"8px auto 18px",display:"block",border:"2px solid #69786f",borderRadius:10,background:"#0b0b0c"}} />
    </div>
  </main>;
}
