// Visual layer: beat-synced montage of stills/clips with camera moves, pseudo-2.5D parallax, light leaks,
// particles, beat shake, transitions and per-section grade. Falls back to generative abstract visuals.
import React from "react";
import { clipPlan, clipSourceTime } from "../lib/clipspeed";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PuppetImage } from "./Puppet";
import { Reactive } from "./AudioReactive";
import { FinishTop, Glow } from "./Finish";
import { rampProgress } from "../lib/ramp";
import { beatPulse, clamp, easeOut, rng } from "../lib/core";
import type { RenderProps, Shot } from "../lib/types";
import { CAMERA_MOVES, FxStage, activeFx, cameraPose } from "./SceneFx";
const PACK_MOVES = new Set(["kb_in", "kb_out", "drift_l", "drift_r", "push", "face_push", "slow_push", "zoom_punch", "whip_l", "whip_r", "crane_up", "shake", "parallax"]);

const src = (s: string) => (/^(https?:|data:|blob:)/.test(s) ? s : staticFile(s));

/** camera move -> transform at progress p (0..1) of the shot. */
export function moveTransform(move: string, p: number, seed: number, W: number): { s: number; x: number; y: number; r: number } {
  const e = p, r = rng(seed, move);
  const dir = r.next() > 0.5 ? 1 : -1;
  switch (move) {
    case "kb_in": return { s: 1.06 + 0.12 * easeOut(e, 2), x: dir * 0.02 * e, y: -0.01 * e, r: 0 };
    case "kb_out": return { s: 1.2 - 0.12 * easeOut(e, 2), x: -dir * 0.02 * e, y: 0.01 * e, r: 0 };
    case "drift_l": return { s: 1.12, x: 0.035 - 0.07 * e, y: 0, r: 0 };
    case "drift_r": return { s: 1.12, x: -0.035 + 0.07 * e, y: 0, r: 0 };
    case "push": return { s: 1.04 + 0.22 * easeOut(e, 3), x: 0, y: 0, r: 0 };
    case "face_push": return { s: 1.15 + 0.2 * easeOut(e, 2), x: 0, y: 0.04, r: 0 };
    case "slow_push": return { s: 1.0 + 0.06 * e, x: 0, y: 0, r: 0 };
    case "zoom_punch": return { s: 1.3 - 0.2 * easeOut(clamp(e * 3), 4), x: 0, y: 0, r: dir * 1.5 * (1 - easeOut(clamp(e * 3))) };
    case "whip_l": case "whip_r": { const d = move === "whip_l" ? 1 : -1; return { s: 1.12, x: d * 0.3 * (1 - easeOut(clamp(e * 4), 4)), y: 0, r: 0 }; }
    case "crane_up": return { s: 1.15, x: 0, y: 0.04 - 0.08 * easeOut(e, 2), r: 0 };
    case "shake": return { s: 1.15, x: r.uniform(-0.01, 0.01), y: 0, r: 0 };
    case "parallax": return { s: 1.1 + 0.05 * e, x: dir * (0.03 - 0.06 * e), y: 0, r: 0 };
    default: return { s: 1.04, x: 0, y: 0, r: 0 };
  }
}

