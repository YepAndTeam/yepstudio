import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { tg } from "./tg";
import { THEME_IDS } from "./constants";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
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

  const loadMe = useCallback(() => run(async () => setMe(await api("/me"))), [run]);
  const loadHome = useCallback(() => run(async () => setHome(await api("/home"))), [run]);
  const loadTopics = useCallback(() => run(async () => setTopics(await api("/topics"))), [run]);
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
    await Promise.all([loadMe(), loadHome(), loadTopics(), loadNotifs()]);
  }, [loadMe, loadHome, loadTopics, loadNotifs]);

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

  const setTheme = (id) => {
    setThemeState(id);
    try {
      localStorage.setItem("yab_theme", id);
    } catch {}
    api("/me/theme", "POST", { theme: id }).catch(() => {});
  };

  const setPush = async (v) => {
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
      ref[0] === "t" ? loadTopics() : loadHome(),
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
    await loadTopics();
  };

  const patchTopic = async (id, body) => {
    await api(`/topics/${id}`, "PATCH", body);
    await loadTopics();
  };

  const deleteTopic = async (id) => {
    await api(`/topics/${id}`, "DELETE");
    await loadTopics();
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
    readNotifs,
    toggleMod,
    setTheme,
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