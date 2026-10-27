// Lip-sync / dance: cut the ORIGINAL song to exactly the snapped video length of each shot.
import { capsOf, snapDuration } from "./videoModels";

export interface CutPlan {
  shot: string; start: number; dur: number; // audio window == final video length
  origStart: number; origEnd: number; newStart: number; newEnd: number;
  adjust: "none" | "extend" | "trim" | "shift"; adjustJa: string;
  format: "wav" | "mp3"; fadeMs: number; attach: boolean; note: string;
}
/** snapped video length decides the audio length; shot in/out is adjusted to match (never the other way). */
export function planCut(shot: { id: string; start: number; end: number }, model: any, songDur: number, fps = 30): CutPlan {
  const len = shot.end - shot.start, dur = snapDuration(len, model);
  let s = shot.start, e = s + dur, adjust: CutPlan["adjust"] = Math.abs(dur - len) < 1 / fps ? "none" : dur > len ? "extend" : "trim";
  if (e > songDur) { s = Math.max(0, songDur - dur); e = s + dur; adjust = "shift"; }
  const c = capsOf(model.id), ai = c.audioIn ?? null;
  const attach = !!ai && dur >= ai.minSec && dur <= ai.maxSec;
  const format = ai ? (ai.formats.includes("wav") ? "wav" : ai.formats[0] as any) : "wav";
  const ja = { none: "尺そのまま", extend: `${len.toFixed(2)}s → ${dur}s：次のショットに ${(dur - len).toFixed(2)}s はみ出す（次ショットの開始を後ろへ）`, trim: `${len.toFixed(2)}s → ${dur}s：終わりを ${(len - dur).toFixed(2)}s 詰める（次ショットの開始を前へ）`, shift: `曲の終わりを超えるため開始を ${s.toFixed(2)}s に前倒し` }[adjust];
  const note = attach ? `${model.id} に曲の音声（${format}）を添付` : ai ? `${model.id} の音声入力は ${ai.minSec}〜${ai.maxSec}s のみ → 添付せず、Remotion で後から口合わせ` : `${model.id} は音声入力なし → 切り出した音声は Remotion の後合わせ用`;
  return { shot: shot.id, start: +s.toFixed(6), dur, origStart: shot.start, origEnd: shot.end, newStart: s, newEnd: e, adjust, adjustJa: ja, format, fadeMs: 0, attach, note: note + (ai && !ai.verified ? "（音声仕様は未確認）" : "") };
}
/** |audio - video| must be within one frame. */
export function checkSync(audioSec: number, videoSec: number, fps = 30): { ok: boolean; diff: number; msg: string } {
  const diff = Math.abs(audioSec - videoSec), ok = diff <= 1 / fps + 1e-9;
  return { ok, diff, msg: ok ? "OK" : `音声 ${audioSec.toFixed(3)}s と動画 ${videoSec}s が ${(diff * 1000).toFixed(0)}ms ずれています（許容は1フレーム ${(1000 / fps).toFixed(1)}ms）。生成を止めました。npm run gen -- plan をやり直してください` };
}
export const needsAudio = (performance?: string) => performance === "lipsync" || performance === "dance";
