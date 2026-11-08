export type BeatWindow={start:number;end:number;offset:number|null;needsReview:boolean};
// Rough onset-vs-grid comparison, not beat tracking or a claim of listening.
export function beatEvidence(samples:Float32Array,sr:number,bpm:number,phase:number):BeatWindow[] {
 if(!(sr>0&&bpm>0&&Number.isFinite(phase))||samples.length<sr*2)return [];
 const hop=Math.max(1,Math.round(sr/100)),n=Math.floor(samples.length/hop),rms=new Float32Array(n),onset=new Float32Array(n),period=60/bpm;
 for(let i=0;i<n;i++){let sum=0;for(let j=i*hop;j<(i+1)*hop;j++)sum+=samples[j]*samples[j];rms[i]=Math.sqrt(sum/hop);}
 for(let i=1;i<n;i++)onset[i]=Math.max(0,rms[i]-rms[i-1]);
 const duration=n*hop/sr,windows:BeatWindow[]=[];
 for(let w=0;w<3;w++){
  const start=duration*w/3,end=duration*(w+1)/3;let best=-1,bestShift=0;
  for(let delta=-period/2;delta<=period/2;delta+=.01){
   let score=0,count=0;const first=Math.ceil((start-phase-delta)/period);
   for(let t=phase+delta+first*period;t<end;t+=period){const j=Math.round(t*sr/hop);let peak=0;for(let k=-2;k<=2;k++)peak=Math.max(peak,onset[j+k]??0);score+=peak;count++;}
   score/=Math.max(1,count);if(score>best){best=score;bestShift=delta;}
  }
  const offset=best>1e-5?Math.round(bestShift*1000)/1000:null;
  windows.push({start:Math.round(start*100)/100,end:Math.round(end*100)/100,offset,needsReview:offset!==null&&Math.abs(offset)>Math.max(.1,period*.2)});
 }
 return windows;
}
