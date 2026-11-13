import { clipPlan, clipSourceTime, segmentsOf, keepPlayback, hasPlayback, localKnots, type ClipPlan } from "../src/lib/clipspeed";
import {retimeJizura} from './jizura-parts';
import {keepSceneClocks} from '../src/lib/sceneClock';
// Mouse timeline helpers for the editor (pure, unit-tested). All edits go to editor-state data only.
export const MIN_SCENE = 0.1, MIN_LYRIC = 0.1;
/** nearest beat (or bar with bars=true) when within `tol` seconds; else t. */
export function snapTime(t: number, bpm: number, phase = 0, tol = 0.12, bars = false, beats?:number[]): number {
  if(beats&&beats.length>=2){let lo=0,hi=beats.length-1;while(lo<hi){const m=(lo+hi)>>1;if(beats[m]<t)lo=m+1;else hi=m;}const candidates=(bars?[Math.ceil(lo/4)*4,Math.floor(lo/4)*4,Math.floor((lo-1)/4)*4]:[lo,lo-1]).filter(i=>i>=0&&i<beats.length);let best=t,dist=tol;for(const i of candidates){const d=Math.abs(beats[i]-t);if(d<=dist){dist=d;best=beats[i];}}return +best.toFixed(3);}
  const B = (60 / (bpm || 120)) * (bars ? 4 : 1); const k = Math.round((t - phase) / B), s = phase + k * B;
  return Math.abs(s - t) <= tol ? +s.toFixed(3) : t;
}
/** move the boundary between scene i-1 and scene i (= scenes[i].start). Neighbour adjusts automatically. */
export function resizeBoundary(scenes: { start: number }[], i: number, t: number, duration: number): number {
  if (i <= 0 || i >= scenes.length) return scenes[i]?.start ?? 0;
  const lo = scenes[i - 1].start + MIN_SCENE, hi = (scenes[i + 1]?.start ?? duration) - MIN_SCENE;
  const v = +Math.max(lo, Math.min(hi, t)).toFixed(3); scenes[i].start = v; return v;
}
/** which edges a scene block shows: left = its start (not for the first scene, which starts at 0),
 *  right = its end (not for the last scene, which always ends with the song). */
export function sceneEdges(i: number, n: number): ("start" | "end")[] {
  const e: ("start" | "end")[] = []; if (i > 0) e.push("start"); if (i < n - 1) e.push("end"); return e;
}
/** scenes are back-to-back: scene i's right edge IS the boundary in front of scene i+1. */
export const sceneBoundaryIndex = (i: number, edge: "start" | "end") => (edge === "start" ? i : i + 1);
/** pin the timeline too (the preview is always sticky)? v6.4: OFF unless the user turned it on ("1"); the screen height no longer turns it on by itself. */
export const PIN_MIN_HEIGHT = 900;
export function pinDefault(saved: string | null, viewportH: number): boolean {
  void viewportH; return saved === "1";
}
/** drag a lyric's start or end edge (stays inside 0..duration-1 and keeps >= MIN_LYRIC). */
export function moveLyricEdge(l: { start: number; end: number; jizura?: any }, edge: "start" | "end", t: number, duration: number): number {
  if(!Number.isFinite(t))return l[edge];
  const previousDuration=l.end-l.start;
  if (edge === "start") l.start = +Math.max(0, Math.min(l.end - MIN_LYRIC, t)).toFixed(3);
  else l.end = +Math.min(duration - 1, Math.max(l.start + MIN_LYRIC, t)).toFixed(3);
  retimeJizura(l,previousDuration);
  return l[edge];
}
/** drag a whole lyric block (keeps its length). */
export function moveLyric(l: { start: number; end: number }, delta: number, duration: number) {
  const len = l.end - l.start, s = Math.max(0, Math.min(duration - 1 - len, l.start + delta));
  l.start = +s.toFixed(3); l.end = +(s + len).toFixed(3);
}
/** drag a video clip body: dragging right shows earlier footage (like sliding film under a window). */
export function slideInPoint(from0: number, dragSeconds: number, rate: number, clipDur?: number): number {
  const max = clipDur && Number.isFinite(clipDur) ? Math.max(0, clipDur - 0.05) : 1e9;
  return +Math.max(0, Math.min(max, from0 - dragSeconds * (rate || 1))).toFixed(3);
}
export const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;

