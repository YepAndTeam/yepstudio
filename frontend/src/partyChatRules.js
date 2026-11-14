export function partyChatState(room,me){
 if(!room||!me)return {allowed:false,placeholder:'Режим зрителя'};
 if(room.status==='cancelled')return {allowed:false,placeholder:'Комната закрыта'};
 if(room.status==='active'&&room.phase==='last_words')return {allowed:room.can_send_last_words===true&&room.last_words_player_id===me.id,placeholder:room.can_send_last_words&&room.last_words_player_id===me.id?'Твоё последнее слово…':'Сейчас последнее слово выбывшего'};
 if(room.status==='active'&&!me.alive)return {allowed:false,placeholder:'Ты наблюдаешь'};
 if(room.status==='active'&&room.phase==='night')return {allowed:false,placeholder:'Город спит…'};
 return {allowed:true,placeholder:'Скажи за столом…'};
}
