// User-provided Teriyaki Boyz - Tokyo drift MIDI File.mid.mid, original 128 BPM.
export const tokyoNotes=[[47,0.0,0.234375,50],[47,0.46875,0.234375,50],[47,0.9375,0.234375,50],[47,1.40625,0.234375,50],[47,1.875,0.234375,50],[48,2.2265625,0.234375,50],[52,2.578125,0.234375,50],[47,2.8125,0.234375,50],[47,3.28125,0.234375,50],[47,3.75,0.234375,50],[48,4.1015625,0.234375,50],[52,4.453125,0.234375,50],[47,4.6875,0.234375,50],[47,5.15625,0.234375,50],[47,5.625,0.234375,50],[48,5.9765625,0.234375,50],[52,6.328125,0.234375,50],[54,6.5625,0.234375,50],[54,7.03125,0.234375,50],[57,7.5,0.234375,50],[55,7.8515625,0.234375,50],[54,8.203125,0.234375,50],[52,8.4375,0.234375,50],[52,8.90625,0.234375,50],[57,9.375,0.234375,50],[55,9.7265625,0.234375,50],[54,10.078125,0.234375,50],[52,10.3125,0.234375,50],[52,10.78125,0.234375,50],[47,11.25,0.234375,50],[48,11.6015625,0.234375,50],[52,11.953125,0.234375,50],[47,12.1875,0.234375,50],[47,12.65625,0.234375,50],[47,13.125,0.234375,50],[48,13.4765625,0.234375,50],[52,13.828125,0.234375,50],[47,14.0625,0.234375,50],[47,14.53125,0.234375,50]];
export const tokyoDuration=15; // Eight complete bars, including the final MIDI rest.
export function renderTokyoMidi(){
 const sampleRate=22050,frames=sampleRate*tokyoDuration,samples=new Float32Array(frames),tau=Math.PI*2;
 for(const [midi,start,duration,velocity] of tokyoNotes){
  const offset=Math.round(start*sampleRate),length=Math.round(duration*sampleRate),hz=440*2**((midi-69)/12);
  // Band-limited saw/pulse harmonics into saturation: rough, without buzzer fizz.
  const harmonics=Math.min(12,Math.floor(7000/(hz*1.003)));let filtered=0;
  for(let i=0;i<length&&offset+i<frames;i++){
   const t=i/sampleRate,envelope=Math.max(0,Math.min(1,t/.003,(duration-t)/.014))*(.42+.58*Math.exp(-t*15));
   let saw=0,pulse=0;
   for(let h=1;h<=harmonics;h++){saw+=Math.sin(tau*hz*h*t)/h;if(h%2)pulse+=Math.sin(tau*hz*1.003*h*t)/h;}
   const sub=Math.sin(tau*hz*.5*t),driven=Math.tanh((saw*.65+pulse*.45)*2.7),cutoff=850+1900*Math.exp(-t*24),alpha=1-Math.exp(-tau*cutoff/sampleRate);
   filtered+=alpha*(driven-filtered);
   samples[offset+i]+=(filtered*.82+sub*.28)*envelope*(velocity/127);
  }
 }
 // Match the previous backing's level; the distortion changes texture, not loudness.
 let power=0,peak=0;for(const value of samples){power+=value*value;peak=Math.max(peak,Math.abs(value));}
 const scale=Math.min(.105/Math.max(.0001,Math.sqrt(power/frames)),.46/Math.max(.0001,peak));
 for(let i=0;i<frames;i++)samples[i]*=scale;
 const bytes=new ArrayBuffer(44+frames*2),view=new DataView(bytes),text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*2,true);
 for(let i=0;i<frames;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
 return bytes;
}
