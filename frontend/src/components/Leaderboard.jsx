export default function Leaderboard({ title = "Таблица рекордов", data, meId }) {
  return (
    <div className="card tail">
      <div className="between" style={{ paddingBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
        {data?.my_rank && (
          <span className="small muted">ты #{data.my_rank}</span>
        )}
      </div>
      {data && !data.top.length && (
        <div className="noc">Пока никого. Стань первым.</div>
      )}
      {data?.top.map((r, i) => (
        <div className={`lb ${r.user_id === meId ? "me" : ""}`} key={r.user_id}>
          <span className="rk">{i + 1}</span>
          <span className="nm">{r.user_id === meId ? "Ты" : r.name}</span>
          <b>{r.best}</b>
        </div>
      ))}
    </div>
  );
}