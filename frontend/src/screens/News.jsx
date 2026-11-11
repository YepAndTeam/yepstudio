import DailyReward from "../components/DailyReward";
import TournamentBanner from "../components/TournamentBanner";
import { STAGES, ST, dayLabel } from "../constants";
import { useStore } from "../store";
import { Dot, Loading } from "../components/Common";
import { Chevron } from "../components/Icons";

export default function News({ openThread, tournamentId, onOpenTournament }) {
  const { home: h, me, loadMe } = useStore();
  if (!h) return <Loading />;

  return (
    <>
      <TournamentBanner compact eventId={tournamentId} onOpen={onOpenTournament} />
      <DailyReward userId={me?.id} reward={me?.daily_reward} refresh={loadMe} />
      {h.latest && (
        <div className="card banner">
          <span className="pt" />
          <div className="tx"><b>Последнее</b> · Идея «{h.latest.title}» от {h.latest.author} получила «Оценено»</div>
        </div>
      )}

      {h.projects.length > 0 && (
        <div className="card tail">
          <div className="between" style={{ paddingBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Проекты</h2>
            <span className="small muted">{h.projects.length}</span>
          </div>
          {h.projects.map((p) => (
            <div className="proj" key={p.id}>
              <div className="top">
                <span className="name">{p.name}</span>
                <span className="st small muted"><Dot status={p.status} />{ST[p.status] || ""}</span>
              </div>
              <div className="segs">{[0, 1, 2, 3].map((i) => <span key={i} className={i < p.stage ? "on" : ""} />)}</div>
              <div className="small muted">{p.stage ? STAGES[p.stage - 1] : "Ещё не начато"} · этап {p.stage} из 4</div>
            </div>
          ))}
        </div>
      )}

      {h.posts.map((p) => (
        <div className="card tail post" key={p.id}>
          <div className="date">{dayLabel(p.created_at)}</div>
          <h3>{p.title}</h3>
          <p>{p.text}</p>
          <button type="button" className="go" onClick={() => openThread("n" + p.id)}>
            <span>Комментарии · {p.comments}</span><Chevron />
          </button>
        </div>
      ))}

      {!h.projects.length && !h.posts.length && <div className="empty">Пока новостей нет.</div>}
    </>
  );
}
