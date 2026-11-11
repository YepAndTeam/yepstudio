import { useState } from "react";
import { createRoot } from "react-dom/client";
import CompensationMail from "./components/CompensationMail";
import { THEMES } from "./constants";
import "./styles.css";

const letter={id:"demo",created_at:"2026-11-11T07:00:00Z",read:false,total:185,target_total:225,previous_total:40,
  entries:[
    {game:"dino",score:1250,place:1,target:100,already_paid:40,credit:60},
    {game:"flappy",score:35,place:3,target:75,already_paid:0,credit:75},
    {game:"snake",score:90,place:5,target:50,already_paid:0,credit:50},
  ]};
function Preview(){
  const [show,setShow]=useState(false);
  const [theme,setTheme]=useState("dark");
  const [replay,setReplay]=useState(0);
  return <main className="page" style={{padding:24,overflow:"auto",gap:18}}>
    <div className="card col" style={{gap:14}}>
      <span className="small muted">YAB STUDIO · ЛОКАЛЬНАЯ ПРОВЕРКА</span>
      <h2>Письмо с компенсацией</h2>
      <p style={{margin:0}}>Та же анимация, что в приложении. Здесь выдуманный чек и никаких начислений.</p>
      <label className="col" style={{gap:6}}>Тема
        <select value={theme} onChange={e=>{setTheme(e.target.value);document.documentElement.dataset.theme=e.target.value;}}
          style={{padding:10,background:"var(--card2)",color:"var(--fg)",border:"1px solid var(--line)",borderRadius:4}}>
          {THEMES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" className="pub" onClick={()=>{setReplay(value=>value+1);setShow(true);}}>Запустить анимацию</button>
      <span className="small muted">Открой конверт и нажми «Спасибо, получил!». Затем можно запустить снова. Для вида телефона сузь окно браузера.</span>
    </div>
    {show&&<CompensationMail key={replay} letter={letter} onLater={()=>setShow(false)} onRead={async()=>setShow(false)} />}
  </main>;
}
createRoot(document.getElementById("app")).render(<Preview />);
