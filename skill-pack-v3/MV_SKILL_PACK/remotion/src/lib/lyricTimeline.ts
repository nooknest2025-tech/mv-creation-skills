import type {SyncLine, VocalCandidate} from './syncAudit';

type Estimate = {status: 'estimated'; lyrics: VocalCandidate[]} | {status: 'unavailable'; reason: string} | {status: 'no-lyrics'};

// Estimates are evidence, not verified sung times. Never change display timings here.
export function lyricTimeline(lines: SyncLine[], duration: number, mix: Estimate, vocals?: Estimate, vocalDuration?: number, separationReason?: string) {
 const alignedDuration = vocalDuration !== undefined && Number.isFinite(vocalDuration) && Math.abs(vocalDuration-duration) <= .2;
 const candidate = (estimate: Estimate | undefined, i: number) => {
  if (estimate?.status !== 'estimated' || estimate.lyrics.length !== lines.length) return null;
  const c = estimate.lyrics[i];
  if (!c || c.text.trim() !== lines[i].text.replace(/[\r\n]+/g,' ').trim() || !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start || c.end > duration+.2) return null;
  return c;
 };
 return {
  version: 1, status: 'not-listened',
  sources: {mix: {status: mix.status, ...(mix.status === 'unavailable' ? {reason: mix.reason} : {})}, vocals: vocals ? {status: vocals.status, duration: vocalDuration ?? null, durationCompatible: alignedDuration, alignment: 'unverified', ...(vocals.status === 'unavailable' ? {reason: vocals.reason} : {})} : {status: 'unavailable', reason: separationReason ?? '分離済み歌声なし'}},
  lines: lines.map((line,i) => {
   const m=candidate(mix,i), v=candidate(vocals,i), reasons:string[]=[];
   if (vocals && !alignedDuration) reasons.push('歌声素材の長さが原曲と異なるか確認できません');
   if (vocals && alignedDuration) reasons.push('歌声素材の開始位置は未検証');
   if (m && m.totalChars && (m.matchedChars??0)/m.totalChars < .6) reasons.push('原曲の文字一致が少なく補間を含む');
   if (v && v.totalChars && (v.matchedChars??0)/v.totalChars < .6) reasons.push('歌声素材の文字一致が少なく補間を含む');
   if (m && v && (Math.abs(m.start-v.start)>.4 || Math.abs(m.end-v.end)>.4)) reasons.push('原曲と歌声素材の推定が食い違う');
   if (!m) reasons.push('原曲の推定なし');
   return {line:i+1,text:line.text,display:{start:line.tOn??line.start,end:line.tEnd??line.end},vocal:{start:m?.start??null,end:m?.end??null,source:m?'mix':null,status:m?'estimated-needs-review':'unavailable',mix:m,vocals:v,reasons}};
  }),
  note:'原曲の自動推定を仮の歌唱時刻として保存。歌声素材は比較候補であり開始位置は未検証。表示時刻は変更しません。文字単位の時刻も補間を含みます。聴取確認が必要です。',
 };
}
