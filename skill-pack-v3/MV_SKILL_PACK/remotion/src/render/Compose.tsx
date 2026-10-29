// Scene compositor (scene.comp). Ported from the v8 battle MV: panels (split / manga / PiP / mirror / kaleidoscope),
// per-panel crop/zoom/tilt/flip/slide and clip segment, impact frames, chroma flash, slash wipe, zoom punch + tilt, shake,
// speed/focus lines, name cards and a title slam. Used by the editor preview AND the MP4 export (same <Scene>).
import React from "react";
import { random } from "remotion";
import { backdropOf, cameraOf, compColors, coverScale, fxActive, globalComp, gradeOf, panelSourceTime, resolvePanels, type CompBackdropArt, type ResolvedPanel, type SceneComp } from "../lib/compose";

export type Media = (asset: number, srcTime: number, style: React.CSSProperties, key: string) => React.ReactNode;
const ease = (x: number) => { // Easing.bezier(0.16, 1, 0.3, 1) (same curve as the v8 composition)
  const c = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (c(0.16, 0.3, m) < x) lo = m; else hi = m; }
  return c(1, 1, (lo + hi) / 2);
};
const lerp = (x: number, [a, b]: [number, number], [c, d]: [number, number], e?: (v: number) => number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a || 1))); return c + (d - c) * (e ? e(k) : k); };
/** smooth 1-D value noise in [-1, 1] (smoothstep between seeded lattice points): continuous in time, so shake never jumps frame to frame. */
export const noise1 = (seed: string, x: number) => { const i = Math.floor(x), u = x - i, s = u * u * (3 - 2 * u), a = random(`${seed}-${i}`), b = random(`${seed}-${i + 1}`); return (a + (b - a) * s) * 2 - 1; };
const smooth = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const poly = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
const polyPx = (pts: [number, number][], W: number, H: number) => pts.map(([x, y]) => `${(x / 100) * W},${(y / 100) * H}`).join(" ");
const fam = (f: string) => `'${f}', 'Noto Sans JP', sans-serif`;

/** scene camera (shake offset px, punch scale, punch tilt deg) as seen by a layer at parallax `depth` (1 = the frame itself). */
type Cam = { sx: number; sy: number; punch: number; tilt: number };
const camAt = (c: Cam, d: number) => `translate3d(${(c.sx * d).toFixed(2)}px,${(c.sy * d).toFixed(2)}px,0) scale(${Math.pow(c.punch, d)}) rotate(${c.tilt * d}deg)`;
/** extra transform for a panel inside the frame layer (which already moved by depth 1): the difference to its own depth. */
const camRel = (c: Cam, d: number) => (d === 1 ? undefined : camAt(c, d - 1));

