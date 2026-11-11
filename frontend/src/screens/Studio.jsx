import { useState } from "react";
import News from "./News";
import TournamentList from "../components/TournamentList";
import TournamentBanner from "../components/TournamentBanner";
import HallOfFame from "../components/HallOfFame";
import Races from "./Races";
export default function Studio({openThread,tournamentId,onTournamentChange,onPlay,initialSection}){
 const [section,setSection]=useState(initialSection || (tournamentId?"tournaments":"news"));
 const open=id=>{onTournamentChange(id);setSection("tournaments");};
 return <><h2>Студия</h2><div className="filters"><div className="seg studio-segments">{[["news","Новости"],["tournaments","Турниры"],["races","Скачки"],["hall","Зал славы"]].map(([id,label])=><button key={id} className={section===id?"on":""} onClick={()=>{setSection(id);onTournamentChange(null);}}>{label}</button>)}</div></div>
 {section==="news"&&<News openThread={openThread} onOpenTournament={open}/>}
 {section==="tournaments"&&(tournamentId?<><button className="back" onClick={()=>onTournamentChange(null)}>‹ Все турниры</button><TournamentBanner key={tournamentId} eventId={tournamentId} onPlay={onPlay}/></>:<TournamentList onOpen={open}/>)}
 {section==="races"&&<Races/>}
 {section==="hall"&&<HallOfFame onOpen={open}/>}</>;
}
