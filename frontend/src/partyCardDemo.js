import bunkerCharacters from './bunkerDemoCharacters.json' with {type:'json'};
// Fictional specimens only. Never uses a live room or another player’s role.
export function makeCardDemo(kind='mafia',role='civilian',phase=kind==='bunker'?'reveal':'discussion',now=Date.now()/1000){
 const names=['Ты','Айша','Данияр','Мира','Арсен','Соня','Тимур','Луна'];
 const players=names.map((name,i)=>({id:i+1,name,skin:['mint','classic','sunset'][i%3],theme:['dark','nyan','neon','tetris'][i%4],alive:true,role:i===0&&kind==='mafia'?role:null,traits:kind==='bunker'?(i===0?{...bunkerCharacters[i]}:{profession:bunkerCharacters[i].profession}):{},revealed:kind==='bunker'?['profession']:[]}));
 if(kind==='mafia'&&phase==='last_words')players[0].alive=false;
 if(role==='mafia'&&kind==='mafia')players[0].allies=[1,4];
 return {last_words_player_id:phase==='last_words'?1:null,can_send_last_words:kind==='mafia'&&phase==='last_words',code:'DEMO01',kind,host:1,status:'active',phase,day:1,deadline:now+(phase==='last_words'?30:105),server_now:now,capacity:8,seats:3,players,my_action:false,my_vote:null,votes_cast:0,candidates:[],messages:[{id:1,uid:4,name:'Мира',text:kind==='mafia'?'Давайте выслушаем каждого.':'Мой опыт может пригодиться убежищу.',at:now}],log:[{day:1,text:kind==='mafia'?'Город собрался за столом. У каждого своя история.':'Посмотри свои карточки. Чтение не раскрывает их остальным.'}],scenario:kind==='bunker'?{title:'Последний сигнал',disaster:'Связь с городом оборвалась. В убежище остались три места.',shelter:'Запасы воды, мастерская и радиорубка. Состав команды решите на совете.'}:null,winner:null};
}