function PanelView({ p, f, life, fps, W, H, media, idx, gradeFilter, linear, cam }: { p: ResolvedPanel; f: number; life: number; fps: number; W: number; H: number; media: Media; idx: string; gradeFilter?: string; linear?: boolean; cam?: Cam }) {
  const k = lerp(f, [0, life], [0, 1], linear ? undefined : smooth); // eased zoom/tilt ramp: no velocity jump at the cut
  const rot = p.rot + (p.rot1 - p.rot) * k, dx = p.dx + (p.dx1 - p.dx) * k, dy = p.dy + (p.dy1 - p.dy) * k;
  const [, , bw0, bh0] = p.box, z = Math.max(p.z + (p.z1 - p.z) * k, coverScale(p.cx, p.cy, dx, rot, (bw0 * W) / Math.max(1, bh0 * H), dy)); // never uncover the box
  const s = lerp(f, [0, 5], [1, 0], ease);
  const slide = p.slide === "left" ? `translateX(${s * 100}%)` : p.slide === "right" ? `translateX(${-s * 100}%)` : p.slide === "up" ? `translateY(${s * 100}%)` : p.slide === "merge" ? `scale(${1 + s * 0.4})` : "";
  const op = p.slide === "merge" ? 1 - s : 1;
  const [bx, by, bw, bh] = p.box, isBox = bw < 100 || bh < 100;
  const src = panelSourceTime(p, f / fps, undefined, fps);
  return <div style={{ position: "absolute", inset: 0, clipPath: p.clip ? poly(p.clip) : undefined, opacity: op, transform: cam ? camRel(cam, p.depth) : undefined }}>
    <div style={{ position: "absolute", left: `${bx}%`, top: `${by}%`, width: `${bw}%`, height: `${bh}%`, overflow: "hidden", transform: slide, background: "#000", boxShadow: isBox ? "0 0 0 6px #fff, 0 0 0 14px #000, 0 10px 40px rgba(0,0,0,.8)" : undefined }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${p.cx}% ${p.cy}%`, transform: `translate3d(${dx}%, ${dy}%, 0) translate(${50 - p.cx}%, ${50 - p.cy}%) rotate(${rot}deg) scale(${z * (p.flipX ? -1 : 1)}, ${z * (p.flipY ? -1 : 1)})`, filter: [p.lift > 0 ? `brightness(${1 + p.lift})` : "", gradeFilter ?? ""].join(" ").trim() || undefined, willChange: "transform", backfaceVisibility: "hidden" }}>
        {media(p.asset, src, { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }, idx)}
      </div>
    </div>
    {p.clip ? <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><polygon points={polyPx(p.clip, W, H)} fill="none" stroke="#000" strokeWidth={16} /><polygon points={polyPx(p.clip, W, H)} fill="none" stroke="#fff" strokeWidth={5} /></svg> : null}
  </div>;
}

/** illustration backdrop: whole frame, its own eased zoom / pan / tilt over the scene, moved by the scene camera at its parallax depth. */
function BackdropArt({ b, st, life, W, H, media, idx, gradeFilter, linear, cam }: { b: CompBackdropArt; st: number; life: number; W: number; H: number; media: Media; idx: string; gradeFilter?: string; linear?: boolean; cam: Cam }) {
  const k = lerp(st, [0, life], [0, 1], linear ? undefined : smooth);
  const at = (a?: number, b1?: number, d = 0) => (a ?? d) + ((b1 ?? a ?? d) - (a ?? d)) * k;
  const cx = b.cx ?? 50, cy = b.cy ?? 50, rot = at(b.rot, b.rot1), dx = at(b.dx, b.dx1), dy = at(b.dy, b.dy1), depth = b.depth ?? 0.5;
  const z = Math.max(at(b.z, b.z1, 1.1), coverScale(cx, cy, dx, rot, W / H, dy) * Math.max(1, 1 / Math.pow(cam.punch, depth)) + 0.02 + Math.hypot(cam.sx, cam.sy) * depth / Math.min(W, H));
  const filter = [b.blur ? `blur(${b.blur}px)` : "", (b.dim ?? 0) > 0 || (b.lift ?? 0) > 0 ? `brightness(${((1 - Math.min(0.6, b.dim ?? 0)) * (1 + (b.lift ?? 0))).toFixed(3)})` : "", gradeFilter ?? ""].join(" ").trim() || undefined;
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", transform: camAt(cam, depth) }}>
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${cx}% ${cy}%`, transform: `translate3d(${dx}%, ${dy}%, 0) translate(${50 - cx}%, ${50 - cy}%) rotate(${rot}deg) scale(${z})`, filter, willChange: "transform" }}>
      {media(b.asset, (b.from ?? 0) + Math.max(0, st), { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }, idx)}
    </div>
  </div>;
}

function Lines({ kind, W, H, seed, color = "#fff" }: { kind: "focus" | "speed"; W: number; H: number; seed: number; color?: string }) {
  const n = kind === "focus" ? 70 : 40, els: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const r = (a: number) => random(`${seed}-${i}-${a}`);
    if (kind === "focus") { const a = r(1) * Math.PI * 2, w = 0.004 + r(2) * 0.012, R0 = 0.42 + r(3) * 0.2, R = 1.3, cx = W / 2, cy = H / 2; const pt = (ang: number, rr: number) => `${cx + Math.cos(ang) * rr * W},${cy + Math.sin(ang) * rr * W * 0.6}`; els.push(<polygon key={i} points={`${pt(a - w, R)} ${pt(a + w, R)} ${pt(a, R0)}`} fill={color} opacity={0.85} />); }
    else { const y = r(1) * H, len = W * (0.2 + r(2) * 0.5), x = r(3) * W * 1.2 - W * 0.2; els.push(<rect key={i} x={x} y={y} width={len} height={1 + r(4) * 4} fill={color} opacity={0.6} />); }
  }
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>{els}</svg>;
}

