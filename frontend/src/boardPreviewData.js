// Shared spectator fixtures. Production routes independently enforce player-only moves.
export function boardPreview(path,method){
 const kind=path.split('/')[1];if(!['chess','checkers'].includes(kind))return undefined;
 if(method!=='GET')throw Error('На стенде доступен просмотр чужой партии без права хода');
 const brief={id:99,status:'active',result:null,my:null,turn:'w',moves:0,opponent:null,creator_id:2,creator:'Бека',white_name:'Бека',black_name:'Игрок 3',updated_at:new Date().toISOString()};
 if(path==='/'+kind)return {mine:[],lobby:[],live:[brief]};
 const state={...brief,white:{id:2,name:'Бека'},black:{id:3,name:'Игрок 3'},moves:[],last:null,legal:[],opp_away:false,must_capture:false,check:false,fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',board:{}};
 for(let rank=1;rank<=8;rank++)for(let file=0;file<8;file++)if((rank+file)%2===0&&(rank<=3||rank>=6))state.board['abcdefgh'[file]+rank]=rank<=3?'w':'b';
 return state;
}
