export default function CassetteSeal({id}){
 const rarity=id==="poop"?"mythic":["nyan","tetris"].includes(id)?"rare":["dark","light"].includes(id)?"base":"common";
 return <div className={`cassette-seal seal-${rarity}`} aria-label={{mythic:"Мифическая печать: Золотой смыв",rare:"Редкая запись",common:"Обычная запись",base:"Базовая запись"}[rarity]}>
  <svg viewBox="0 0 40 40" aria-hidden="true">
   {rarity==="mythic"?<><path className="seal-outline" d="m20 2 5 4 6 1 2 6 5 7-5 7-2 6-6 1-5 4-5-4-6-1-2-6-5-7 5-7 2-6 6-1Z"/><path d="M12 9l4 3 4-5 4 5 4-3-2 7H14z"/><path d="M12 20h16v4c0 5-4 7-8 7s-8-2-8-7zm6 11h4v4h-4z"/><path d="M13 18h14v2H13z"/></>:rarity==="rare"?<><path className="seal-outline" d="M20 3 37 20 20 37 3 20Z"/><path d={id==="tetris"?"M17 10h7v7h7v7H10v-7h7z":"m20 9 3 7 8 1-6 6 2 8-7-4-7 4 2-8-6-6 8-1z"}/><path d="M6 5h2v6H6zm-2 2h6v2H4z"/></>:<><circle className="seal-outline" cx="20" cy="20" r="16"/><path d="M13 12h5v16h-5zm9 0h5v16h-5z"/><path d="M18 17h4v6h-4z"/></>}
  </svg><span>{rarity==="mythic"?"GOLDEN FLUSH":rarity==="rare"?"RARE EDITION":rarity==="base"?"STUDIO BASIC":"STUDIO ORIGINAL"}</span>
 </div>;
}