/** when a scene's material is swapped: drop the old clip trim/speed. A video starts in 「自動で合わせる」(fit) mode. */
export function resetClipForAsset(s: any, isVideo: boolean) {
  for (const k of ["clipFrom", "clipTo", "speed", "segments", "solve", "ease", "tail", "fit", "clipChain", "playback", "motionClock"]) delete s[k];
  if (isVideo) s.fit = true; return s;
}
export const ADD_ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|mp4|mov|m4v|webm)$/i;
export const isVideoName = (n: string) => /\.(mp4|mov|m4v|webm)$/i.test(n);

/** Ctrl+drag (そのシーンだけ): scenes stay back-to-back, neighbours are trimmed/extended but never below `min`. */
export const MIN_SOLO = 0.5;
const endOf = (sc: { start: number }[], k: number, duration: number) => sc[k + 1]?.start ?? duration;
export function resizeSceneOnly(sc: { start: number }[], i: number, edge: "start" | "end", t: number, duration: number, min = MIN_SOLO): number {
  const b = edge === "start" ? i : i + 1; if (b <= 0 || b >= sc.length) return edge === "start" ? sc[i].start : endOf(sc, i, duration);
  const lo = sc[b - 1].start + min, hi = endOf(sc, b, duration) - min; if (lo > hi) return sc[b].start;
  return (sc[b].start = +Math.max(lo, Math.min(hi, t)).toFixed(3));
}
/** Ctrl+drag the body: the scene keeps its length and moves. The previous scene stretches/shrinks to meet it,
 *  the next one is trimmed/extended. First scene always starts at 0; last scene always ends with the song. */
export function moveSceneOnly(sc: { start: number }[], i: number, start0: number, end0: number, delta: number, duration: number, min = MIN_SOLO) {
  const n = sc.length, len = end0 - start0;
  if (i === 0 || n < 2) { if (n > 1) resizeSceneOnly(sc, 0, "end", end0 + delta, duration, min); return; }
  if (i === n - 1) { resizeSceneOnly(sc, i, "start", start0 + delta, duration, min); return; }
  const lo = sc[i - 1].start + min, hi = endOf(sc, i + 1, duration) - min - len; if (lo > hi) return;
  const s = +Math.max(lo, Math.min(hi, start0 + delta)).toFixed(3); sc[i].start = s; sc[i + 1].start = +(s + len).toFixed(3);
}

/* ---- ここで切る / 次とつなげる (scenes only) ---- */
export const MIN_SPLIT = 0.5; // shorter scenes are merged away when the editor reopens (mergeSceneSlivers)
const r3 = (x: number) => +x.toFixed(3);
const sceneEnd = (sc: any[], i: number, duration: number) => sc[i + 1]?.start ?? duration;
/** effective speed segments of a clip scene (auto-solve / fit / auto-tail already applied). */
function bakedSegs(s: any, dur: number, clipDur?: number) {
  const p = clipPlan(s, dur, clipDur); const segs = segmentsOf(s, dur).map((g, k) => ({ at: g.at, speed: +(p.speeds[k] ?? p.rate).toFixed(4) }));
  return { p, segs };
}
const applySegs = (o: any, segs: { at: number; speed: number }[]) => {
  for (const k of ["fit", "solve", "segments", "speed", "ease", "playback"]) delete o[k];
  if (segs.length > 1) { o.segments = segs.map((g) => ({ at: r3(g.at), speed: g.speed })); o.speed = segs[0].speed; } else o.speed = segs[0].speed;
};
/** where the clip is when this scene ends (= the next half's IN when chained). */
export function clipEndTime(s: any, dur: number, clipDur?: number) { return r3(clipSourceTime(clipPlan(s, dur, clipDur), dur)); }
let splitSeq = 0;
/** split scene i at time t. Returns null on success or a Japanese reason. Video halves keep their own speed;
 *  the 2nd half continues exactly where the 1st ends (clipChain) so the cut is seamless. */
