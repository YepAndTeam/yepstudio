import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { tg } from "./tg";
import Studio from "./screens/Studio";
import Community from "./screens/Community";
import Profile from "./screens/Profile";
import Thread from "./screens/Thread";
import Inbox from "./screens/Inbox";
import CompensationMail from "./components/CompensationMail";
import NewTopicSheet from "./components/NewTopicSheet";
import { Bell, NavForum, NavGame, NavNews, NavProfile } from "./components/Icons";
import Game from "./screens/Game";
import NyanRunner from "./components/NyanRunner";
const TABS = [
  ["news", "Студия", <NavNews />],
  ["forum", "Сообщество", <NavForum />],
  ["game", "Игры", <NavGame />],
  ["profile", "Профиль", <NavProfile />],
];

export default function App() {
const { loadHome, loadTopics, loadMe, loadNotifs, notifs, theme, me, acknowledgeCompensation } = useStore();
  const [tournamentId,setTournamentId]=useState(null);
  const [selectedMail,setSelectedMail]=useState(null);
  const [dismissedMail,setDismissedMail]=useState([]);
  const letters=me?.compensation_letters || [];
  const letter=selectedMail?letters.find(item=>item.id===selectedMail):letters.find(item=>!item.read&&!dismissedMail.includes(me.id+":"+item.id));
  const closeMail=()=>{if(letter)setDismissedMail(value=>[...value,me.id+":"+letter.id]);setSelectedMail(null);};
  const [tab, setTab] = useState("news");
  const [thread, setThread] = useState(null);
  const [inbox, setInbox] = useState(false);
  const [cat, setCat] = useState("Все");
  const [sort, setSort] = useState("new");
  const [sheet, setSheet] = useState(false);
const [gameRef, setGameRef] = useState(null);
  const content = useRef(null);
  const saved = useRef(0);

  const scrollTo = (y) =>
    requestAnimationFrame(() => {
      if (content.current) content.current.scrollTop = y;
    });

  const go = (t) => {
    if(t==="news")setTournamentId(null);
    setTab(t);
    setThread(null);
    setInbox(false);
    setGameRef(null);
    scrollTo(0);
    if (t === "news") loadHome();
    if (t === "forum") loadTopics();
    if (t === "profile") {
      loadMe();
      loadTopics();
    }
    loadNotifs();
  };

  const openThread = (ref) => {
    saved.current = content.current?.scrollTop ?? 0;
    setThread(ref);
    setInbox(false);
    scrollTo(0);
  };

  const back = () => {
    if (thread) {
      setThread(null);
      scrollTo(saved.current);
    } else if (inbox) {
      setInbox(false);
    }
  };

  // Telegram BackButton
  useEffect(() => {
    try {
      thread || inbox ? tg.BackButton.show() : tg.BackButton.hide();
    } catch {}
  }, [thread, inbox]);

  const backRef = useRef(back);
  backRef.current = back;

  useEffect(() => {
    const h = () => backRef.current();
    try {
      tg.BackButton.onClick(h);
    } catch {}
    return () => {
      try {
        tg.BackButton.offClick(h);
      } catch {}
    };
  }, []);

  // deep link
  useEffect(() => {
  const ref = tg?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get("ref");
  if (!ref) return;
  if (ref.startsWith("tour_")) {
    setTab("news");setGameRef(null);setTournamentId(ref.slice(5));
  } else if (ref.startsWith("game")) {
    setTab("game");
    setGameRef(ref.slice(5) || null);
  } else if (/^[tn]\d+$/.test(ref)) {
    setThread(ref);
  }
}, []);

  // обновление нотификаций
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") loadNotifs();
    };
    const id = setInterval(tick, 60000);
    const resume=()=>{if(document.visibilityState==="visible"){void loadMe();tick();}};
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [loadNotifs, loadMe]);

  const onCreated = () => {
    setSheet(false);
    setTab("forum");
    setThread(null);
    setCat("Все");
    setSort("new");
    scrollTo(0);
  };

  return (
    <>
      <header>
        <div className="logo">
          <span>YAB</span>
          <span className="o">STUDIO</span>
        </div>
        <button
          type="button"
          className="bell"
          aria-label="Уведомления"
          onClick={() => {
            setThread(null);
            setInbox(true);
            scrollTo(0);
          }}
        >
          <Bell />
          {notifs?.unread > 0 && (
            <b>{notifs.unread > 9 ? "9+" : notifs.unread}</b>
          )}
        </button>
      </header>

      <div id="content" className="scroll" ref={content}>
        <div className="page">
          {thread ? (
            <Thread key={thread} refId={thread} onBack={back} />
          ) : inbox ? (
            <Inbox openThread={openThread} onBack={back} openGame={()=>{setInbox(false);setThread(null);setTab("game");setGameRef(null);}} />
          ) : tab === "news" ? (
            <Studio openThread={openThread} tournamentId={tournamentId} onTournamentChange={setTournamentId} onPlay={id=>{setGameRef(id);setTab("game");}} />
          ) : tab === "forum" ? (
            <Community
              openThread={openThread}
              openSheet={() => setSheet(true)}
              cat={cat}
              setCat={setCat}
              sort={sort}
              setSort={setSort}
            />
          ) : tab === "game" ? <Game initial={gameRef} />
            : (
            <Profile openThread={openThread} onOpenLetter={setSelectedMail} />
          )}
        </div>
      </div>

      <nav>
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            className={tab === id && !inbox && !thread ? "on" : ""}
            onClick={() => go(id)}
          >
            <span className="pill">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {letter && <CompensationMail key={letter.id} letter={letter} onLater={closeMail} onRead={async()=>{await acknowledgeCompensation(letter.id);closeMail();}} />}

      {sheet && (
        <NewTopicSheet onClose={() => setSheet(false)} onCreated={onCreated} />
      )}
    </>
  );
}