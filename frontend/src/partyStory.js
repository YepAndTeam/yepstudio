import {bunkerRevealOrder} from './bunkerRevealOrder.js';
import {PARTY_TRAIT_LABELS} from './partyTraitLabels.js';
import bunkerCharacters from './bunkerDemoCharacters.json' with {type:'json'};
import {makeCardDemo} from './partyCardDemo.js';
export const STORY_STEPS=[
 {id:'arrival',phase:'lobby',day:0,seconds:6,title:'Игроки собираются',text:'Яабик-сценарист: все на месте. Сегодня у города будет своя история.'},
 {id:'deal',phase:'deal',day:1,seconds:8,title:'Выдача ролей',text:'Перед тобой личное дело. Переверни карту: сегодня ты Доктор.'},
 {id:'night1',phase:'night',day:1,seconds:14,title:'Первая ночь',text:'Город засыпает. Доктор, выбери, кого защитить. Действие — рядом с чатом.'},
 {id:'dawn1',phase:'dawn',day:1,seconds:6,title:'Первое утро',text:'Город просыпается. Яабики возвращаются к столу.'},
 {id:'talk1',phase:'discussion',day:1,seconds:14,title:'Обсуждение',text:'Выслушайте участников. Уверенный голос ещё не доказывает невиновность.'},
 {id:'vote1',phase:'vote',day:1,seconds:12,title:'Первое голосование',text:'Совет выбирает, кто покинет стол. Открой «Голос» рядом с чатом.'},
 {id:'verdict1',phase:'verdict',day:1,seconds:7,title:'Решение совета',text:'Большинство проголосовало против Арсена. Его роль — Мафия. Карта остаётся на столе.'},
 {id:'last1',phase:'last_words',day:1,seconds:6,title:'Последнее слово Арсена',text:'Перед новой ночью Арсен может оставить одно финальное сообщение.'},
 {id:'night2',phase:'night',day:2,seconds:14,title:'Вторая ночь',text:'Город снова засыпает. У оставшейся мафии всё ещё есть шанс.'},
 {id:'dawn2',phase:'dawn',day:2,seconds:6,title:'Второе утро',text:'Город просыпается. Не все вернулись к разговору.'},
 {id:'lastNight',phase:'last_words',day:2,seconds:6,title:'Последнее слово Сони',text:'Прежде чем начнётся совет, выбывшая может сказать последнее слово.'},
 {id:'talk2',phase:'discussion',day:2,seconds:10,title:'Последний совет',text:'Игроки сопоставляют слова и голоса. Подозрение падает на Тимура.'},
 {id:'vote2',phase:'vote',day:2,seconds:10,title:'Решающий голос',text:'Пора решить, кому верить. Большинство выбирает Тимура.'},
 {id:'verdict2',phase:'verdict',day:2,seconds:6,title:'Последнее раскрытие',text:'Тимур покидает стол. Его роль — Мафия. В городе больше нет мафии.'},
 {id:'last2',phase:'last_words',day:2,seconds:6,title:'Последнее слово Тимура',text:'Даже перед итогами последний выбывший может оставить одно сообщение.'},
 {id:'final',phase:'finished',day:2,seconds:8,title:'Город спасён',text:'Мирные жители победили. Теперь все роли открыты — можно обсудить партию.'}
];
const MAFIA_INDEX=Object.fromEntries(STORY_STEPS.map((s,i)=>[s.id,i]));
export function storyFrame(index,elapsed=0,choices={}){
 const step=STORY_STEPS[Math.max(0,Math.min(STORY_STEPS.length-1,index))],i=STORY_STEPS.indexOf(step),after=id=>i>=MAFIA_INDEX[id],at=1000+STORY_STEPS.slice(0,i).reduce((sum,s)=>sum+s.seconds,0)+elapsed;
 const room=makeCardDemo('mafia','doctor',step.phase,at);room.code='STORY1';room.day=step.day;room.status=step.phase==='lobby'?'lobby':step.phase==='finished'?'finished':'active';room.deadline=at+Math.max(0,step.seconds-elapsed);room.messages=[];room.players[0].role=i===0?null:'doctor';room.players[0].alive=true;room.can_send_last_words=false;room.last_words_player_id=null;
 const protect1=choices.night1??4,protect2=choices.night2??(protect1===4?4:2),earlyVictim=after('dawn1')&&protect1!==4,lateVictim=after('dawn2')&&protect2!==6;
 for(const p of room.players){
  if((p.id===4&&earlyVictim)||(p.id===6&&lateVictim)){p.alive=false;p.role='civilian';}
  if(p.id===5&&after('verdict1')){p.alive=false;p.role='mafia';}
  if(p.id===7&&after('verdict2')){p.alive=false;p.role='mafia';}
  if(step.phase==='finished')p.role=p.id===1?'doctor':p.id===3?'detective':[5,7].includes(p.id)?'mafia':'civilian';
 }
 room.winner=step.phase==='finished'?'civilian':null;
 const dawn1=earlyVictim?'Мира не пережила ночь. Её роль — Мирный житель. У неё есть последнее слово.':'Ночью мафия выбрала Миру, но доктор её защитил. Все живы.';
 const dawn2=lateVictim?'Соня не пережила ночь. Её роль — Мирный житель. На столе появляется её карта.':'Доктор защитил Соню. Этой ночью никто не погиб.';
 room.log=STORY_STEPS.slice(0,i+1).map(s=>({day:s.day,text:s.id==='dawn1'?dawn1:s.id==='dawn2'?dawn2:s.id==='lastNight'&&!lateVictim?'Этой ночью никто не погиб. Последнее слово не требуется.':s.text}));
 const add=(id,uid,text,age,lastWords=false)=>room.messages.push({id,uid,name:room.players.find(p=>p.id===uid).name,text,at:at-age,last_words:lastWords});
 if(step.id==='talk1'){if(elapsed>=1&&!earlyVictim)add(1,4,'Я была под защитой. Доктор, спасибо.',elapsed-1);if(elapsed>=4)add(2,3,'Я бы внимательно послушал Арсена.',elapsed-4);if(elapsed>=7)add(3,5,'С чего вдруг я? Давайте по порядку.',elapsed-7);}
 if(step.id==='talk2'){if(elapsed>=1)add(4,2,'Тимур почти не участвовал в обсуждении.',elapsed-1);if(elapsed>=4)add(5,7,'Молчание ещё ничего не значит.',elapsed-4);}
 let title=step.title,speaker=step.id==='last1'?5:step.id==='last2'?7:step.id==='lastNight'&&lateVictim?6:step.id==='dawn1'&&earlyVictim?4:null;
 if(speaker){room.phase='last_words';room.last_words_player_id=speaker;room.can_send_last_words=false;title='Последнее слово · '+room.players.find(p=>p.id===speaker).name;if(elapsed>=2)add('last-'+speaker,speaker,speaker===5?'Ладно, раскусили. Но напарника я не выдам.':speaker===7?'Ваш город победил. Увидимся в следующей партии.':'Я бы ещё раз присмотрелась к тем, кто слишком уверенно обвиняет.',elapsed-2,true);}
 else if(step.phase==='last_words'){room.phase='discussion';title='Все вернулись к столу';}
 if(step.phase==='night'){room.night_turn=elapsed<4?'mafia':elapsed<8?'detective':'doctor';room.night_turn_deadline=at+Math.max(0,(elapsed<4?4:elapsed<8?8:step.seconds)-elapsed);room.my_action=choices[step.id]!==undefined||elapsed>=10;room.my_action_kind=room.my_action?'heal':null;room.cinematic_cue=elapsed>=6?step.id+':check':elapsed>=3?step.id+':shot':null;}
 if(step.phase==='vote'){room.my_vote=choices[step.id]??(elapsed>=7?(step.id==='vote1'?5:7):null);room.votes_cast=Math.min(room.players.filter(p=>p.alive).length,Math.floor(elapsed/2)+(room.my_vote?1:0));}
 const autoPick=step.phase==='night'&&room.my_action?(step.day===1?protect1:protect2):step.phase==='vote'?room.my_vote:null;
 return {room,step:{...step,title},index:i,autoPick,secondsLeft:Math.max(0,Math.ceil(step.seconds-elapsed)),progress:(i+Math.min(1,elapsed/step.seconds))/STORY_STEPS.length};
}