const Media: React.FC<{ shot: Shot; W: number; H: number; fps: number; p: number; extraScale?: number; blur?: number; rp: RenderProps; t: number }> = ({ shot, W, H, fps, p, extraScale = 1, blur = 0, rp, t }) => {
  const q = rampProgress(shot.ramp, p);
  const useFx = !!CAMERA_MOVES[shot.move] && (!PACK_MOVES.has(shot.move) || !!shot.camStrength || !!shot.camSync);
  const cp = useFx ? cameraPose(shot.move, { p: q, t, t0: shot.start, dur: Math.max(0.1, shot.end - shot.start), beat: rp.beat, seed: Math.round(shot.start * 1000), W, sync: shot.camSync, accents: rp.accents }, shot.camStrength) : null;
  const m = cp ?? moveTransform(shot.move, q, shot.start * 1000, W);
  if (cp) blur = blur + cp.blur + (cp.focus ?? 0);
  const fo = shot.face?.eyes?.length ? faceC(shot.face) : shot.focus;
  const origin = fo ? `${(fo[0] * 100).toFixed(1)}% ${(fo[1] * 100).toFixed(1)}%` : "50% 50%";
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: origin, transformOrigin: origin, transform: `translate(${m.x * W}px, ${m.y * H}px) scale(${m.s * extraScale}) rotate(${m.r}deg)${cp?.ry ? ` perspective(1400px) rotateY(${cp.ry}deg)` : ""}`, filter: blur ? `blur(${blur}px)` : undefined };
  if (!shot.src) return <AbsoluteFill style={{ background: "#000" }} />;
  if (shot.kind === "video") {
    const rate = shot.rate ?? 1, dur = shot.end - shot.start;
    if (shot.speed !== undefined || shot.fit || shot.tail || shot.clipTo !== undefined || shot.segments?.length) { // user speed/stretch/in-point: identical mapping to the editor (audio untouched; clip muted)
      const at = clipSourceTime(clipPlan(shot, dur, shot.clipDur), p * dur);
      return <Freeze frame={Math.max(0, Math.round(at * fps))}><OffthreadVideo src={src(shot.src)} muted volume={0} style={style} /></Freeze>;
    }
    if (shot.ramp && shot.ramp !== "none") {
      // time remap: show the source frame at clipFrom + F(u) * dur * rate
      const sf = Math.round(((shot.clipFrom ?? 0) + q * dur * rate) * fps);
      return <Freeze frame={sf}><OffthreadVideo src={src(shot.src)} muted style={style} /></Freeze>;
    }
    return <OffthreadVideo src={src(shot.src)} muted startFrom={Math.round((shot.clipFrom ?? 0) * fps)} playbackRate={rate} style={style} />;
  }
  if (shot.size) return <AbsoluteFill style={{ transformOrigin: origin, transform: style.transform }}><PuppetImage shot={shot} W={W} H={H} t={t} p={rp} style={{}} blur={blur} /></AbsoluteFill>;
  return <Img src={src(shot.src)} style={style} />;
};
const faceC = (f: NonNullable<Shot["face"]>): [number, number] => { const pts = [...f.eyes.map((e) => [e[0], e[1]]), ...(f.mouth ? [[f.mouth[0], f.mouth[1]]] : [])]; return [pts.reduce((a, b) => a + b[0], 0) / pts.length, pts.reduce((a, b) => a + b[1], 0) / pts.length]; };

/** generative abstract background when there are no images/clips (energy + beat reactive). */
export const Abstract: React.FC<{ t: number; p: RenderProps; sectionType: string }> = ({ t, p, sectionType }) => {
  const { width: W, height: H } = useVideoConfig();
  const bp = beatPulse(p.beat, t, 0.15);
  const pal: Record<string, [string, string, string]> = {
    intro: ["#0b1026", "#1d2b64", "#6a3093"], verse: ["#0f0c29", "#302b63", "#24243e"], pre_chorus: ["#200122", "#6f0000", "#c94b4b"],
    chorus: ["#ff0080", "#7928ca", "#ff8a00"], bridge: ["#0f2027", "#203a43", "#2c5364"], outro: ["#141e30", "#243b55", "#0b0b0b"], other: ["#111", "#333", "#555"],
  };
  const [a, b, c] = pal[sectionType] ?? pal.other;
  const ang = (t * 12) % 360;
  const blobs = [...Array(5)].map((_, k) => {
    const r = rng("blob", k);
    const x = (0.5 + 0.35 * Math.sin(t * r.uniform(0.1, 0.3) + k)) * W, y = (0.5 + 0.35 * Math.cos(t * r.uniform(0.1, 0.25) + k * 2)) * H, s = Math.min(W, H) * r.uniform(0.35, 0.7) * (1 + 0.08 * bp);
    return <div key={k} style={{ position: "absolute", left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: "50%", background: k % 2 ? b : c, filter: `blur(${s * 0.18}px)`, opacity: 0.55 }} />;
  });
  return <AbsoluteFill style={{ background: `linear-gradient(${ang}deg, ${a}, ${b})` }}>{blobs}
    <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)", opacity: 0.6 }} /></AbsoluteFill>;
};