/** name-card title size: fits the band (62% of the width minus the 5% text inset, the -14° skew lean and padding), max 120px.
 *  CJK glyphs ~1em wide, Latin ~0.6em, plus the 10px stroke on both sides: a long name shrinks instead of spilling off the band. */
export function cardFontSize(name: string, W: number, max = 120) {
  const em = Array.from(name).reduce((a, ch) => a + (/[\u0000-\u024F]/.test(ch) ? 0.62 : 1), 0) || 1;
  const avail = W * (0.62 - 0.05) - Math.tan((14 * Math.PI) / 180) * 210 - 48 - 20;
  return Math.max(24, Math.min(max, Math.floor(avail / em)));
}
function NameCard({ c, f, red, W }: { c: NonNullable<SceneComp["card"]>; f: number; red: string; W: number }) {
  const s = lerp(f, [0, 7], [1, 0], ease), left = (c.side ?? "left") === "left", fs = cardFontSize(c.name, W);
  return <div style={{ position: "absolute", inset: 0 }}>
    <div style={{ position: "absolute", left: left ? 0 : undefined, right: left ? undefined : 0, bottom: "14%", width: "62%", height: 210, background: c.color ?? red, transform: `translateX(${(left ? -1 : 1) * s * 110}%) skewX(-14deg)`, boxShadow: "0 0 0 8px #000" }} />
    <div style={{ position: "absolute", [left ? "left" : "right"]: "5%", bottom: "16.5%", transform: `translateX(${(left ? -1 : 1) * s * 140}%)`, whiteSpace: "nowrap", textAlign: left ? "left" : "right" } as any}>
      {c.sub ? <div style={{ fontFamily: fam("Bebas Neue"), fontSize: 46, letterSpacing: 10, color: "#000" }}>{c.sub}</div> : null}
      <div style={{ fontFamily: "'Shippori Mincho B1', 'Shippori Mincho', 'Noto Serif JP', serif", fontWeight: 800, fontSize: fs, paddingInline: 10, color: "#fff", lineHeight: 1.0, WebkitTextStroke: "10px #000", paintOrder: "stroke fill" } as any}>{c.name}</div>
    </div>
  </div>;
}

/** preview-only approximation of a grade (the MP4 export applies the exact LUT to the clips with FFmpeg instead). */
export function GradeDefs({ data }: { data: any }) {
  const g = gradeOf(data); if (!g) return null;
  const sat = g.look === "mono" ? 0 : (g.base ?? 0.1) + 0.1;
  const table = Array.from({ length: 11 }, (_, i) => { const L = i / 10, t = Math.min(1, Math.max(0, (L - 0.06) / 0.86)), s = t * t * (3 - 2 * t); return (0.85 * s + 0.15 * L).toFixed(3); }).join(" ");
  return <svg width={0} height={0} style={{ position: "absolute" }}><defs><filter id="comp-grade" colorInterpolationFilters="sRGB">
    <feColorMatrix type="saturate" values={String(sat)} /><feComponentTransfer><feFuncR type="table" tableValues={table} /><feFuncG type="table" tableValues={table} /><feFuncB type="table" tableValues={table} /></feComponentTransfer>
  </filter></defs></svg>;
}