export function splitSceneAt(sc: any[], i: number, t: number, duration: number, opt: { video?: boolean; clipDur?: number } = {}, min = MIN_SPLIT): string | null {
  const s = sc[i]; if (!s) return "切るシーンがありません";
  t=r3(t);
  const s0 = s.start, e = sceneEnd(sc, i, duration), d1 = t - s0, d2 = e - t;
  if (d1 < min || d2 < min) return `短すぎるため切れません（切ったあと両方が${min}秒以上必要です）`;
  if(i>0&&d1<(s.transition??0))return '切り替えの途中は映像を保って分割できません。フェード終了後で切ってください';
  keepSceneClocks(sc,duration);
  const a = s, b: any = structuredClone(s);b.motionClock.offset+=d1;
  const ids = new Set(sc.map((x) => x.id)); let id; do id = `${s.id}-${++splitSeq}`; while (ids.has(id)); b.id = id; b.start = r3(t); b.transition = 0;
  if (opt.video) {
    const D = e - s0, { p, segs } = bakedSegs(s, D, opt.clipDur);
    if (p.mode === "play") {
      const at = r3(clipSourceTime(p, d1)), active = [...segs].reverse().find((g) => g.at <= d1)!.speed;
      applySegs(a, segs.filter((g) => g.at < d1)); a.clipFrom = r3(clipSourceTime(p,0)); delete a.clipTo;
      applySegs(b, [{ at: 0, speed: active }, ...segs.filter((g) => g.at > d1).map((g) => ({ at: g.at - d1, speed: g.speed }))]);
      b.clipFrom = at; b.clipChain = true; if (s.clipTo === undefined) delete b.clipTo;
      if (b.clipTo !== undefined && b.clipTo <= at + 0.05) delete b.clipTo;
      keepPlayback(a,p);keepPlayback(b,p,d1);
    } else { const L = opt.clipDur ?? Infinity; b.clipFrom = r3(Math.min(clipSourceTime(p, d1), L - 0.06)); delete b.clipChain;delete a.segments;delete b.segments;delete a.solve;delete b.solve;keepPlayback(a,p);keepPlayback(b,p,d1); }
  }
  sc.splice(i + 1, 0, b); return null;
}
/** keep chained halves seamless: IN = where the previous half ends (live, after speed edits). */
export function resolveClipChains(sc: any[], duration: number, isVideo: (s: any) => boolean, clipDurOf: (s: any) => number | undefined) {
  for (let i = 1; i < sc.length; i++) {
    const s = sc[i], prev = sc[i - 1]; if (!s.clipChain) continue;
    if (prev.asset !== s.asset || !isVideo(s)) { delete s.clipChain; continue; }
    const L = clipDurOf(s),exactAt=clipSourceTime(clipPlan(prev,s.start-prev.start,L),s.start-prev.start),at=r3(exactAt);
    const retained=hasPlayback(s)?clipPlan(s,(sc[i+1]?.start??duration)-s.start,L):null;
    s.clipFrom = L !== undefined ? Math.min(at, r3(L - 0.06)) : at;
    if (s.clipTo !== undefined && s.clipTo <= s.clipFrom + 0.05) delete s.clipTo;
    if(retained){const shift=exactAt-clipSourceTime(retained,0);retained.inPoint+=shift;keepPlayback(s,retained)}
  }
}
/** merge scene i with i+1. Two halves of the same clip become ONE scene with speed segments (looks identical). */
export function mergeSceneWithNext(sc: any[], i: number, duration: number, opt: { video?: boolean; clipDur?: number } = {}): string | null {
  const original=sc[i],next=sc[i+1];if(!original||!next)return '最後のシーンは次とつなげられません';
  if(original.asset!==next.asset)return '素材が異なるため結合できません。後半の映像を残したまま編集してください';
  const keys=['zoom','x','y','camera','cameraMove','cameraStrength','cameraSync','effects','comp','stage','mograph'];
  if(keys.some(k=>JSON.stringify(original[k])!==JSON.stringify(next[k]))||(next.transition??0)>0)return '見た目や切り替えが異なるため、映像を保って結合できません';
  const work=structuredClone(sc);keepSceneClocks(work,duration);const a=work[i],b=work[i+1],da=b.start-a.start,db=sceneEnd(work,i+1,duration)-b.start;
  const ca=a.motionClock,cb=b.motionClock,staticMotion=(a.cameraMove==='none'||a.camera===false)&&!a.comp&&!a.stage&&!a.effects?.length;
  if(!staticMotion&&(ca.id!==cb.id||ca.index!==cb.index||Math.abs(ca.duration-cb.duration)>1e-6||Math.abs(cb.offset-ca.offset-da)>1e-6))return '動きの進行が異なるため結合できません。二つのシーンを保持します';
  if(opt.video){
    const A=bakedSegs(a,da,opt.clipDur),B=bakedSegs(b,db,opt.clipDur),start=clipSourceTime(A.p,0),end=clipSourceTime(A.p,da);
    if(A.p.mode!=='play'||B.p.mode!=='play'||Math.abs(clipSourceTime(B.p,0)-end)>.001)return '動画の使用区間が連続していないため結合できません。後半の映像を保持します';
    const segs=[...A.segs,...B.segs.map(g=>({at:g.at+da,speed:g.speed}))].filter((g,k,arr)=>k===0||g.speed!==arr[k-1].speed);
    if(segs.length>8)return '速度の区間が8個を超えるため結合できません';
    const knots=[...localKnots(A.p,da),...localKnots(B.p,db).map(([t,v])=>[t+da,v] as [number,number])];
    // Remove redundant points without erasing a step (two different speeds at the same time).
    for(let k=knots.length-1;k>0;k--)if(knots[k][0]===knots[k-1][0]&&knots[k][1]===knots[k-1][1])knots.splice(k,1);
    for(let k=knots.length-2;k>0;k--){const a=knots[k-1],b=knots[k],c=knots[k+1];if(b[0]>a[0]&&c[0]>b[0]&&Math.abs((b[1]-a[1])*(c[0]-b[0])-(c[1]-b[1])*(b[0]-a[0]))<1e-10)knots.splice(k,1)}
    if(knots.length>64)return '速度変化が複雑なため結合できません。二つのシーンを保持します';
    applySegs(a,segs);a.clipFrom=start;if(b.clipTo===undefined)delete a.clipTo;else a.clipTo=b.clipTo;delete a.clipChain;
    const p:ClipPlan={inPoint:start,span:Number.isFinite(opt.clipDur)?opt.clipDur!-start:Infinity,mode:'play',knots,scale:1,speeds:segs.map(g=>g.speed),rate:0};keepPlayback(a,p);
  }
  work.splice(i+1,1);sc.splice(0,sc.length,...work);return null;
}