const LightLeak: React.FC<{ t: number; amt: number; seed: number }> = ({ t, amt, seed }) => {
  if (amt <= 0) return null;
  const r = rng("leak", seed);
  const x = 50 + 45 * Math.sin(t * 0.4 + r.uniform(0, 6)), y = 30 + 40 * Math.cos(t * 0.33 + r.uniform(0, 6));
  return <AbsoluteFill style={{ mixBlendMode: "screen", opacity: amt * (0.35 + 0.25 * Math.sin(t * 0.9 + seed)), background: `radial-gradient(ellipse 60% 45% at ${x}% ${y}%, rgba(255,150,60,0.9), rgba(255,60,120,0.35) 40%, transparent 70%)` }} />;
};

const Particles: React.FC<{ t: number; amt: number; W: number; H: number }> = ({ t, amt, W, H }) => {
  if (amt <= 0) return null;
  const n = Math.round(40 * amt);
  return <AbsoluteFill style={{ mixBlendMode: "screen" }}>{[...Array(n)].map((_, k) => {
    const r = rng("dust", k), sp = r.uniform(0.01, 0.05), sz = r.uniform(2, 6) * (Math.min(W, H) / 1080);
    const x = ((r.next() + t * sp * 0.3 + 0.02 * Math.sin(t + k)) % 1) * W, y = ((r.next() - t * sp) % 1 + 1) % 1 * H;
    return <div key={k} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%", background: "#fff6dc", opacity: r.uniform(0.25, 0.8) * (0.6 + 0.4 * Math.sin(t * 2 + k)), boxShadow: `0 0 ${sz * 3}px #ffe2a8` }} />;
  })}</AbsoluteFill>;
};

/** transition overlay at the start of a shot. */
const TransitionFx: React.FC<{ kind: string; age: number; W: number; H: number }> = ({ kind, age, W }) => {
  const d = 0.22;
  if (age > d || kind === "cut" || kind === "none") return null;
  const q = age / d;
  if (kind === "flash") return <AbsoluteFill style={{ background: "#fff", opacity: 0.85 * (1 - q) }} />;
  if (kind === "fade") return <AbsoluteFill style={{ background: "#000", opacity: 0.9 * (1 - easeOut(q, 2)) }} />;
  if (kind === "glitch") return <AbsoluteFill style={{ background: `repeating-linear-gradient(0deg, rgba(255,0,120,0.5) 0 ${4 + 20 * (1 - q)}px, rgba(0,255,255,0.4) 0 ${10 + 30 * (1 - q)}px, transparent 0 40px)`, opacity: 1 - q, mixBlendMode: "screen" }} />;
  if (kind === "zoom") return <AbsoluteFill style={{ background: "radial-gradient(circle, transparent 30%, rgba(255,255,255,0.7))", opacity: 1 - q }} />;
  if (kind === "whip") return <AbsoluteFill style={{ backdropFilter: `blur(${(1 - q) * 30}px)`, WebkitBackdropFilter: `blur(${(1 - q) * 30}px)`, opacity: 1 - q }} />;
  return null;
};

