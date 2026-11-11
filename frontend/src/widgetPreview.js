import html from '../../widgets/board.html?raw';
if(!import.meta.env.DEV)throw Error('Development preview only');
document.body.style.cssText='background:#151719;color:#eee;font:14px system-ui;margin:20px';
const root=document.getElementById('app');
root.innerHTML='<h2>Виджеты · локальный стенд</h2><p>Два личных чата с ботом. Выбери игру и игрока слева, прими приглашение справа. Тестовые данные; Telegram и сервер не вызываются.</p><button id="reset">Начать заново</button><div id="chats" style="display:flex;gap:20px;flex-wrap:wrap;margin-top:20px"></div>';
let invite=null,counter=0;
const users=[{id:1,name:'Алиса'},{id:2,name:'Бека'}],panes=[];
function state(uid){if(!invite)return {screen:'choose'};return {screen:'invitation',kind:invite.kind,incoming:uid===invite.to,name:users.find(u=>u.id!==uid).name,status:invite.status,delivery:'sent',game_id:invite.game,link:'https://t.me/yab_studio_bot?startapp=game_'+invite.kind+'_'+invite.game};}
function mockRuntime(){
 let events={},pending={},counter=0;
 window.TelegramWidget={chatData:'{"screen":"choose"}',ready(){},onEvent(name,fn){events[name]=fn;},request(action){return new Promise(resolve=>{const id=++counter;pending[id]=resolve;parent.postMessage({action,id},'*');});},openTelegramLink(link){document.getElementById('error').textContent='Открылась бы партия: '+link.split('startapp=')[1];}};
 window.addEventListener('message',event=>{if(event.source!==parent)return;const d=event.data;if(d.state){TelegramWidget.chatData=JSON.stringify(d.state);events.chatDataChanged?.();}if(d.id&&pending[d.id]){pending[d.id]({result:JSON.stringify(d.state||{error:d.error})});delete pending[d.id];}});
}
for(const user of users){
 const wrap=document.createElement('section');wrap.style.cssText='width:340px;max-width:100%';
 const heading=document.createElement('h3');heading.textContent=user.name+' · личный чат';wrap.appendChild(heading);
 const frame=document.createElement('iframe');frame.title='Виджет для '+user.name;frame.style.cssText='width:100%;height:560px;border:1px solid #506478;border-radius:14px;background:#203345';
 const palette='<style>:root{--tg-theme-text-color:#f3f4f5;--tg-theme-hint-color:#a5b4c2;--tg-theme-section-separator-color:#506478;--tg-theme-secondary-bg-color:#293e50;--tg-theme-button-color:#64b4e9;--tg-theme-button-text-color:#091c2a;--tg-theme-destructive-text-color:#ff938a}body{background:#203345}</style>';
 frame.srcdoc=html.replace('<script>',palette+'<script>('+mockRuntime.toString()+')();</script><script>');
 wrap.appendChild(frame);document.getElementById('chats').appendChild(wrap);panes.push({uid:user.id,frame,kind:null});
}
function post(pane,value,id){pane.frame.contentWindow.postMessage({...value,id},'*');}
window.addEventListener('message',event=>{
 const pane=panes.find(p=>p.frame.contentWindow===event.source);if(!pane)return;
 const {action,id}=event.data;if(typeof action!=='string')return;
 let view;
 if(action==='home'){pane.kind=null;view={screen:'choose'};}
 else if(action.startsWith('kind:')){pane.kind=action.split(':')[1];view={screen:'players',kind:pane.kind,page:0,pages:1,players:users.filter(u=>u.id!==pane.uid)};}
 else if(action.startsWith('invite:')){invite={from:pane.uid,to:Number(action.split(':')[1]),kind:pane.kind,status:'pending'};for(const p of panes)post(p,{state:state(p.uid)});view=state(pane.uid);}
 else if(action==='accept'){if(invite&&pane.uid===invite.to){invite.status='accepted';invite.game=invite.game||++counter;}for(const p of panes)post(p,{state:state(p.uid)});view=state(pane.uid);}
 else if(['decline','cancel'].includes(action)){if(invite)invite.status=action==='decline'?'declined':'cancelled';for(const p of panes)post(p,{state:state(p.uid)});view=state(pane.uid);}
 else view=state(pane.uid);
 post(pane,{state:view},id);
});
document.getElementById('reset').onclick=()=>{invite=null;for(const p of panes){p.kind=null;post(p,{state:{screen:'choose'}});}};
