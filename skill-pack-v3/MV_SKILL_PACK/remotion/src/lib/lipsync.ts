// Lip-sync / dance post-sync in Remotion + short-shot advice.
// The trimmed wav (assets/audio/<shot>_lipsync.wav) is ONLY a timing reference: the final mix is the master song.
import type { Shot } from "./types";
import { snapDuration } from "./videoModels";

/** stored at timing.perShot[<shot>].lipsync when a lip-sync/dance take is adopted. */
export interface LipsyncMeta { start: number; dur: number; origStart?: number; origEnd?: number; adjust?: string; at?: string; wav?: string | null; wavSec?: number | null; clipSec?: number | null; attach?: boolean }

export class LipsyncError extends Error {}

/** clip vs wav (or planned dur) must agree within one frame, else a Japanese error. */
export function checkClip(shotId: string, m: LipsyncMeta, fps = 30): void {
  const ref = m.wavSec ?? m.dur;
  if (m.clipSec == null) throw new LipsyncError(`${shotId}: 生成クリップの長さが分かりません。npm run gallery で採用し直してください（採用時に ffprobe で長さを記録します）`);
  const diff = Math.abs(m.clipSec - ref);
  if (diff > 1 / fps + 1e-6) throw new LipsyncError(`${shotId}: 生成クリップ ${m.clipSec.toFixed(3)}s と口パク用音声 ${ref.toFixed(3)}s が ${(diff * 1000).toFixed(0)}ms ずれています（許容は1フレーム ${(1000 / fps).toFixed(1)}ms）。レンダーを止めました。同じ尺で作り直すか、npm run gen -- plan をやり直してください`);
}

/**
 * Place lip-sync/dance clips exactly at the planned audio window (no cut lead, clipFrom 0, rate 1, no ramp, muted),
 * and push the neighbours: an extended shot eats into the next shot (its start moves to our end);
 * a shot that was shifted earlier trims the previous one. Neighbours that vanish are dropped.
 */
export function applyLipsync(shots: Shot[], meta: Record<string, LipsyncMeta | undefined>, fps = 30): { shots: Shot[]; notes: string[] } {
  const out = shots.map((s) => ({ ...s })), notes: string[] = [];
  const fr = (t: number) => Math.round(t * fps) / fps;
  for (let i = 0; i < out.length; i++) {
    const m = meta[out[i].id]; if (!m) continue;
    const s = out[i];
    if (s.kind !== "video" || !s.src) { notes.push(`${s.id}: 口パク用の生成クリップが未採用のため、通常の配置のまま`); continue; }
    checkClip(s.id, m, fps);
    const a = fr(m.start), b = fr(m.start + m.dur);
    Object.assign(s, { start: a, end: b, clipFrom: 0, rate: 1, ramp: "none", muted: true, lipsync: true });
    for (let j = i + 1; j < out.length && out[j].start < b - 1e-9; j++) { if (meta[out[j].id]) throw new LipsyncError(`${s.id} を延長すると口パクショット ${out[j].id} と重なります。どちらかの尺を見直してください`); out[j].start = b; }
    for (let j = i - 1; j >= 0 && out[j].end > a + 1e-9; j--) { if (meta[out[j].id]) throw new LipsyncError(`${s.id} の開始が口パクショット ${out[j].id} と重なります`); out[j].end = a; }
    if (i > 0 && out[i - 1].end < a - 1e-9 && !meta[out[i - 1].id]) out[i - 1].end = a; // shot moved later: close the gap
    notes.push(`${s.id}: ${a.toFixed(3)}s〜${b.toFixed(3)}s に配置（口パク音声に合わせて固定・クリップ音声はミュート）`);
  }
  const kept = out.filter((s) => { const ok = s.end - s.start >= 1 / fps - 1e-9; if (!ok) notes.push(`${s.id}: 前後の口パクショットに吸収されて消えました`); return ok; });
  return { shots: kept, notes };
}

// ---- short lip-sync/dance shots that would be stretched to fit a model's allowed durations ----
export interface ShortIn { id: string; start: number; end: number; performance?: string; singer?: string; locked?: boolean }
export interface ShortAdvice { shot: string; len: number; snapped: number; stretch: number; msg: string; options: string[]; merge?: string[] }
const isPerf = (p?: string) => p === "lipsync" || p === "dance";
export const flexibleModels = (models: any[]) => models.filter((m) => m.kind === "video" && !m.deprecated && !m.allowed_durations?.length && Array.isArray(m.durations) && m.durations.length === 2).map((m) => `${m.id}（${m.durations[0]}〜${m.durations[1]}秒）`);