/* ---- one-step trims / delete / add (v6.5) ---- */
type ClipInfo = (s: any) => { video: boolean; clipDur?: number };
/** fix a video scene's current speed (fit/auto → fixed speed) so trimming its length cuts/extends footage instead of re-timing it. */
export function bakeClip(sc: any[], i: number, duration: number, info: ClipInfo) {
  const s = sc[i]; if (!s) return; const { video, clipDur } = info(s); if (!video) return;
  const d = sceneEnd(sc, i, duration) - s.start, { p, segs } = bakedSegs(s, d, clipDur);
  if (p.mode !== "play") return; applySegs(s, segs); s.clipFrom = r3(clipSourceTime(p,0));keepPlayback(s,p);
}
/** call once when an edge drag starts: bake both scenes around boundary b; the left scene's OUT is freed so its tail can grow. */
export function prepareTrim(sc: any[], b: number, duration: number, info: ClipInfo) {
  if (b <= 0 || b >= sc.length) return;keepSceneClocks(sc,duration); bakeClip(sc, b - 1, duration, info); bakeClip(sc, b, duration, info);
  const a=sc[b-1],p=hasPlayback(a)?clipPlan(a,sc[b].start-a.start,info(a).clipDur):null;
  delete a.clipTo; delete sc[b].clipChain;
  if(p){const L=info(a).clipDur;if(L!==undefined)p.span=L-p.inPoint;keepPlayback(a,p)}
}
const firstSpeed = (s: any) => (s.segments?.length ? s.segments[0].speed : s.speed ?? 1) || 1;
const lastSpeed = (s: any) => (s.segments?.length ? s.segments[s.segments.length - 1].speed : s.speed ?? 1) || 1;
/** one-step trim of boundary b (= sc[b].start). The scene BEFORE keeps start + IN (its tail is cut/extended);
 *  the scene AFTER keeps its end, and its IN moves with the cut so its footage stays in place.
 *  Left-edge trim of scene i = trimBoundary(i); right-edge trim of scene i = trimBoundary(i+1). Clamped to the source videos. */
