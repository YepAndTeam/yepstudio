import StudioLoading from './StudioLoading';
export default function Leaderboard({ title = "Таблица рекордов", data, meId,failed=false }) {
  if(!data&&failed)return <div className="card small" role="status">Не удалось загрузить рекорды. Попробуй обновить таблицу.</div>;
  if(!data)return <StudioLoading compact label="Загружаем рекорды…"/>;
  const discMode=data?.mode==='disc';
  return (
    <div className="card tail">
      <div className="between" style={{ paddingBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{discMode?'Рекорды с дисками':title}</h3>
        {data?.my_rank && (
          <span className="small muted">ты #{data.my_rank}</span>
        )}
      </div>
<p className="small muted">{discMode?"Отдельная таблица режима с модификаторами. Общие рекорды и турниры не меняются.":""}</p>
      {data && !data.top.length && (
        <div className="noc">Пока никого. Стань первым.</div>
      )}
      {data?.top.map((r, i) => (
        <div className={`lb ${r.user_id === meId ? "me" : ""}`} key={r.user_id}>
          <span className="rk">{r.place ?? i + 1}</span>
          <span className="nm">{r.user_id === meId ? "Ты" : r.name}</span>
          <b>{r.best}</b>
        </div>
      ))}
    </div>
  );
}