export function shortShotAdvice(shots: ShortIn[], model: (id: string) => any, models: any[] = [], thresh = 1): ShortAdvice[] {
  const out: ShortAdvice[] = [], flex = flexibleModels(models).slice(0, 3);
  shots.forEach((s, i) => {
    if (!isPerf(s.performance)) return;
    const len = s.end - s.start, m = model(s.id); if (!m) return;
    const snapped = snapDuration(len, m), stretch = snapped - len;
    if (stretch <= thresh) return;
    const nb = [shots[i - 1], shots[i + 1]].filter((n) => n && isPerf(n.performance) && (n.singer ?? "") === (s.singer ?? "")) as ShortIn[];
    const opts = [
      nb.length ? `隣の同じ歌い手のショット（${nb.map((n) => n.id).join("・")}）とつなげて1本にする` : "隣に同じ歌い手のショットがないため、結合はできません",
      `尺を1秒刻みで選べるモデルにする${flex.length ? `（例: ${flex.join("、")}）` : ""}`,
      `長め（${snapped}秒）に生成して、Remotion で ${len.toFixed(2)}秒に切って使う（口パク音声は元の曲の位置に固定）`,
    ];
    out.push({ shot: s.id, len, snapped, stretch, options: opts, merge: !s.locked && nb.length ? [s.id, nb[0].id] : undefined,
      msg: `⚠ ${s.id}: ${len.toFixed(2)}秒の口パク/ダンスが ${m.id} の対応尺 ${snapped}秒に ${stretch.toFixed(2)}秒 伸びます${s.locked ? "（あなたが指定したカットなので自動では変えません）" : ""}` });
  });
  return out;
}

/** auto mode: merge each flagged (unlocked) shot with its same-singer neighbour. User-locked shots are never touched. */
export function autoMerge<T extends ShortIn>(shots: T[], adv: ShortAdvice[], keepCut: string[] = []): { shots: T[]; merged: string[] } {
  let cur = shots.map((s) => ({ ...s })); const merged: string[] = [], keep = new Set(keepCut);
  for (const a of adv) {
    if (!a.merge || keep.has(a.merge[0]) || keep.has(a.merge[1])) continue;
    const i = cur.findIndex((s) => s.id === a.merge![0]), j = cur.findIndex((s) => s.id === a.merge![1]);
    if (i < 0 || j < 0 || cur[i].locked || cur[j].locked) continue;
    // keep the flagged shot's id (it is the one in the plan); it takes over the neighbour's time
    cur[i] = { ...cur[i], start: Math.min(cur[i].start, cur[j].start), end: Math.max(cur[i].end, cur[j].end) }; cur.splice(j, 1);
    merged.push(`${a.merge[0]}（${a.merge.join("+")} を結合）`);
  }
  return { shots: cur, merged };
}

// ---- undo: non-destructive restore of the original cut timing (and neighbours) ----
const norm = (id: string) => { const m = id.toUpperCase().match(/^S0*(\d+)$/); return m ? `S${m[1].padStart(3, "0")}` : id.toUpperCase(); };
/** moves perShot[id].lipsync into lipsyncHistory (kept forever) and pins the shot out of auto-merge. Files are untouched. */
export function restoreCut(cfg0: any, ids: string[] | "all"): { cfg: any; changes: string[] } {
  const cfg = JSON.parse(JSON.stringify(cfg0 ?? {})), P = cfg.timing?.perShot ?? {}, changes: string[] = [];
  const want = ids === "all" ? Object.keys(P).filter((k) => P[k]?.lipsync) : ids.map((x) => (P[x] ? x : P[norm(x)] ? norm(x) : norm(x)));
  for (const id of want) {
    const e = P[id];
    if (!e?.lipsync) { changes.push(`${id}: 調整されていないので変更なし`); continue; }
    const L = e.lipsync; (e.lipsyncHistory ??= []).push({ ...L, restoredAt: new Date().toISOString() }); delete e.lipsync;
    cfg.gen ??= {}; cfg.gen.keepCut = [...new Set([...(cfg.gen.keepCut ?? []), id])];
    changes.push(`${id}: 元の長さに戻しました${L.origStart != null ? `（${(+L.origStart).toFixed(2)}s〜${(+L.origEnd).toFixed(2)}s、前後のショットも元どおり）` : "（前後のショットも元どおり）"}。生成クリップ・切り出し音声は消していません`);
  }
  if (ids === "all") { cfg.gen ??= {}; cfg.gen.keepCut = [...new Set([...(cfg.gen.keepCut ?? []), ...Object.keys(P)])]; }
  if (!want.length) changes.push("元に戻す調整はありません");
  return { cfg, changes };
}
/** 「S05を元の長さに戻して」「全部元の長さに戻して」 */
export function parseRestore(text: string): string[] | "all" | null {
  const t = text.normalize("NFKC");
  if (!/元(の(長さ|尺|タイミング|カット))?に戻/.test(t)) return null;
  const ids = [...t.matchAll(/S\d+/gi)].map((m) => norm(m[0]));
  return ids.length ? ids : /全部|すべて|全て|全ショット/.test(t) ? "all" : null;
}
