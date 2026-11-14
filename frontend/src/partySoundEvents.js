export function partySoundSnapshot(room,viewerId){
 const me=room.players.find(p=>p.id===viewerId);
 return {identity:room.code+':'+viewerId,kind:room.kind,phase:room.phase,day:room.day,turn:room.night_turn,alive:room.players.filter(p=>p.alive).map(p=>p.id),action:room.my_action,mode:room.my_action_kind,role:me?.role,vote:room.my_vote,cue:room.cinematic_cue,messageIds:room.messages?.map(m=>m.id)||[],foreignMessages:room.messages?.filter(m=>m.uid!==viewerId).map(m=>m.id)||[]};
}
export function partySoundEvents(before,after){
 if(!before||before.identity!==after.identity)return [];
 const events=[];
 if((after.foreignMessages||[]).some(id=>!(before.messageIds||[]).includes(id)))events.push('chat');
 if(after.kind==='mafia'){
  if(before.phase==='night'&&after.phase!=='night')events.push(before.alive.some(id=>!after.alive.includes(id))?'death':'safe');
  else if(after.phase==='night'&&(before.phase!=='night'||before.day!==after.day))events.push('night');
  else if(after.phase==='night'&&before.turn!==after.turn)events.push('turn');
  if(after.phase==='night'&&!before.action&&after.action)events.push(after.mode==='shoot'||after.role==='mafia'?'shot':after.role==='doctor'?'heal':'check');
  if(after.cue&&before.cue!==after.cue)events.push(after.cue.split(':')[1]);
 }else if(before.phase!==after.phase)events.push(after.phase==='reveal'?'paper':'turn');
 if(after.vote&&after.vote!==before.vote)events.push('vote');
 if(after.phase==='finished'&&before.phase!=='finished')events.push('finish');
 return [...new Set(events)];
}
