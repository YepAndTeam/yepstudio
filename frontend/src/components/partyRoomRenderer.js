import * as T from 'three';
import {publicTableCards} from '../partyPublicCards';
import {squareSeats,clampLook,focusYaw} from '../partySceneMath';
const PALETTES={classic:[0xa1aaa0,0x62736b,0xc4d0bb,0xdfdbab],mint:[0x82aea2,0x426f68,0xc1d4be,0xe3dbb0],sunset:[0xb69a7e,0x715c4d,0xd8c9a3,0xf4d8a9]};
export function createPartyRenderer(canvas,container,{kind,onProject,onFailure}){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(68,1,.08,30);camera.position.set(0,1.52,2.95);camera.rotation.order='YXZ';
 const bunker=kind==='bunker',bg=bunker?0x1b2228:0x100b0e;scene.background=new T.Color(bg);scene.fog=new T.Fog(bg,7,15);
 const resources=new Set(),unit=new T.BoxGeometry(1,1,1);resources.add(unit);
 const material=(color,basic=false)=>{const m=basic?new T.MeshBasicMaterial({color}):new T.MeshLambertMaterial({color});resources.add(m);return m;};
 function box(parent,x,y,z,w,h,d,mat){const m=new T.Mesh(unit,mat);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
 const wood=material(bunker?0x626b70:0x302126),edge=material(bunker?0x929da3:0x694349),dark=material(0x26312e),wall=material(bunker?0x414b53:0x21171c),trim=material(0x46514a),floor=material(bunker?0x30373d:0x171114),screen=material(0x263c3c,true),lamp=material(0xe8dfb3,true);
 scene.add(new T.AmbientLight(0xc4d0bd,1.3));const key=new T.DirectionalLight(0xffe7c4,1.6);key.position.set(-2,5,3);scene.add(key);const fill=new T.DirectionalLight(0x9db9c6,.55);fill.position.set(3,2,-3);scene.add(fill);
 box(scene,0,-.04,0,11,.1,11,floor);box(scene,0,1.8,-5.45,11,3.7,.12,wall);box(scene,-5.45,1.8,0,.12,3.7,11,wall);box(scene,5.45,1.8,0,.12,3.7,11,wall);box(scene,0,1.8,5.45,11,3.7,.12,wall);
 for(let i=-4;i<=4;i+=2){box(scene,i,1.7,-5.35,.055,3.4,.05,trim);box(scene,-5.35,1.7,i,.05,3.4,.055,trim);box(scene,5.35,1.7,i,.05,3.4,.055,trim);}
 box(scene,0,.25,-5.3,10.6,.15,.13,dark);box(scene,0,3.35,0,1.6,.10,.65,dark);box(scene,0,3.29,0,1.4,.025,.5,lamp);
 for(const x of [-3.3,3.3]){box(scene,x,1.9,-5.27,.9,1.15,.08,dark);box(scene,x,1.9,-5.21,.76,.98,.015,material(bunker?0x51645a:0x666270,true));box(scene,x,1.9,-5.19,.045,.98,.02,trim);box(scene,x,1.9,-5.19,.76,.04,.02,trim);}
 box(scene,0,.85,0,4.45,.18,4.45,edge);box(scene,0,.952,0,4.19,.025,4.19,wood);
 const felt=material(bunker?0x4b565b:0x641e2d);box(scene,0,.97,0,3.94,.015,3.94,felt);
 for(const x of [-1.85,1.85])for(const z of [-1.85,1.85])box(scene,x,.42,z,.16,.84,.16,dark);
 box(scene,0,.99,-.4,.56,.035,.4,material(0x64756b));box(scene,0,1.016,-.4,.41,.02,.25,screen);box(scene,.07,1.035,-.39,.06,.02,.04,lamp);
 function sign(text,x,y,z,w,h){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#18251f';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#81917c';ctx.lineWidth=6;ctx.strokeRect(4,4,504,120);ctx.fillStyle='#d9ddbe';ctx.font='bold 28px monospace';ctx.textAlign='center';ctx.fillText(text,256,75);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;resources.add(tex);const mat=new T.MeshBasicMaterial({map:tex});resources.add(mat);box(scene,x,y,z,w,h,.025,mat);}
 sign(bunker?'YAB / SHELTER 01':'YAB / NIGHT COUNCIL',0,2.45,-5.25,2.2,.55);

 if(bunker){
  const steel=material(0x7a858b),warning=material(0xb6a05a),red=material(0xc45f49,true);
  for(const y of [2.85,3.05]){box(scene,0,y,-5.10,10.5,.10,.13,steel);for(const x of [-4,-2,0,2,4])box(scene,x,y,-5.04,.10,.20,.20,trim);}
  box(scene,-2.1,1.7,-5.13,1.15,1.9,.20,dark);box(scene,-2.1,1.7,-4.99,1.0,1.74,.12,steel);box(scene,-1.78,1.65,-4.9,.08,.25,.08,warning);
  box(scene,2.1,2.65,-5.12,1.25,.55,.15,dark);for(let i=0;i<7;i++)box(scene,1.59+i*.17,2.65,-5.01,.07,.42,.05,steel);
  box(scene,0,2.95,-5.10,.25,.14,.14,red);sign('AIR / FILTER 02',2.1,2.15,-5.03,1.0,.22);sign('SEALED / EXIT',-2.1,2.85,-5.02,1.1,.22);
  for(const x of [-4.8,4.8]){box(scene,x,.65,-4.7,.60,1.3,.60,steel);box(scene,x,1.34,-4.7,.50,.08,.50,warning);}
 }else{
  const red=material(0x672332),leather=material(0x25191e);
  for(const x of [-4.4,4.4]){box(scene,x,1.9,-5.2,.75,2.7,.10,red);box(scene,x,3.25,-5.1,1.05,.12,.15,leather);}
  sign('PRIVATE / NO ENTRY',0,1.8,-5.20,1.7,.30);
 }
 const hands=new T.Group();camera.add(hands);scene.add(camera);const handMat=material(0x9cae9e),joint=material(0x4b675d);
 for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.42,-.51,-.82);arm.rotation.set(-.25,0,side*-.15);box(arm,0,0,0,.17,.28,.18,handMat);box(arm,0,.16,0,.13,.075,.13,joint);box(arm,0,.065,.094,.11,.02,.012,joint);hands.add(arm);}
 const tableCards=new T.Group();scene.add(tableCards);let cardResources=[],cardSignature='',cardMeshes=[],deals=[];
 const robots=new T.Group();scene.add(robots);let actors=[],modelSignature='',picked=null,night=false,disposed=false,halted=false,visible=true,raf=0,last=0,blinkTimer=0,unblinkTimer=0,hold=null,yaw=0,pitch=-.08,targetYaw=0,targetPitch=-.08;
 function faceTexture(p){const c=document.createElement('canvas');c.width=128;c.height=96;const ctx=c.getContext('2d'),tex=new T.CanvasTexture(c);tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestFilter;tex.colorSpace=T.SRGBColorSpace;resources.add(tex);return {c,ctx,tex,p};}
 function drawFace(a,blink=false){const {ctx,tex,p}=a;ctx.fillStyle='#172e30';ctx.fillRect(0,0,128,96);ctx.fillStyle=p.theme==='nyan'?'#efbddc':'#e5dfae';if(!p.alive||blink||night){ctx.fillRect(24,38,23,5);ctx.fillRect(81,38,23,5);}else{ctx.fillRect(25,28,20,24);ctx.fillRect(83,28,20,24);ctx.fillStyle='#fff6d8';ctx.fillRect(28,29,6,6);ctx.fillRect(86,29,6,6);}ctx.fillStyle='#e5dfae';ctx.fillRect(54,69,24,5);ctx.fillRect(50,64,5,8);ctx.fillRect(77,64,5,8);ctx.fillStyle='#bd9b76';ctx.fillRect(13,58,19,4);ctx.fillRect(96,58,19,4);ctx.fillStyle='#ffffff0b';for(let y=2;y<96;y+=4)ctx.fillRect(0,y,128,1);ctx.fillStyle='#ffffff15';ctx.fillRect(0,2,128,8);tex.needsUpdate=true;}
 function makeRobot(p,x,z){const before=new Set(resources);const colors=PALETTES[p.skin]||PALETTES.classic,g=new T.Group();g.position.set(x,0,z);g.lookAt(0,0,0);const dead=!p.alive,shell=material(dead?0x59615d:colors[0]),side=material(dead?0x3f4944:colors[1]),light=material(dead?0x788078:colors[2]),led=material(p.theme==='nyan'?0xd5a3c6:colors[3],true);box(g,0,.74,-.04,.62,.09,.44,dark);box(g,0,1.0,-.26,.64,.62,.10,dark);for(const sx of [-.23,.23])for(const sz of [-.19,.11])box(g,sx,.35,sz,.045,.70,.045,trim);
 if(!bunker){const upholstery=material(0x59202c);box(g,0,1.11,-.29,.76,.86,.18,upholstery);box(g,0,.77,-.02,.76,.13,.55,upholstery);for(const sx of [-1,1]){box(g,sx*.39,.91,-.02,.11,.09,.50,upholstery);box(g,sx*.39,.80,-.18,.07,.22,.07,dark);}}
 const bodyRoot=new T.Group();g.add(bodyRoot);
 box(bodyRoot,0,1.10,0,.67,.63,.32,side);box(bodyRoot,0,1.12,.025,.61,.57,.32,shell);box(bodyRoot,0,1.4,.04,.60,.035,.30,light);box(bodyRoot,-.29,1.1,.19,.025,.53,.015,light);box(bodyRoot,-.025,1.19,.196,.46,.34,.025,dark);
 const f=faceTexture(p),mat=new T.MeshBasicMaterial({map:f.tex});resources.add(mat);const screenGeo=new T.PlaneGeometry(.425,.30);resources.add(screenGeo);const mesh=new T.Mesh(screenGeo,mat);mesh.position.set(-.025,1.19,.213);bodyRoot.add(mesh);
 box(bodyRoot,0,1.53,0,.028,.18,.028,side);box(bodyRoot,0,1.64,0,.075,.05,.065,led);box(bodyRoot,.256,1.24,.2,.036,.13,.015,light);box(bodyRoot,.256,1.06,.202,.039,.04,.018,led);box(bodyRoot,.18,.9,.20,.14,.045,.025,dark);
 for(const sx of [-1,1]){box(bodyRoot,sx*.39,1.04,0,.10,.08,.10,side);box(bodyRoot,sx*.44,.98,.06,.12,.13,.14,shell);box(bodyRoot,sx*.18,.77,.25,.15,.13,.24,side);box(bodyRoot,sx*.18,.65,.33,.13,.19,.12,side);box(bodyRoot,sx*.18,.54,.38,.17,.055,.24,light);}
 if(p.theme==='nyan')for(const sx of [-1,1]){box(bodyRoot,sx*.23,1.49,.03,.13,.12,.17,shell);box(bodyRoot,sx*.23,1.50,.126,.07,.05,.012,led);}
 if(p.theme==='tetris'){for(const [i,j] of [[0,0],[1,0],[2,0],[1,1]])box(bodyRoot,-.20+i*.065,.96-j*.055,.20,.058,.048,.015,led);}
 if(p.theme==='neon')box(bodyRoot,.294,1.14,.19,.016,.46,.02,material(0x77c1cc,true));
 if(dead&&kind==='mafia'){const clones=new Map();bodyRoot.traverse(part=>{if(!part.isMesh)return;let mat=clones.get(part.material);if(!mat){mat=part.material.clone();mat.transparent=true;mat.opacity=.28;mat.depthWrite=false;resources.add(mat);clones.set(part.material,mat);}part.material=mat;});}
 const actor={...f,group:g,position:new T.Vector3(x,1.88,z),frame:shell,resources:[...resources].filter(r=>!before.has(r))};drawFace(actor);robots.add(g);return actor;}
 function releaseActors(){robots.clear();for(const a of actors){for(const resource of a.resources){resource.dispose();resources.delete(resource);}}actors=[];}
 function paintCard(card){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=192;const ctx=canvas.getContext('2d'),isRole=card.key==='role',mafia=card.role==='mafia';
  ctx.fillStyle=mafia?'#3b352f':card.role==='detective'?'#c2d1d5':'#dbdfc6';ctx.fillRect(0,0,128,192);ctx.strokeStyle=mafia?'#b69c6c':'#839775';ctx.lineWidth=4;ctx.strokeRect(4,4,120,184);ctx.fillStyle=mafia?'#dfc28b':'#344e3b';ctx.textAlign='center';ctx.font='bold 10px Arial';ctx.fillText(isRole?'YAB / ROLE':card.label.toUpperCase(),64,23,108);
  if(isRole){if(card.role==='doctor'){ctx.fillRect(55,42,18,52);ctx.fillRect(38,59,52,18);}else if(mafia){ctx.fillRect(45,43,38,30);ctx.fillRect(31,70,66,8);ctx.fillRect(45,87,11,8);ctx.fillRect(73,87,11,8);}else if(card.role==='detective'){ctx.lineWidth=6;ctx.strokeRect(39,42,45,45);ctx.beginPath();ctx.moveTo(82,83);ctx.lineTo(99,100);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(32,67);ctx.lineTo(64,39);ctx.lineTo(96,67);ctx.lineTo(87,67);ctx.lineTo(87,97);ctx.lineTo(41,97);ctx.lineTo(41,67);ctx.fill();}}
  ctx.font='bold 12px Arial';const words=card.value.split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>104&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);lines.slice(0,4).forEach((text,i)=>ctx.fillText(text,64,(isRole?125:75)+i*17,108));ctx.font='9px Arial';ctx.fillText(card.owner,64,174,104);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;resources.add(texture);return texture;
 }
 function syncCards(data,viewerId){
  const cards=publicTableCards(data),signature=JSON.stringify(cards);if(signature===cardSignature)return;
  const old=new Set(cardMeshes.map(m=>m.userData.card.id)),animate=cardSignature!=='';tableCards.clear();for(const resource of cardResources){resource.dispose();resources.delete(resource);}cardResources=[];cardMeshes=[];deals=[];
  const before=new Set(resources),seats=squareSeats(data.players,viewerId),positions=new Map(seats.map(s=>[s.player.id,s]));positions.set(viewerId,{x:0,z:2.95});
  const owners=new Map();for(const card of cards){if(!owners.has(card.ownerId))owners.set(card.ownerId,[]);owners.get(card.ownerId).push(card);}
  for(const [ownerId,pile] of owners){const pos=positions.get(ownerId);if(!pos)continue;const yaw=Math.atan2(-pos.x,-pos.z);
   pile.forEach((card,index)=>{const group=new T.Group(),offset=(index-(pile.length-1)/2)*.12,baseY=.995+index*.002;group.position.set(pos.x*1.45/2.95+Math.cos(yaw)*offset,baseY,pos.z*1.45/2.95-Math.sin(yaw)*offset);group.rotation.y=yaw+(index-(pile.length-1)/2)*.045;
    const mat=new T.MeshBasicMaterial({map:paintCard(card)});resources.add(mat);const geo=new T.PlaneGeometry(.28,.40);resources.add(geo);const face=new T.Mesh(geo,mat);face.rotation.x=-Math.PI/2;face.position.y=.005;face.userData.card=card;group.add(face);box(group,0,0,0,.28,.008,.40,edge);tableCards.add(group);cardMeshes.push(face);
    if(animate&&!old.has(card.id)){group.position.y+=.18;deals.push({group,baseY,start:performance.now()});}
   });
  }
  cardResources=[...resources].filter(r=>!before.has(r));cardSignature=signature;
 }
 function sync(data,viewerId,selection){const own=data.players.find(p=>p.id===viewerId);handMat.color.setHex((PALETTES[own?.skin]||PALETTES.classic)[0]);handMat.transparent=Boolean(own&&!own.alive&&kind==='mafia');handMat.opacity=handMat.transparent?.28:1;handMat.depthWrite=!handMat.transparent;joint.transparent=handMat.transparent;joint.opacity=handMat.opacity;joint.depthWrite=handMat.depthWrite;syncCards(data,viewerId);const sig=JSON.stringify(data.players.map(p=>[p.id,p.skin,p.theme,p.alive]));if(sig!==modelSignature){releaseActors();actors=squareSeats(data.players,viewerId).map(({player,x,z})=>makeRobot(player,x,z));modelSignature=sig;}if(selection!==picked){picked=selection;const a=actors.find(a=>a.p.id===picked);if(a)targetYaw=focusYaw(a.position.x,a.position.z);}if(night!==(data.phase==='night')){night=data.phase==='night';for(const actor of actors)drawFace(actor);}key.intensity=night?.45:1.6;fill.intensity=night?.24:.55;for(const a of actors)a.group.scale.setScalar(a.p.id===picked?1.035:1);request();}
 const projected=new T.Vector3();
 function draw(){camera.rotation.y=yaw;camera.rotation.x=pitch;camera.updateMatrixWorld();renderer.render(scene,camera);const width=container.clientWidth,height=container.clientHeight;for(const a of actors){projected.copy(a.position).project(camera);onProject(a.p.id,{x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,visible:projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.2&&Math.abs(projected.y)<1.3});}}
 function frame(now){raf=0;if(disposed||halted||document.hidden||!visible)return;if(now-last<1000/30){raf=requestAnimationFrame(frame);return;}const dt=Math.min(.05,(now-last)/1000||.033);last=now;deals=deals.filter(deal=>{const progress=Math.min(1,(now-deal.start)/420);deal.group.position.y=deal.baseY+.18*Math.pow(1-progress,3);return progress<1;});if(hold==='left')targetYaw=clampLook(targetYaw+dt*.9);if(hold==='right')targetYaw=clampLook(targetYaw-dt*.9);targetPitch=hold==='up'?.22:targetPitch;yaw+=(targetYaw-yaw)*.22;pitch+=(targetPitch-pitch)*.22;draw();if(deals.length||hold||Math.abs(yaw-targetYaw)>.0003||Math.abs(pitch-targetPitch)>.0003)request();}
 function request(){if(!raf&&!disposed&&!halted&&!document.hidden&&visible)raf=requestAnimationFrame(frame);}
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();request();}
 const observer=new ResizeObserver(resize);observer.observe(container);const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01});intersection.observe(container);
 function blink(){if(disposed)return;if(!halted&&!document.hidden&&visible&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){for(const a of actors)drawFace(a,true);request();unblinkTimer=setTimeout(()=>{for(const a of actors)drawFace(a);request();},130);}blinkTimer=setTimeout(blink,5000);}
 blinkTimer=setTimeout(blink,4000);
 const visibility=()=>{if(document.hidden){hold=null;cancelAnimationFrame(raf);raf=0;}else request();};document.addEventListener('visibilitychange',visibility);
 const lost=e=>{e.preventDefault();if(!disposed){halted=true;cancelAnimationFrame(raf);raf=0;onFailure();}};canvas.addEventListener('webglcontextlost',lost);
 resize();
 const raycaster=new T.Raycaster(),pointer=new T.Vector2();
 return {sync,pickCard(x,y){pointer.set(x/container.clientWidth*2-1,1-y/container.clientHeight*2);camera.updateMatrixWorld();scene.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(cardMeshes,false)[0]?.object.userData.card||null;},hold(zone){hold=zone==='drag'?null:zone;request();},drag(dx,dy){hold=null;targetYaw=clampLook(targetYaw-dx*.006);targetPitch=Math.max(-.45,Math.min(.4,targetPitch-dy*.004));request();},release(){if(hold==='up')targetPitch=-.08;hold=null;request();},reset(){hold=null;targetYaw=0;targetPitch=-.08;request();},dispose(){disposed=true;cancelAnimationFrame(raf);clearTimeout(blinkTimer);clearTimeout(unblinkTimer);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);for(const resource of resources)resource.dispose();renderer.dispose();}};
}
