import { renderGoldenFlush } from "./goldenFlushMusic";
if(!import.meta.env.DEV)throw Error('Local music preview only');
const player=document.querySelector('#player'),play=document.querySelector('#play'),status=document.querySelector('#status'),volume=document.querySelector('#volume'),level=document.querySelector('#level'),download=document.querySelector('#download');
player.volume=.2;
volume.addEventListener('input',()=>{player.volume=Number(volume.value)/100;level.value=volume.value+'%';});
player.addEventListener('volumechange',()=>{volume.value=Math.round(player.volume*100);level.value=volume.value+'%';});
player.addEventListener('play',()=>{document.body.classList.add('playing');play.textContent='Пауза';status.textContent='Играет по кругу';});
player.addEventListener('pause',()=>{document.body.classList.remove('playing');play.textContent='Слушать';status.textContent='Пауза';});
play.addEventListener('click',async()=>{if(player.paused){try{await player.play();}catch{status.textContent='Нажми воспроизведение на плеере.';}}else player.pause();});
let blobUrl;
try{const result=await renderGoldenFlush();blobUrl=URL.createObjectURL(result.blob);player.src=blobUrl;download.href=blobUrl;download.hidden=false;play.disabled=false;play.textContent='Слушать';status.textContent=`Готово · ${result.duration.toFixed(1)} сек · повтор включён`;}catch(error){status.textContent='Не удалось подготовить звук: '+error.message;play.textContent='Обнови страницу';}
window.addEventListener('pagehide',()=>{player.pause();if(blobUrl)URL.revokeObjectURL(blobUrl);});
