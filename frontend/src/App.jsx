import StudioLoading from './components/StudioLoading';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { tg } from "./tg";
import Studio from "./screens/Studio";
import Community from "./screens/Community";
import Profile from "./screens/Profile";
import Thread from "./screens/Thread";
import Inbox from "./screens/Inbox";
import SocialHeartbeat from "./components/SocialHeartbeat";
import BackgroundMusic from "./components/BackgroundMusic";
import DiscGiftMail from "./components/DiscGiftMail";
import {api} from "./api";
import CompensationMail from "./components/CompensationMail";
import NewTopicSheet from "./components/NewTopicSheet";
import { Bell, NavForum, NavGame, NavNews, NavProfile } from "./components/Icons";
import Game from "./screens/Game";
import NyanRunner from "./components/NyanRunner";
const Yaabik=lazy(()=>import('./screens/Yaabik'));
const YaabikIcon=()=> <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V3m-1-1h2M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><rect x="6.5" y="8.5" width="11" height="8" rx="1.5" strokeWidth="1.2"/><path d="M1.5 11.5v4m21-4v4M8 20v2m8-2v2M10 14h4" strokeWidth="1.5"/><path d="M9 11h.1m5.8 0h.1" strokeWidth="2.5"/></svg>;
const TABS = [
  ["news", "Студия", <NavNews />],
  ["forum", "Сообщество", <NavForum />],
  ["yaabik", "Яабик", <YaabikIcon />],
  ["game", "Игры", <NavGame />],
  ["profile", "Профиль", <NavProfile />],
];

