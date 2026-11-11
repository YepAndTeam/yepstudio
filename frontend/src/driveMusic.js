import {PreviewLoopPlayer} from './previewLoopPlayer.js';

export function createDriveMusic(player){
 let active=false,unlocked=false;
 player.setVolume(.14);
 // Generate once on demand; no oscillator scheduling or network requests while racing.
 player.setTrack(async()=>{const {renderSuppliedMelody}=await import('./suppliedMelody.js');return renderSuppliedMelody({tempo:1.3,transpose:-3,seamless:true}).blob.arrayBuffer();});
 const play=()=>{if(active&&unlocked)void player.play().catch(()=>{});};
 return {
  setEnabled(value){active=value;if(value)play();else player.pause();},
  unlock(){unlocked=true;return player.unlock().then(play).catch(()=>{});},
  restart(){active=false;player.pause();void player.seek(0);},
  release(){active=false;unlocked=false;player.close();},
 };
}
export const driveMusic=createDriveMusic(new PreviewLoopPlayer());