export const Visuals: React.FC<{ p: RenderProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const t = p.startAt + frame / fps;
  const shot = p.shots.find((s) => t >= s.start && t < s.end) ?? p.shots[p.shots.length - 1];
  const hasMedia = p.shots.some((s) => s.src);
  const bp = beatPulse(p.beat, t, 0.1);
  const r = rng("shake", Math.floor(t * fps));
  const sh = (p.shake ?? 0) * bp * Math.min(W, H) * 0.012;
  const grade = shot?.grade ?? p.grade;
  return <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
    <Glow f={p.finish} U={Math.min(W, H)}><AbsoluteFill style={{ transform: `translate(${r.uniform(-1, 1) * sh}px, ${r.uniform(-1, 1) * sh}px) scale(${1 + 0.012 * (p.shake ?? 0) * bp})`, filter: grade?.filter && grade.filter !== "none" ? grade.filter : undefined }}>
      {!hasMedia || !shot ? (p.visuals?.bg && p.visuals.bg !== "none" ? <Reactive p={p} sec={shot?.sectionType ?? "other"} hasMedia={false} layer="bg" /> : <Abstract t={t} p={p} sectionType={shot?.sectionType ?? "other"} />) :
        p.shots.map((s) => {
          // frame-exact activity: the same rounded boundaries decide visibility and the Sequence window (no 1-frame black gap between shots)
          const from = Math.round((s.start - p.startAt) * fps), to = Math.round((s.end - p.startAt) * fps);
          const isLast = s === p.shots[p.shots.length - 1];
          if (!(frame >= from && (frame < to || (isLast && frame >= to)))) return null;
          const prog = clamp((t - s.start) / Math.max(0.01, s.end - s.start));
          return <Sequence key={s.id} from={from} durationInFrames={Math.max(1, to - from + (isLast ? fps : 0))} layout="none">
            {s.move === "parallax" && s.kind === "image" ? <>
              {/* pseudo 2.5D: blurred far layer moves slower, sharp mid layer faster, vignette mask fakes depth */}
              <AbsoluteFill><Media shot={{ ...s, move: "drift_l", puppet: undefined }} W={W} H={H} fps={fps} p={prog} extraScale={1.25} blur={Math.min(W, H) * 0.012} rp={p} t={t} /></AbsoluteFill>
              <AbsoluteFill style={{ WebkitMaskImage: "radial-gradient(ellipse 62% 70% at 50% 50%, #000 55%, transparent 80%)", maskImage: "radial-gradient(ellipse 62% 70% at 50% 50%, #000 55%, transparent 80%)" }}><Media shot={s} W={W} H={H} fps={fps} p={prog} extraScale={1.08} rp={p} t={t} /></AbsoluteFill>
            </> : s.fx?.length || p.effectRanges?.length ? <FxStage W={W} H={H} t={t} frame={frame} fx={activeFx(s.fx, p.effectRanges, t)} t0={s.start} t1={s.end} seed={Math.round(s.start * 13)} beat={p.beat} accents={p.accents} picture={() => <AbsoluteFill><Media shot={s} W={W} H={H} fps={fps} p={prog} rp={p} t={t} /></AbsoluteFill>} />
              : <AbsoluteFill><Media shot={s} W={W} H={H} fps={fps} p={prog} rp={p} t={t} /></AbsoluteFill>}
          </Sequence>;
        })}
      {hasMedia && p.visuals?.bg && p.visuals.bg !== "none" && <Reactive p={p} sec={shot?.sectionType ?? "other"} hasMedia layer="bg" />}
      {grade?.tint && <AbsoluteFill style={{ background: grade.tint, mixBlendMode: "soft-light" }} />}
    </AbsoluteFill></Glow>
    <LightLeak t={t} amt={(p.leaks ?? 0) * (shot?.sectionType === "chorus" ? 1 : 0.6)} seed={shot ? Math.floor(shot.start) : 0} />
    <Particles t={t} amt={p.particles ?? 0} W={W} H={H} />
    {shot && <TransitionFx kind={shot.transition ?? "cut"} age={t - shot.start} W={W} H={H} />}
    {(p.visuals?.spectrum && p.visuals.spectrum !== "none" || (p.visuals?.audioParticles ?? 0) > 0) && <Reactive p={p} sec={shot?.sectionType ?? "other"} hasMedia={hasMedia} layer="fg" />}
    <FinishTop f={p.finish} W={W} H={H} frame={frame} vignette={grade?.vignette ?? 0.3} grain={grade?.grain ?? 0} />
  </AbsoluteFill>;
};