export function trimBoundary(sc: any[], b: number, t: number, duration: number, info: ClipInfo): number {
  if (b <= 0 || b >= sc.length) return sc[b]?.start ?? 0;
  const A = sc[b - 1], B = sc[b], t0 = B.start; let lo = A.start + MIN_SCENE, hi = sceneEnd(sc, b, duration) - MIN_SCENE;
  const ia = info(A), ib = info(B);
  if (ib.video && clipPlan(B, sceneEnd(sc, b, duration) - t0, ib.clipDur).mode === "play") {
    const cf = B.clipFrom ?? 0, v = firstSpeed(B); lo = Math.max(lo, t0 - cf / v);
    if (ib.clipDur !== undefined) hi = Math.min(hi, t0 + (ib.clipDur - 0.06 - cf) / v);
  }
  if (ia.video && ia.clipDur !== undefined) {
    const dA = t0 - A.start, p = clipPlan(A, dA, ia.clipDur);
    if (p.mode === "play") { const endNow = clipSourceTime(p, dA); hi = Math.min(hi, t0 + Math.max(0, ia.clipDur - endNow) / lastSpeed(A)); }
  }
  const v = r3(Math.max(lo, Math.min(Math.max(lo, hi), t))), delta = v - t0; if (Math.abs(delta) < 1e-6) return t0;
  const retained=ib.video?clipPlan(B,sceneEnd(sc,b,duration)-t0,ib.clipDur):null;
  B.start = v;if(B.motionClock)B.motionClock.offset+=delta;
  if (ib.video) {
    /* footage stays in place: cutting the head = the old plan's source time at delta (follows speed changes inside the clip);
       extending the head = earlier footage at the first speed. */
    const before = clipPlan({ ...B, start: t0 }, sceneEnd(sc, b, duration) - t0, ib.clipDur);
    B.clipFrom = r3(Math.max(0, delta > 0 && before.mode === "play" ? clipSourceTime(before, delta) : (B.clipFrom ?? 0) + delta * firstSpeed(B)));
    if (B.clipTo !== undefined && B.clipTo <= B.clipFrom + 0.05) delete B.clipTo;
    if (B.segments?.length > 1) {
      const segs = B.segments.map((g: any) => ({ at: g.at - delta, speed: g.speed }));
      const act = [...segs].reverse().find((g: any) => g.at <= 0) ?? segs[0];
      const rest = segs.filter((g: any) => g.at > MIN_SCENE && g.at < sceneEnd(sc, b, duration) - v - MIN_SCENE);
      applySegs(B, [{ at: 0, speed: act.speed }, ...rest]);
    }
    if(retained)keepPlayback(B,retained,delta);
  }
  return v;
}
/** delete scene i; the previous scene grows to fill the gap (the next one when i is the first scene). Always keeps ≥1 scene. */
export function deleteScene(sc: any[], i: number): string | null {
  if (sc.length <= 1) return "最後の1シーンは削除できません";
  if (!sc[i]) return "削除するシーンがありません";
  if (i === 0) sc[1].start = 0;
  sc.splice(i, 1);
  const nx = sc[i]; if (nx?.clipChain && (i === 0 || sc[i - 1].asset !== nx.asset)) delete nx.clipChain;
  return null;
}
let addSeq = 0;
/** insert `asset` as a new scene at time t inside scene i. It takes time from that scene (video: its own length, image: 4 s,
 *  never past the scene's end). The host's later part keeps playing where it would have (no jump). clipFrom = 0, no gaps. */
