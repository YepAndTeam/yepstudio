import {renderSuppliedMelody,suppliedTimeline} from './suppliedMelody';
import {PreviewLoopPlayer} from './previewLoopPlayer';
import {drawPixelCar} from './driveArt';
if(!import.meta.env.DEV)throw Error('Local music preview only');
const play=document.querySelector('#play'),stop=document.querySelector('#stop'),status=document.querySelector('#status'),volume=document.querySelector('#volume'),level=document.querySelector('#level'),download=document.querySelector('#download'),loop=document.querySelector('#loop'),seek=document.querySelector('#seek'),elapsed=document.querySelector('#elapsed'),total=document.querySelector('#total');
const canvas=document.querySelector('#car'),ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.imageSmoothingEnabled=false;drawPixelCar(ctx,16,24,{skyline:true,color:'#8ebddb'});
const transpose=-3,tempo=1.3,oldTempo=1.15,timeline=suppliedTimeline(),pureTimeline=suppliedTimeline({tempo,transpose}),oldTimeline=suppliedTimeline({tempo:oldTempo,transpose}),cache=new Map();
const sections=t=>({intro:0,hook:t.notes[8].start,break:t.notes[32].start,peak:t.notes[50].start});
const versions={arranged:{title:'Твоя мелодия + фонк',tempo:'≈ 92 BPM · half-time',sections:sections(timeline)},code:{title:'Пиксели + фон',tempo:'Темп +15% · тон ниже',sections:sections(oldTimeline)},pure:{title:'Твоя мелодия',tempo:'Темп +30% · непрерывный повтор',sections:sections(pureTimeline)},original:{title:'Первый набросок',tempo:'132 BPM',sections:{intro:0,hook:16*60/132,break:64*60/132,peak:80*60/132}}};
let active='pure',duration=0,frame=0,lastPaint=0,seeking=false;
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const audio=new PreviewLoopPlayer({onChange:updatePlayback});
function paint(now=0){if(!seeking&&(!now||now-lastPaint>100)){seek.value=String(audio.position);elapsed.value=clock(audio.position);lastPaint=now;}if(audio.playing)frame=requestAnimationFrame(paint);}
function updatePlayback(){cancelAnimationFrame(frame);document.body.classList.toggle('playing',audio.playing);play.textContent=audio.playing?'Пауза':'Слушать';if(audio.playing)status.textContent='Играет · '+versions[active].title;paint();}
volume.addEventListener('input',()=>{audio.setVolume(Number(volume.value)/100);level.value=volume.value+'%';});
loop.addEventListener('change',()=>audio.setLoop(loop.checked));
seek.addEventListener('pointerdown',()=>{seeking=true;});seek.addEventListener('pointerup',()=>{seeking=false;});seek.addEventListener('pointercancel',()=>{seeking=false;});
seek.addEventListener('input',()=>{elapsed.value=clock(Number(seek.value));});seek.addEventListener('change',()=>{void audio.seek(Number(seek.value)).catch(showError);});
function showError(error){status.textContent='Не удалось включить звук: '+error.message;}
async function listen(){play.disabled=true;try{await audio.play();}catch(error){showError(error);}finally{play.disabled=false;}}
play.addEventListener('click',()=>{if(audio.playing){audio.pause();status.textContent='Пауза';}else void listen();});
stop.addEventListener('click',()=>{audio.pause();void audio.seek(0);status.textContent='С начала · можно слушать';});
function selectVersion(version){
 const resume=audio.playing;audio.pause();active=version;
 try{
  if(!cache.has(version)){
   if(version==='original')cache.set(version,{url:'/music-previews/midnight-original.wav',duration:128*60/132,sampleRate:32000});
   else{const pure=version==='pure',pixel=pure||version==='code';const result=renderSuppliedMelody({arranged:version==='arranged',backing:version==='code',seamless:pure,tempo:pure?tempo:pixel?oldTempo:1,transpose:pixel?transpose:0});cache.set(version,{...result,url:URL.createObjectURL(result.blob)});}
  }
  const result=cache.get(version);duration=result.duration;
  audio.setTrack(result.blob?()=>result.blob.arrayBuffer():async()=>{const response=await fetch(result.url);if(!response.ok)throw Error('Запись не найдена');return response.arrayBuffer();});
  seek.max=String(duration);seek.value='0';elapsed.value='0:00';total.textContent=clock(duration);
  download.href=result.url;download.download=`yab-midnight-${version}.wav`;download.hidden=false;play.disabled=false;stop.disabled=false;play.textContent='Слушать';
  status.textContent=`Готово · ${versions[version].title} · ${duration.toFixed(1)} сек`;
  document.querySelector('#tempo').textContent=versions[version].tempo;document.querySelector('#duration').textContent=duration.toFixed(1)+' секунды';
  document.querySelector('#technical').textContent=`STEREO / ${result.sampleRate/1000} kHz / 16-bit · AUDIO BUFFER LOOP`;
  for(const button of document.querySelectorAll('[data-version]'))button.setAttribute('aria-pressed',String(button.dataset.version===version));
  const labels=version==='original'?['Вступление','Основной бит','Брейк','Возвращение']:['Начало','Основная мелодия','Верхняя фраза','Финал'];
  [...document.querySelectorAll('[data-section]')].forEach((button,i)=>{button.disabled=false;button.textContent=labels[i];});
  if(resume)void listen();
 }catch(error){showError(error);}
}
for(const button of document.querySelectorAll('[data-version]'))button.addEventListener('click',()=>selectVersion(button.dataset.version));
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',async()=>{try{await audio.seek(versions[active].sections[button.dataset.section]);if(!audio.playing)await listen();}catch(error){showError(error);}});
selectVersion('pure');
window.addEventListener('pagehide',()=>{audio.close();cancelAnimationFrame(frame);for(const value of cache.values())if(value.url.startsWith('blob:'))URL.revokeObjectURL(value.url);});
