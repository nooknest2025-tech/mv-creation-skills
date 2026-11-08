export type SyncLine={text:string;start:number;end:number;tOn?:number;tEnd?:number};
export type SyncIssue={line:number;text:string;start:number;end:number;reasons:string[]};

// A triage report, not proof of vocal or beat alignment. It never changes timing.
export type VocalCandidate={text:string;start:number;end:number;matchedChars?:number;totalChars?:number};
import type {BeatWindow} from './beatEvidence';
export function syncAudit(lines:SyncLine[],duration:number,beat:{bpm:number;phase:number},candidates?:VocalCandidate[],windows?:BeatWindow[]) {
 const issues:SyncIssue[]=[];
 const comparable=!!candidates&&candidates.length===lines.length&&candidates.every((c,i)=>c.text===lines[i].text);
 lines.forEach((l,i)=>{
  const start=l.tOn??l.start,end=l.tEnd??l.end,reasons:string[]=[];
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration+.05||end<=start)reasons.push('時刻が範囲外、または終了が開始以前');
  const chars=Array.from(l.text.replace(/[\s、。,.!?！？「」『』（）()…・ー〜~\-]/g,'')).length;
  if(end-start<.45||chars/Math.max(.01,end-start)>10)reasons.push('表示が短い可能性');
  if(i&&start<(lines[i-1].tEnd??lines[i-1].end)-.02)reasons.push('前の行と重なる（意図した重なりも含む）');
  if(comparable){const c=candidates![i];
   if(c.totalChars&&((c.matchedChars??0)/c.totalChars)<.6)reasons.push('歌声認識との文字一致が少なく、時刻に補間を含む');
   else if(Math.abs(c.start-l.start)>.4||Math.abs(c.end-l.end)>.4)reasons.push(`歌声の自動推定 ${c.start.toFixed(2)}〜${c.end.toFixed(2)}秒と差がある`);
  }
  if(reasons.length)issues.push({line:i+1,text:l.text,start,end,reasons});
 });
 return {version:1,lyric:{status:'not-listened',audioComparison:comparable?'automatic-estimate':'unavailable',lineCount:lines.length,issues},beat:{status:'not-listened',bpm:beat.bpm,phase:beat.phase,checkAt:[0,duration/2,Math.max(0,duration-10)].map(x=>Math.round(x*100)/100),alternatives:[beat.bpm/2,beat.bpm*2],onsetWindows:windows??[]},note:'歌声・拍の聴取は未確認。歌声認識との差や音の立ち上がりは確認候補であり、拍や歌詞の誤りの確定ではありません。'};
}
