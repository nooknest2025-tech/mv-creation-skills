// Video clip speed / speed ramp / trim — ONE pure mapping shared by the editor preview,
// the editor MP4 export and npm run mv. It only maps "time inside the scene" -> "time inside the clip"
// by integrating the speed curve. It never touches the song audio or the scene length (audio safety by construction).
export type ClipTail = "auto" | "hold" | "loop";
export interface Seg { at: number; speed: number } // from scene time `at` on, play at `speed`
export interface Playback { knots:Knot[];inPoint:number;span:number|null;mode:'play'|'hold'|'loop';scale:number;offset:number;signature:string }
export interface ClipOpts { speed?: number; fit?: boolean; clipFrom?: number; clipTo?: number; tail?: ClipTail; segments?: Seg[]; ease?: number; solve?: number; playback?:Playback }
export type Knot = [number, number]; // (scene time, speed) — speed is piecewise linear between knots
export interface ClipPlan { rate: number; inPoint: number; mode: "play" | "hold" | "loop"; span: number; knots: Knot[]; scale: number; speeds: number[];offset?:number }
export const SPEED_MIN = 0.1, SPEED_MAX = 4, EASE_MAX = 2;
export const SPEED_PRESETS: [string, number][] = [["スロー 0.5倍", 0.5], ["普通 1倍", 1], ["速く 2倍", 2]];
export const TAILS: Record<ClipTail, string> = { auto: "自動でゆっくりにして合わせる（おすすめ）", hold: "最後の画で止める", loop: "最初からくり返す" };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fin = (x: any, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const playbackSignature=(o:ClipOpts)=>JSON.stringify([o.speed,o.fit,o.clipFrom,o.clipTo,o.tail,o.segments,o.ease,o.solve]);
export const hasPlayback=(o:ClipOpts)=>!!o.playback&&o.playback.signature===playbackSignature(o);
/** An explicit speed edit replaces only this cut's inherited curve and preserves the chosen rate. */
export function setClipSpeed(o:ClipOpts,value:number){
 if(!Number.isFinite(value))return;
 if(hasPlayback(o)){delete o.segments;delete o.solve;delete o.ease}
 delete o.playback;delete o.fit;o.speed=Math.round(Math.max(SPEED_MIN,Math.min(SPEED_MAX,value))*100)/100;
 if(o.segments)o.segments[0].speed=o.speed;
 if(!o.tail||o.tail==='auto')o.tail='hold';
}
const travel=(p:ClipPlan,t:number)=>(t<0?t*p.knots[0][1]:integrate(p.knots,t))*p.scale;
export function keepPlayback(o:ClipOpts,p:ClipPlan,delta=0){o.playback={knots:p.knots.map(k=>[...k] as Knot),inPoint:p.inPoint,span:Number.isFinite(p.span)?p.span:null,mode:p.mode,scale:p.scale,offset:(p.offset??0)+delta,signature:playbackSignature(o)}}
/** Exact local speed curve, including ramps and steps at a split point. */
export function localKnots(p:ClipPlan,duration:number):Knot[]{
 const offset=p.offset??0;
 const speed=(t:number)=>{let v=p.knots[0][1];for(let i=0;i<p.knots.length;i++){const a=p.knots[i],b=p.knots[i+1];if(t<a[0])break;v=a[1];if(b&&t<b[0]&&b[0]>a[0]){v=a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);break}}return v*p.scale};
 return [[0,speed(offset)],...p.knots.filter(k=>k[0]>offset&&k[0]<offset+duration).map(([t,v])=>[t-offset,v*p.scale] as Knot),[duration,speed(offset+duration)]];
}

