export type BeatTrack={beats:number[];coverage:number;source:'audio-onsets';status:'estimated'|'insufficient';irregularTransitions?:number};

/** Track a beat path through measured onsets while allowing the interval to change.
 * An estimate, not a guarantee: offbeats, soft intros and sparse music can mislead it. */
export function trackAudioBeats(samples:Float32Array,sr:number,bpmHint=120):BeatTrack {
 const empty:BeatTrack={beats:[],coverage:0,source:'audio-onsets',status:'insufficient'};
 if(!(sr>0)||samples.length<sr*4)return empty;
 const hop=Math.max(1,Math.round(sr/100)),hz=sr/hop,n=Math.floor(samples.length/hop),rms=new Float32Array(n),rise=new Float32Array(n);
 for(let i=0;i<n;i++){let sum=0;for(let j=i*hop;j<(i+1)*hop;j++)sum+=samples[j]*samples[j];rms[i]=Math.sqrt(sum/hop)}
 let mean=0;for(let i=1;i<n;i++){rise[i]=Math.max(0,rms[i]-rms[i-1]);mean+=rise[i]}mean/=n;
 if(mean<1e-7)return empty;
 const peaks:number[]=[];
 for(let i=2;i<n-2;i++)if(rise[i]>mean*1.3&&rise[i]>=rise[i-1]&&rise[i]>rise[i+1]&&rise[i]>=rise[i-2]&&rise[i]>=rise[i+2])peaks.push(i);
 if(peaks.length<8)return empty;
 // Dynamic programming over onset candidates. The previous interval is allowed
 // to change; BPM only supplies a soft initial preference, never the beat times.
 const min=Math.round(hz*.3),max=Math.round(hz*1.1),scores=new Float64Array(peaks.length),prev=new Int32Array(peaks.length),periods=new Float64Array(peaks.length);
 prev.fill(-1);const hint=Number.isFinite(bpmHint)&&bpmHint>0?hz*60/bpmHint:hz*.5;
 let best=0;
 for(let i=0;i<peaks.length;i++){
  const strength=Math.min(4,Math.log1p(rise[peaks[i]]/mean)),t=peaks[i];scores[i]=strength;periods[i]=hint;
  for(let j=i-1;j>=0;j--){const d=t-peaks[j];if(d>max)break;if(d<min)continue;
   const prior=periods[j],ratio=Math.abs(Math.log(d/Math.max(1,prior))),hintPenalty=.18*Math.abs(Math.log(d/hint));
   const score=scores[j]+strength-.9-2.2*ratio-hintPenalty;
   if(score>scores[i]){scores[i]=score;prev[i]=j;periods[i]=prior*.55+d*.45;}
  }
  if(scores[i]>scores[best])best=i;
 }
 const beats:number[]=[];for(let i=best;i>=0;i=prev[i]){beats.push(Math.round(peaks[i]/hz*1000)/1000);if(prev[i]<0)break}beats.reverse();
 const coverage=beats.length>1?(beats[beats.length-1]-beats[0])/(samples.length/sr):0;
 const gaps=beats.slice(1).map((t,i)=>t-beats[i]);let jumps=0;
 for(let i=1;i<gaps.length;i++)if(Math.max(gaps[i],gaps[i-1])/Math.min(gaps[i],gaps[i-1])>1.4)jumps++;
 const stable=jumps/Math.max(1,gaps.length-1)<=.1;
 return {beats,coverage:Math.round(coverage*1000)/1000,source:'audio-onsets',irregularTransitions:jumps,status:beats.length>=8&&coverage>=.85&&stable?'estimated':'insufficient'};
}