export function insertAssetAt(sc: any[], t: number, asset: number, duration: number, info: ClipInfo, assetInfo: { video: boolean; clipDur?: number }, min = MIN_SPLIT, tpl?: any, wantLen?: number): { index: number } | string {
  let i = 0; sc.forEach((s, k) => { if (s.start <= t + 1e-6) i = k; });
  const host = sc[i], s0 = host.start, e = sceneEnd(sc, i, duration);
  if (t - s0 < min) t = s0;
  if (e - t < min) return `ここは場面の終わりに近すぎます（${min}秒以上の余裕が必要です）`;
  let len = wantLen ?? (assetInfo.video && assetInfo.clipDur ? Math.max(min, assetInfo.clipDur) : 4); len = Math.min(len, e - t);
  if (e - (t + len) < min) len = e - t;
  const end = r3(t + len);
  if (end < e - 1e-6) { const err = splitSceneAt(sc, i, end, duration, info(host)); if (err) return err; }
  let k = i;
  if (t > s0 + 1e-6) { const err = splitSceneAt(sc, i, r3(t), duration, info(sc[i])); if (err) return err; k = i + 1; }
  const ids = new Set(sc.map((x) => x.id)); let id; do id = `ADD-${++addSeq}`; while (ids.has(id));
  let n: any;
  if (tpl) { n = structuredClone(tpl); delete n.clipChain; n.id = id; n.start = r3(t); }
  else { n = resetClipForAsset(structuredClone(sc[k]), false); n.id = id; n.asset = asset; n.start = r3(t); n.transition = 0; delete n.label; delete n.name;
    if (assetInfo.video) { n.clipFrom = 0; n.speed = 1; } }
  sc[k] = n; if (sc[k + 1]?.clipChain) delete sc[k + 1].clipChain;
  return { index: k };
}
/** Ctrl+V: paste a copied scene (look, asset, IN, speed…) at t. Keeps its length where the landing scene has room. fit scenes are pasted with their baked speed. */
export function pasteSceneAt(sc: any[], t: number, copied: { scene: any; len: number }, duration: number, info: ClipInfo) {
  return insertAssetAt(sc, t, copied.scene.asset, duration, info, info(copied.scene), MIN_SPLIT, copied.scene, copied.len);
}

/** Numeric fields and pointer handles share the same explicit boundary-edit mode. */
export function editSceneBoundary(sc:any[],b:number,t:number,duration:number,info:ClipInfo,mode:'trim'|'cut'='trim'){
 if(!Number.isFinite(t)||b<=0||b>=sc.length)return sc[b]?.start??0;
 if(Math.abs(sc[b].start-t)<1e-6)return sc[b].start;
 if(mode==='cut')return resizeBoundary(sc,b,t,duration);
 prepareTrim(sc,b,duration,info);return trimBoundary(sc,b,t,duration,info);
}