export default function App() {
const { loadHome, loadTopics, loadMe, loadUnread, notifs, theme, me, setThemeArea, syncEconomy, acknowledgeCompensation } = useStore();
  const [gameImmersive,setGameImmersive]=useState(false);
  const [tournamentId,setTournamentId]=useState(null);
  const [studioSection,setStudioSection]=useState(null);
  const [communitySection,setCommunitySection]=useState(null);
  const [friendTarget,setFriendTarget]=useState(null),[profileSection,setProfileSection]=useState(null);
  const [selectedGift,setSelectedGift]=useState(null),[giftDismissed,setGiftDismissed]=useState([]);
  const gifts=[...(me?.disc_gift?[{...me.disc_gift,target:"discs"}]:[]),...(me?.theme_gifts||[])];
  const gift=selectedGift?gifts.find(g=>g.id===selectedGift):gifts.find(g=>!g.claimed&&!giftDismissed.includes(me.id+":"+g.id));
  const closeGift=()=>{if(gift)setGiftDismissed(v=>[...v,me.id+":"+gift.id]);setSelectedGift(null);};
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
  useLayoutEffect(()=>{setThemeArea(thread||inbox?'shell':tab==='yaabik'?'yaabik':tab==='game'&&gameImmersive?'play':'shell');},[tab,thread,inbox,gameImmersive,setThemeArea]);
  const content = useRef(null);
  const saved = useRef(0);

  const scrollTo = (y) =>
    requestAnimationFrame(() => {
      if (content.current) content.current.scrollTop = y;
    });

  const go = (t) => {
    if(t==="news"){setTournamentId(null);setStudioSection(null);}
    setTab(t);
    setThread(null);
    setInbox(false);
    setGameRef(null);
    setProfileSection(null);setCommunitySection(null);setFriendTarget(null);
    scrollTo(0);
    if (t === "news") loadHome();
    if (t === "forum") loadMe(false);
    if (t === "profile") {
      loadMe(false);
    }
    loadUnread();
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

  // Keep content gestures from collapsing the Mini App on every screen.
  useEffect(()=>{
    const lock=()=>{try{if(!tg?.isVersionAtLeast||tg.isVersionAtLeast("7.7"))tg?.disableVerticalSwipes?.();}catch{}};
    const resume=()=>{if(!document.hidden)lock();};
    lock();tg?.onEvent?.("viewportChanged",lock);document.addEventListener("visibilitychange",resume);
    return()=>{tg?.offEvent?.("viewportChanged",lock);document.removeEventListener("visibilitychange",resume);};
  },[]);

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
  if(ref==="studio_yaabik"){setTab("yaabik");}
  else if(ref==="studio_home"){setTab("news");setStudioSection(null);}
  else if(ref==="studio_profile"){setTab("profile");setProfileSection(null);}
  else if(ref==="studio_friends"){setTab("forum");setCommunitySection("friends");}
  else if(ref==="studio_mail"){setTab("forum");setCommunitySection("letters");}
  else if(ref==="studio_tournaments"){setTab("news");setStudioSection("tournaments");}
  else if(ref==="studio_notifications"){setInbox(true);}
  else if(ref==="community_trading"){setTab("forum");setCommunitySection("trading");}
  else if (ref.startsWith("friend_") && /^friend_\d+$/.test(ref)){
    setTab("forum");setCommunitySection("friends");setFriendTarget(Number(ref.slice(7)));
  } else if (ref==="races") {
    setTab("news");setStudioSection("races");
  } else if (ref.startsWith("tour_")) {
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
      if (document.visibilityState === "visible") loadUnread();
    };
    const id = setInterval(tick, 60000);
    const resume=()=>{if(document.visibilityState==="visible"){void loadMe();tick();}};
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [loadUnread, loadMe]);

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
      <BackgroundMusic /><SocialHeartbeat userId={me?.id}/>
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
            <Inbox openMarket={()=>{setInbox(false);setThread(null);setTab("forum");setCommunitySection("trading");}} openFriends={()=>{setInbox(false);setTab("forum");setCommunitySection("friends");setFriendTarget(null);}} openThread={openThread} onBack={back} openRaces={()=>{setInbox(false);setThread(null);setTournamentId(null);setStudioSection("races");setTab("news");}} openGame={()=>{setInbox(false);setThread(null);setTab("game");setGameRef(null);}} />
          ) : tab === "news" ? (
            <Studio key={studioSection||"default"} initialSection={studioSection} openThread={openThread} tournamentId={tournamentId} onTournamentChange={setTournamentId} onPlay={id=>{setGameRef(id);setTab("game");}} />
          ) : tab === "forum" ? (
            <Community key={communitySection||"community"} initialSection={communitySection} targetId={friendTarget} onOpenLetter={setSelectedMail} onOpenGift={setSelectedGift}
              openThread={openThread}
              openSheet={() => setSheet(true)}
              cat={cat}
              setCat={setCat}
              sort={sort}
              setSort={setSort}
            />
          ) : tab === "yaabik" ? <Suspense fallback={<StudioLoading compact label="Яабик просыпается…"/>}><Yaabik key={me?.id||"guest"} onOpenGarden={()=>{setGameRef("garden_yaabik");setTab("game");}}/></Suspense> : tab === "game" ? <Game onImmersiveChange={setGameImmersive} initial={gameRef} onGardenBack={()=>setTab("yaabik")} />
            : (
            <Profile key={profileSection||"profile"} initialSection={profileSection} targetId={friendTarget} openThread={openThread} onOpenLetter={setSelectedMail} onOpenGift={setSelectedGift} />
          )}
        </div>
      </div>

      <nav>
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            data-tab={id}
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

      {!letter && gift && <DiscGiftMail key={gift.id} gift={gift} onLater={closeGift} onClaim={async()=>{if(!gift.claimed){const state=await api(gift.target==='themes'?'/shop/gift/'+gift.id+'/claim':'/discs/gift/claim','POST');syncEconomy(state);}closeGift();setTab('profile');setThread(null);setInbox(false);setProfileSection(gift.target==='themes'?'theme-box':'dvd');scrollTo(0);}}/>}

      {sheet && (
        <NewTopicSheet onClose={() => setSheet(false)} onCreated={onCreated} />
      )}
    </>
  );
}