/** segment list (always starts at 0, sorted, inside the scene). Without segments: one constant speed. */
export function segmentsOf(o: ClipOpts, dur: number): Seg[] {
  const raw = o.segments?.length ? o.segments : [{ at: 0, speed: fin(o.speed, 1) }];
  const s = raw.map((x) => ({ at: clamp(fin(x.at, 0), 0, dur), speed: fin(x.speed, 1) })).sort((a, b) => a.at - b.at);
  s[0] = { ...s[0], at: 0 }; return s;
}
/** speed curve knots: steps at each switch, or a linear ramp of `ease` seconds centred on it (スピードランプ). */
export function knotsOf(segs: Seg[], dur: number, ease = 0): Knot[] {
  const k: Knot[] = [[0, segs[0].speed]];
  for (let i = 1; i < segs.length; i++) {
    const b = segs[i].at, lo = Math.max(segs[i - 1].at, k[k.length - 1][0]), hi = segs[i + 1]?.at ?? dur;
    const h = Math.min(Math.max(0, ease) / 2, b - lo, hi - b);
    k.push([b - h, segs[i - 1].speed], [b + h, segs[i].speed]);
  }
  k.push([Math.max(dur, k[k.length - 1][0]), segs[segs.length - 1].speed]); return k;
}
/** ∫0^τ speed (exact for the piecewise-linear curve; constant after the last knot). */
export function integrate(k: Knot[], tau: number): number {
  let u = 0;
  for (let i = 0; i + 1 < k.length; i++) {
    const [t0, v0] = k[i], [t1, v1] = k[i + 1]; if (tau <= t0) break;
    const e = Math.min(tau, t1), w = t1 - t0; if (w <= 0) continue;
    const ve = v0 + (v1 - v0) * (e - t0) / w; u += (v0 + ve) / 2 * (e - t0);
  }
  const last = k[k.length - 1]; if (tau > last[0]) u += last[1] * (tau - last[0]);
  return u;
}
/** clip seconds used for the trim (IN..OUT). */
export function trimSpan(o: ClipOpts, clipDur?: number) {
  const known = typeof clipDur === "number" && Number.isFinite(clipDur) && clipDur > 0, len = known ? clipDur! : Infinity;
  const inPoint = clamp(fin(o.clipFrom, 0), 0, known ? Math.max(0, len - 0.05) : 1e9);
  const out = o.clipTo === undefined ? len : clamp(fin(o.clipTo, len), inPoint + 0.05, len);
  return { inPoint, out, span: out - inPoint, known: known || o.clipTo !== undefined };
}
/** auto-solve segment `idx` so the curve uses exactly `span` clip seconds in `dur` (帳尻合わせ). Exact even with ease (integral is linear in each speed). */
export function solveSpeed(segs: Seg[], idx: number, dur: number, span: number, ease = 0): number {
  const with_ = (v: number) => integrate(knotsOf(segs.map((s, i) => (i === idx ? { ...s, speed: v } : s)), dur, ease), dur);
  const a = with_(0), b = with_(1) - a; return b > 1e-9 ? (span - a) / b : segs[idx].speed;
}
/** sceneDur: seconds on screen; clipDur: clip length (unknown -> Infinity). */
export function clipPlan(o: ClipOpts, sceneDur: number, clipDur?: number): ClipPlan {
  if(hasPlayback(o)){
    const m=o.playback!,duration=Math.max(.01,sceneDur),p:ClipPlan={...m,span:m.span??Infinity,rate:0,speeds:[]};
    if(Number.isFinite(clipDur))p.span=Math.min(p.span,Math.max(0,clipDur!-p.inPoint));
    p.rate=(travel(p,m.offset+duration)-travel(p,m.offset))/duration;
    p.speeds=localKnots(p,duration).map(k=>k[1]).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-9);return p;
  }
  const dur = Math.max(0.01, sceneDur), { inPoint, span, known } = trimSpan(o, clipDur), ease = clamp(fin(o.ease, 0), 0, EASE_MAX);
  let segs = segmentsOf(o, dur).map((s) => ({ ...s, speed: clamp(s.speed, SPEED_MIN, SPEED_MAX) }));
  const plain = segs.length === 1;
  if (known && o.solve !== undefined && segs[o.solve]) segs[o.solve].speed = clamp(solveSpeed(segs, o.solve, dur, span, ease), SPEED_MIN, SPEED_MAX);
  else if (known && plain && o.fit) segs[0].speed = clamp(span / dur, SPEED_MIN, SPEED_MAX);
  const knots0 = knotsOf(segs, dur, ease), U = integrate(knots0, dur);
  const mk = (scale: number, mode: ClipPlan["mode"]): ClipPlan => ({ rate: U * scale / dur, inPoint, mode, span, knots: knots0, scale, speeds: segs.map((s) => s.speed * scale) });
  if (!known || U <= span + 1e-6) return mk(1, "play");
  const tail = o.tail ?? "auto";
  if (tail === "loop") return mk(1, "loop");
  if (tail === "auto") { const sc = span / U, minV = Math.min(...segs.map((s) => s.speed)) * sc; return minV >= SPEED_MIN - 1e-9 ? mk(sc, "play") : mk(SPEED_MIN / Math.min(...segs.map((s) => s.speed)), "hold"); }
  return mk(1, "hold");
}
/** time inside the clip (seconds) for `local` seconds after the scene starts. */
export function clipSourceTime(p: ClipPlan, local: number): number {
  let u = travel(p,(p.offset??0)+Math.max(0,local));
  if (p.mode === "loop" && Number.isFinite(p.span) && p.span > 0) u = u % p.span;
  if (Number.isFinite(p.span)) u = Math.min(u, Math.max(0, p.span - 0.04));
  return Math.max(0,p.inPoint + u);
}
/** plain-Japanese one-liner for the UI. */
export function clipSummary(p: ClipPlan, sceneDur: number): string {
  const sp = p.speeds.length > 1 ? p.speeds.map((v) => `${v.toFixed(2)}倍`).join(" → ") : `${p.rate.toFixed(2)}倍速`;
  if (!Number.isFinite(p.span)) return `${sp}（動画の長さが不明のため足りないときはくり返し）`;
  const used = Math.min(p.span, p.rate * sceneDur);
  return p.mode === "play" ? `${sp}・動画の ${p.inPoint.toFixed(2)}〜${(p.inPoint + used).toFixed(2)}秒を使用` : p.mode === "loop" ? `${sp}・動画が足りない分は最初からくり返し` : `${sp}・動画が足りない分は最後の画で止める`;
}