export const BUNKER_STEPS=[
 {id:'arrival',phase:'lobby',day:0,seconds:6,title:'У дверей убежища',text:'Яабик-сценарист: связь с городом оборвалась. Шестеро добрались до убежища.'},
 {id:'briefing',phase:'briefing',day:0,seconds:7,title:'Что случилось снаружи',text:'На поверхности −60 °C. В убежище три места. Решите, какой состав сможет пережить зиму.'},
 {id:'deal',phase:'deal',day:1,seconds:8,title:'Твоё досье',text:'У каждого восемь разделов личного дела. Профессии уже открыты, остальные карточки пока личные.'},
 {id:'talk1',phase:'discussion',day:1,seconds:10,title:'Первое знакомство',text:'Расскажите, чем сможете помочь. Сейчас на столе только профессии.'},
 {id:'reveal1',phase:'reveal',day:1,seconds:12,title:'Первая открытая карточка',text:'Сценарист выбирает общий раздел для раскрытия. Прочитать карточку и раскрыть её — разные действия.'},
 {id:'talk2',phase:'discussion',day:1,seconds:8,title:'Первый совет',text:'Обсудите новые сведения. Карточки лежат перед их владельцами, их можно рассмотреть.'},
 {id:'vote1',phase:'vote',day:1,seconds:10,title:'Первое голосование',text:'В этой демопартии большинство выбирает Соню. Твой голос можно отдать через нижнюю панель.'},
 {id:'out1',phase:'verdict',day:1,seconds:6,title:'Первый выход',text:'Соня покидает совет и становится зрителем. Её открытые карточки остаются на столе.'},
 {id:'reveal2',phase:'reveal',day:2,seconds:10,title:'Следующая характеристика',text:'Оставшиеся открывают ещё по одной карточке. Состав убежища становится понятнее.'},
 {id:'talk3',phase:'discussion',day:2,seconds:8,title:'Новый круг совета',text:'Пять участников, три места. Нужны люди, которые смогут действовать вместе.'},
 {id:'vote2',phase:'vote',day:2,seconds:10,title:'Второе голосование',text:'Большинство голосует против Арсена. Это пример хода партии, а не оценка полезности профессий.'},
 {id:'out2',phase:'verdict',day:2,seconds:6,title:'Осталось четверо',text:'Арсен наблюдает за советом. Остался последний выбор.'},
 {id:'reveal3',phase:'reveal',day:3,seconds:10,title:'Последнее раскрытие',text:'Сценарист объявляет ещё один раздел. Новые сведения могут изменить мнение участников.'},
 {id:'vote3',phase:'vote',day:3,seconds:10,title:'Последнее голосование',text:'Айша соглашается остаться у наружного ретранслятора. Совет делает последний выбор.'},
 {id:'out3',phase:'verdict',day:3,seconds:6,title:'Места распределены',text:'За столом остались ты, Данияр и Мира. Для этой команды начинается жизнь в убежище.'},
 {id:'final',phase:'finished',day:3,seconds:8,title:'Дверь закрывается',text:'Совет завершён. Оставшиеся занимают три места в убежище.'}
];
const BUNKER_INDEX=Object.fromEntries(BUNKER_STEPS.map((s,i)=>[s.id,i]));
export function bunkerStoryFrame(index,elapsed=0,choices={}){
 const step=BUNKER_STEPS[Math.max(0,Math.min(BUNKER_STEPS.length-1,index))],i=BUNKER_STEPS.indexOf(step),after=id=>i>=BUNKER_INDEX[id],at=1000+BUNKER_STEPS.slice(0,i).reduce((sum,s)=>sum+s.seconds,0)+elapsed;
 const order=bunkerRevealOrder(choices.__scriptSeed||0);
 const room=makeCardDemo('bunker','civilian',step.phase,at);room.code='BUNKER1';room.players=room.players.slice(0,6);room.capacity=6;room.seats=3;room.day=step.day;room.messages=[];room.status=['lobby','briefing'].includes(step.phase)?'lobby':step.phase==='finished'?'finished':'active';room.deadline=at+Math.max(0,step.seconds-elapsed);room.winner=step.phase==='finished'?'survivors':null;
 room.scenario={title:'Белая тишина',disaster:'Климатический сбой: на поверхности −60 °C, связь с городами потеряна. Трое смогут остаться в убежище.',shelter:'Геотермальный узел, мастерская, радиорубка и вода на год. Запасы придётся беречь.'};
 for(const [n,p] of room.players.entries()){
  p.alive=!(p.id===6&&after('out1')||p.id===5&&after('out2')||p.id===2&&after('out3'));p.revealed=after('deal')?['profession']:[];
  if(n===0)p.traits={...bunkerCharacters[n]};
  else p.traits=after('deal')?{profession:p.traits.profession}:{};
  for(const [round,defaultKey] of [['reveal1',order[0]],['reveal2',order[1]],['reveal3',order[2]]]){
   const cutoff=round==='reveal2'&&p.id===6||round==='reveal3'&&[5,6].includes(p.id);
   const reveal=after(round)&&!cutoff&&(step.id!==round||elapsed>=2+n||n===0&&choices[round]!==undefined);
   if(!reveal)continue;let key=defaultKey;
   if(n===0&&p.revealed.includes(key))key=Object.keys(p.traits).find(k=>!p.revealed.includes(k))||key;
   if(!p.revealed.includes(key))p.revealed.push(key);
   if(n!==0)p.traits[key]=bunkerCharacters[n][key];
  }
 }
 room.log=BUNKER_STEPS.slice(0,i+1).map(s=>({day:s.day,text:s.text}));
 const add=(id,uid,text)=>room.messages.push({id,uid,name:room.players.find(p=>p.id===uid).name,text,at:at-1});
 if(step.id==='talk1'&&elapsed>=2)add('b1',4,'Я могу помочь с выходами и аварийной связью.');
 if(step.id==='talk2'&&elapsed>=2)add('b2',3,'Вода важна. Я знаю, как её очищать.');
 if(step.id==='talk3'&&elapsed>=2)add('b3',2,'Нужно подумать о здоровье всей команды, а не только о себе.');
 if(step.phase==='reveal'){room.reveal_trait=order[['reveal1','reveal2','reveal3'].indexOf(step.id)];room.my_action=choices[step.id]===room.reveal_trait||elapsed>=2;room.log.push({day:step.day,text:'Яабик-сценарист: откройте карточку «'+PARTY_TRAIT_LABELS[room.reveal_trait]+'». У всех один раздел.'});}
 const voteTarget=step.id==='vote1'?6:step.id==='vote2'?5:2;
 if(step.phase==='vote'){room.my_vote=choices[step.id]??(elapsed>=6?voteTarget:null);room.votes_cast=Math.min(room.players.filter(p=>p.alive).length,Math.floor(elapsed/2)+(room.my_vote?1:0));}
 return {room,step,index:i,autoPick:step.phase==='vote'?room.my_vote:null,secondsLeft:Math.max(0,Math.ceil(step.seconds-elapsed)),progress:(i+Math.min(1,elapsed/step.seconds))/BUNKER_STEPS.length};
}
