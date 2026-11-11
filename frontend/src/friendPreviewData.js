export function makeFriendPreview(){
 let visible=true;
 const data={friends:[{id:2,name:'Бека',username:'beka',online:true}],incoming:[{id:3,name:'Пиксель',username:'pixel',online:false}],outgoing:[]};
 return (path,method,body)=>{
  if(path==='/presence')return {ok:true};
  if(path==='/presence/privacy'){if(method==='POST')visible=body.visible;return {visible};}
  if(path==='/friends')return {...data,show_online:visible};
  if(path.startsWith('/friends/search'))return {players:[{id:4,name:'Ретро',username:'retro'},{id:5,name:'Игрок 5',username:'player5'}]};
  const found=path.match(/^\/friends\/(\d+)\/(\w[\w-]*)$/);
  if(path.startsWith('/friends/player/'))return {id:Number(path.split('/').pop()),name:'Бека',username:'beka'};
  if(!found)return undefined;
  const id=Number(found[1]),action=found[2];
  if(action==='invite-game')return {id:'preview-invitation',status:'pending',delivery:'queued'};
  if(action==='accept'){const u=data.incoming.find(u=>u.id===id);if(u){data.incoming=data.incoming.filter(u=>u.id!==id);data.friends.push(u);}}
  if(action==='request'&&!data.outgoing.some(u=>u.id===id))data.outgoing.push({id,name:'Ретро',username:'retro',online:false});
  if(action==='remove')for(const key of ['friends','incoming','outgoing'])data[key]=data[key].filter(u=>u.id!==id);
  return {...data,show_online:visible};
 };
}
