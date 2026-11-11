import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import {createReadCache} from "./readCache";
import { tg } from "./tg";
import { THEME_IDS } from "./constants";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const meRevision=useRef(0);
  const reads=useRef(null);if(!reads.current)reads.current=createReadCache(path=>api(path));
  const [me, setMe] = useState(null);
  const [home, setHome] = useState(null);
  const [topics, setTopics] = useState(null);
  const [comments, setComments] = useState({});
  const [error, setError] = useState(null);
  const [notifs, setNotifs] = useState({ unread: 0, items: [] });
  const [mod, setMod] = useState(() => {
    try {
      return localStorage.getItem("yab_mod") !== "0";
    } catch {
      return true;
    }
  });

  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("yab_theme");
      if (THEME_IDS.includes(saved)) return saved;
    } catch {}
    return tg?.colorScheme === "light" ? "light" : "dark";
  });

  const run = useCallback(async (fn) => {
    try {
      await fn();
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
  }, []);

  const loadMe = useCallback((force=true) => run(async () => {const revision=++meRevision.current;const value=await reads.current("/me",{force});if(revision!==meRevision.current)return;setMe(value);if(value.unread_notifications!==undefined)setNotifs(n=>({...n,unread:value.unread_notifications}));}), [run]);
  const loadHome = useCallback((force=false) => run(async () => setHome(await reads.current("/home",{force,maxAge:30000}))), [run]);
  const loadTopics = useCallback((force=false) => run(async () => setTopics(await reads.current("/topics",{force}))), [run]);
  const loadComments = useCallback(
    (ref) =>
      run(async () => {
        const data = await api("/comments?ref=" + ref);
        setComments((c) => ({ ...c, [ref]: data }));
      }),
    [run]
  );

  const loadNotifs = useCallback(
    () => run(async () => setNotifs(await api("/notifications"))),
    [run]
  );

  const loadUnread=useCallback(()=>run(async()=>{const data=await api("/notifications/unread");setNotifs(n=>({...n,unread:data.unread}));}),[run]);

  const readNotifs = async () => {
    setNotifs((n) => ({
      unread: 0,
      items: n.items.map((i) => ({ ...i, read: true })),
    }));
    try {
      await api("/notifications/read", "POST");
    } catch {}
  };

  const boot = useCallback(async () => {
    setError(null);
    await Promise.all([loadMe(false), loadHome()]);
  }, [loadMe, loadHome]);

  useEffect(() => {
    boot();
  }, [boot]);

  // применяем тему
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // если на сервере есть тема — берём её
  useEffect(() => {
    if (me?.theme && THEME_IDS.includes(me.theme)) {
      setThemeState(me.theme);
      try {
        localStorage.setItem("yab_theme", me.theme);
      } catch {}
    }
  }, [me?.theme]);

  const syncEconomy = useCallback((state) => {
    meRevision.current++;reads.current.invalidate('/me');
    setMe(value=>value?{...value,jera:state.balance ?? value.jera,owned_themes:state.owned_themes ?? value.owned_themes}:value);
  },[]);

  const acknowledgeCompensation = useCallback(async (id) => {
    meRevision.current++;reads.current.invalidate('/me');
    await api("/me/compensation/"+encodeURIComponent(id)+"/read","POST");
    setMe(value=>value?{...value,compensation_letters:(value.compensation_letters || []).map(letter=>letter.id===id?{...letter,read:true}:letter)}:value);
  },[]);

  const setTheme = async (id) => {
    meRevision.current++;reads.current.invalidate('/me');
    if (!me?.owned_themes?.includes(id)) {
      setError("Эта тема ещё не получена");return false;
    }
    try {
      await api("/me/theme", "POST", { theme: id });
      setThemeState(id);setMe(value=>({...value,theme:id}));
      try { localStorage.setItem("yab_theme",id); } catch {}
      return true;
    } catch(e){setError(e.message);return false;}
  };

  const setPush = async (v) => {
    meRevision.current++;reads.current.invalidate('/me');
    setMe((x) => ({ ...x, notify: v }));
    try {
      await api("/me/notify", "POST", { push: v });
    } catch {
      loadMe();
    }
  };

  const toggleMod = () =>
    setMod((m) => {
      const next = !m;
      try {
        localStorage.setItem("yab_mod", next ? "1" : "0");
      } catch {}
      return next;
    });

  /* ---- действия ---- */
  const sendComment = async (ref, text, parent_id) => {
    await api("/comments", "POST", { ref, text, parent_id: parent_id || null });
    await Promise.all([
      loadComments(ref),
      ref[0] === "t" ? loadTopics(true) : loadHome(true),
    ]);
  };

  const react = async (ref, id, type) => {
    setComments((all) => ({
      ...all,
      [ref]: (all[ref] || []).map((c) => {
        if (c.id !== id) return c;
        let { likes, dislikes, my } = c;
        if (my === type) {
          type === "like" ? likes-- : dislikes--;
          my = null;
        } else {
          if (my === "like") likes--;
          if (my === "dislike") dislikes--;
          type === "like" ? likes++ : dislikes++;
          my = type;
        }
        return { ...c, likes, dislikes, my };
      }),
    }));
    try {
      await api(`/comments/${id}/react`, "POST", { value: type });
    } catch (e) {
      loadComments(ref);
      throw e;
    }
  };

  const voteTopic = async (id) => {
    setTopics((ts) =>
      ts.map((t) =>
        t.id === id
          ? { ...t, voted: !t.voted, votes: t.votes + (t.voted ? -1 : 1) }
          : t
      )
    );
    try {
      await api(`/topics/${id}/vote`, "POST");
    } catch (e) {
      loadTopics();
      throw e;
    }
  };

  const createTopic = async (data) => {
    await api("/topics", "POST", data);
    await loadTopics(true);
  };

  const patchTopic = async (id, body) => {
    await api(`/topics/${id}`, "PATCH", body);
    await loadTopics(true);
  };

  const deleteTopic = async (id) => {
    await api(`/topics/${id}`, "DELETE");
    await loadTopics(true);
  };

  const value = {
    me,
    home,
    topics,
    comments,
    error,
    mod,
    notifs,
    theme,
    isMod: !!(me && me.role === "admin" && mod),
    boot,
    loadMe,
    loadHome,
    loadTopics,
    loadComments,
    loadNotifs,
    loadUnread,
    readNotifs,
    toggleMod,
    setTheme,
    syncEconomy,
    acknowledgeCompensation,
    setPush,
    sendComment,
    react,
    voteTopic,
    createTopic,
    patchTopic,
    deleteTopic,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