export function CompScene({ data, i, t, W, H, media, graded, under }: { data: any; i: number; t: number; W: number; H: number; media: Media; graded?: boolean; under?: boolean }) {
  const s = data.scenes[i], c: SceneComp = s.comp, fps = data.fps ?? 30, end = data.scenes[i + 1]?.start ?? data.duration;
  const g = globalComp(data), col = compColors(data), beat = 60 / (data.bpm ?? 120);
  const frame = Math.round(t * fps), from = Math.round(s.start * fps), len = Math.max(1, Math.ceil(end * fps - 1e-6) - from) /* the scene is shown while t < end, so its last frame is ceil(end·fps)-1 (end not on a frame boundary used to hide every panel on that frame) */, sf = frame - from, st = t - s.start;
  const active = fxActive(c, st);
  const cam = cameraOf(data);
  // shake: smooth noise (not a new random offset every frame), fading out; only scenes that set comp.shake (impact shots)
  const amp = (c.shake ?? 0) * Math.exp(-st * 3.2), nx = Math.max(0, st) * cam.shakeHz;
  const sx = noise1(`shx${i}`, nx) * amp, sy = noise1(`shy${i}`, nx + 17.3) * amp * 0.7;
  // punch-in: time-based ease-out over comp.camera.punchSec (was 3 frames -> a visible pop); only scenes that set comp.punch
  const pk = lerp(st, [0, cam.punchSec], [1, 0], ease), punch = 1 + (c.punch ?? 0) * pk * (c.enter === "zoom" ? 3 : 1), tilt = (c.tilt ?? 0) * pk;
  const neg = active.includes("redneg") || active.includes("tealneg"), chroma = active.includes("chroma");
  const enterK = c.enter === "slash" ? lerp(sf, [0, 5], [0, 1], ease) : 1;
  const wipeUnder = enterK < 1 && !under && i > 0 && !!data.scenes[i - 1]?.comp;
  const panels = resolvePanels(c, W, H, beat);
  const gradeFilter = !graded && gradeOf(data) ? "url(#comp-grade)" : undefined;
  const st0 = st, bk = ((t + 1e3 * beat) % beat) / beat;
  const growAt = panels.slice(1).map((p) => p.appear);
  const camNow: Cam = { sx, sy, punch, tilt }, bd = backdropOf(data, c), life = Math.max(1 / fps, len / fps);
  return <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
    <svg width={0} height={0} style={{ position: "absolute" }}><defs><filter id="comp-chroma" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" /><feOffset in="r" dx={-16} dy={0} result="r2" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" /><feOffset in="b" dx={16} dy={0} result="b2" />
      <feBlend in="r2" in2="g" mode="screen" result="rg" /><feBlend in="rg" in2="b2" mode="screen" /></filter></defs></svg>
    <GradeDefs data={data} />
    {/* slash wipe: the outgoing picture (previous scene, held on its last frame) stays under the wipe, so the wipe never shows black/backdrop */}
    {wipeUnder ? <div style={{ position: "absolute", inset: 0 }}><CompScene data={data} i={i - 1} t={Math.max(data.scenes[i - 1].start, (Math.ceil(s.start * fps - 1e-6) - 1) / fps)} W={W} H={H} media={media} graded={graded} under /></div> : null}
    {!wipeUnder && typeof bd === "object" ? <BackdropArt b={bd} st={Math.max(0, st)} life={life} W={W} H={H} media={media} idx={`${i}-bda`} gradeFilter={gradeFilter} linear={cam.ease === "linear"} cam={camNow} /> : null}
    {!wipeUnder && bd === "footage" && panels[0] ? <div style={{ position: "absolute", inset: 0, transform: "scale(1.15)", filter: `blur(18px) brightness(0.55) contrast(1.1)${gradeFilter ? " " + gradeFilter : ""}` }}>
      {/* deliberate backdrop: empty slots (before a panel appears, gaps of a growing grid, a slash wipe) show this scene's own footage, never plain black */}
      {media(panels[0].asset, panelSourceTime(panels[0], Math.max(0, st), undefined, fps), { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }, `${i}-bd`)}
    </div> : null}
    <div style={{ position: "absolute", inset: 0, transform: `translate3d(${sx.toFixed(2)}px,${sy.toFixed(2)}px,0) scale(${punch}) rotate(${tilt}deg)`, filter: [neg ? "invert(1) contrast(1.4)" : "", chroma ? "url(#comp-chroma)" : ""].join(" ").trim() || undefined, clipPath: enterK < 1 ? `polygon(0 0, ${enterK * 160}% 0, ${enterK * 160 - 60}% 100%, 0 100%)` : undefined }}>
      {panels.map((p, k) => {
        const a = Math.round(p.appear * fps), f = sf - a, until = p.until != null ? Math.round(p.until * fps) - a : len - a;
        if (f < 0 || f >= Math.max(1, Math.min(len - a, until))) return null;
        return <PanelView key={k} idx={`${i}-${k}`} p={p} f={f} life={Math.max(1, len - p.appear * fps)} fps={fps} W={W} H={H} media={media} gradeFilter={gradeFilter} linear={cam.ease === "linear"} cam={camNow} />;
      })}
      {c.border === "focus" ? <Lines kind="focus" W={W} H={H} seed={Math.floor(frame / 2)} /> : null}
      {c.border === "speed" ? <Lines kind="speed" W={W} H={H} seed={Math.floor(frame / 2)} /> : null}
      {c.border === "bolt" ? <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{[22, 8].map((w, j) => <polyline key={j} points={Array.from({ length: 13 }, (_, n) => `${W / 2 + (n % 2 ? 1 : -1) * (24 + random(`b${n}${Math.floor(frame / 3)}`) * 30)},${(n / 12) * H}`).join(" ")} fill="none" stroke={j ? (bk < 0.25 ? col.teal : "#fff") : "#000"} strokeWidth={w * (j && bk < 0.25 ? 1.8 : 1)} />)}</svg> : null}
      {c.border === "h" ? <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 10, marginTop: -5, background: "#fff", boxShadow: `0 0 30px ${col.red}, 0 0 0 6px #000` }} /> : null}
      {c.border === "grid" ? <><div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 10, marginLeft: -5, background: col.teal, boxShadow: "0 0 0 5px #000" }} /><div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 10, marginTop: -5, background: col.teal, boxShadow: "0 0 0 5px #000" }} /></> : null}
      {c.border === "grow" ? <>{growAt.filter((a) => st0 >= a).map((_, n) => <div key={n} style={{ position: "absolute", background: "#000", boxShadow: "0 0 0 3px #fff", ...(n === 0 ? { left: "50%", top: 0, bottom: 0, width: 14, marginLeft: -7 } : n === 1 ? { left: 0, width: "50%", top: "50%", height: 14, marginTop: -7 } : { left: "50%", right: 0, top: "50%", height: 14, marginTop: -7 }) }} />)}</> : null}
      {c.card ? <NameCard c={c.card} f={sf} red={col.red} W={W} /> : null}
    </div>
    {(g.halftone ?? 0) > 0 ? <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(0,0,0,.9) 28%, transparent 30%)", backgroundSize: "9px 9px", opacity: g.halftone, mixBlendMode: "multiply" }} /> : null}
    {(g.vignette ?? 0) > 0 ? <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${g.vignette}) 100%)` }} /> : null}
    {enterK < 1 && enterK > 0 ? <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><line x1={enterK * 1.6 * W} y1={0} x2={(enterK * 1.6 - 0.6) * W} y2={H} stroke="#fff" strokeWidth={18} /><line x1={enterK * 1.6 * W} y1={0} x2={(enterK * 1.6 - 0.6) * W} y2={H} stroke={col.red} strokeWidth={6} /></svg> : null}
    {active.includes("white") ? <div style={{ position: "absolute", inset: 0, background: "#fff" }} /> : null}
    {active.includes("redneg") ? <div style={{ position: "absolute", inset: 0, background: col.red, mixBlendMode: "multiply" }} /> : null}
    {active.includes("tealneg") ? <div style={{ position: "absolute", inset: 0, background: col.teal, mixBlendMode: "multiply" }} /> : null}
    {c.title ? <CompTitle c={c.title} st={st} fps={fps} red={col.red} teal={col.teal} /> : null}
  </div>;
}

function CompTitle({ c, st, fps, red, teal }: { c: NonNullable<SceneComp["title"]>; st: number; fps: number; red: string; teal: string }) {
  const lt = st - (c.at ?? 0); if (lt < 0) return null;
  const base: any = { whiteSpace: "nowrap", fontFamily: fam("Dela Gothic One"), color: "#fff", WebkitTextStroke: "14px #000", paintOrder: "stroke fill" };
  if ((c.style ?? "slam") === "logo") return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: lerp(lt, [0, 0.1], [1, 0]) > 0 ? "#fff" : undefined }}>
    <div style={{ ...base, fontSize: 200, textShadow: `-10px 0 0 ${teal}, 10px 0 0 ${red}`, transform: `scale(${lerp(lt, [0, 0.15], [1.4, 1], ease)})` }}>{c.text}</div></div>;
  return <div style={{ ...base, position: "absolute", left: "50%", top: "50%", fontSize: 150, textShadow: `12px 12px 0 ${red}`, transform: `translate(-50%,-50%) rotate(-10deg) scale(${lerp(Math.round(lt * fps), [0, 3], [1.25, 1])})` }}>{c.text}</div>;
}
