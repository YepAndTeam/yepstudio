import catalog from '../../disc_catalog.json';
const KEY='yab_dvd_preview_v1';
export function makeDiscPreview(me){
 let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}
 if(!state||!Array.isArray(state.draws)||!Array.isArray(state.collection))state={balance:me.jera,draws:[],collection:[],requests:{}};
 state.gift??={claimed:false,activated:false,remaining:0};
 const giftView=()=>({id:"dvd-launch-usb-v1",total:10,...state.gift});
 me.disc_gift=giftView();
 me.jera=state.balance;
 const params=new URLSearchParams(location.search),now=()=>new Date().toISOString();
 const save=()=>{me.disc_gift=giftView();me.jera=state.balance;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}};
 const view=row=>{const value={id:row.id,item:catalog.discs.find(item=>item.id===row.disc_id),serial:row.id.slice(0,8).toUpperCase(),price:row.price??catalog.price,free:row.price===0,created_at:row.created_at,revealed:row.revealed};if(row.revealed)Object.assign(value,{rarity:row.rarity,copy_number:row.copy_number,is_dupe:row.copy_number>1,revealed_at:row.revealed_at});return value;};
 return function handle(path,method,body){
  if(path==='/discs/gift/claim'&&method==='POST'){state.gift.claimed=true;save();return {balance:state.balance,launch_gift:giftView()};}
  if(path==='/discs/gift/activate'&&method==='POST'){if(!state.gift.claimed)throw Error('Сначала забери флешку');if(!state.gift.activated){state.gift.activated=true;state.gift.remaining=10;}save();return {balance:state.balance,launch_gift:giftView()};}
  if(path==='/discs')return {launch_gift:giftView(),price:catalog.price,balance:state.balance,catalogue:catalog.discs,rarities:catalog.rarities.map(({weight:_weight,...rest})=>rest),pending:state.draws.find(row=>!row.revealed)?view(state.draws.find(row=>!row.revealed)):null,collection:state.collection.map(row=>({...row,item:catalog.discs.find(item=>item.id===row.disc_id)})),total_copies:state.collection.reduce((sum,row)=>sum+row.quantity,0),unique_editions:state.collection.length,total_editions:catalog.discs.length*catalog.rarities.length,history:state.draws.filter(row=>row.revealed).slice().reverse().slice(0,20).map(view)};
  if(path==='/discs/open'&&method==='POST'){
   let row=state.draws.find(row=>row.id===state.requests[body.request_id])||state.draws.find(row=>!row.revealed);
   if(!row){
    const price=state.gift.activated&&state.gift.remaining>0?0:catalog.price;
    if(state.balance<price)throw Error('Не хватает тестовых Йер');
    const disc=catalog.discs.find(item=>item.id===params.get('disc_id'))||catalog.discs[Math.floor(Math.random()*catalog.discs.length)];
    let rarity=catalog.rarities.find(item=>item.id===params.get('disc_rarity'));
    if(!rarity){let roll=Math.random()*100;rarity=catalog.rarities.find(item=>{roll-=item.chance;return roll<0;})||catalog.rarities[0];}
    if(!price)state.gift.remaining--;state.balance-=price;row={price,id:crypto.randomUUID().replaceAll('-',''),disc_id:disc.id,rarity:rarity.id,created_at:now(),revealed:false};state.draws.push(row);
   }
   state.requests[body.request_id]=row.id;save();return {draw:view(row),balance:state.balance,launch_gift:giftView()};
  }
  const match=path.match(/^\/discs\/([^/]+)\/reveal$/);
  if(match&&method==='POST'){
   const row=state.draws.find(row=>row.id===match[1]);if(!row)throw Error('Тестовый диск не найден');
   if(!row.revealed){let copy=state.collection.find(copy=>copy.disc_id===row.disc_id&&copy.rarity===row.rarity);if(copy)copy.quantity++;else{copy={disc_id:row.disc_id,rarity:row.rarity,quantity:1,first_found_at:now()};state.collection.push(copy);}row.copy_number=copy.quantity;row.revealed=true;row.revealed_at=now();save();}
   return {draw:view(row),balance:state.balance,launch_gift:giftView()};
  }
 };
}
