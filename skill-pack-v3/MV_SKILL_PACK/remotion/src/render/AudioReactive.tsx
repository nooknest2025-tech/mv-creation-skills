// TouchDesigner-style audio-reactive layers, natively in Remotion:
// spectrum (bars / ring / wave) from the song's FFT, generative backgrounds (plasma / tunnel / flow / rings)
// drawn per frame on a low-res canvas, bass-driven particle emission and feedback-style echo trails.
import React, { useEffect, useRef } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { rng } from "../lib/core";
import { letterboxPx } from "../lib/finish";
import type { RenderProps, VisualFx } from "../lib/types";

type Spec = (f: number) => number[];
/** returns a function frame -> 32 spectrum bins (0..1). Falls back to the loudness envelope when no audio. */
export function useSpectrum(p: RenderProps): Spec {
  const { fps } = useVideoConfig();
  const audio = p.audio ? (/^(https?:|data:)/.test(p.audio) ? p.audio : staticFile(p.audio)) : null;
  const data = audio ? useAudioData(audio) : null; // eslint-disable-line react-hooks/rules-of-hooks
  return (f: number) => {
    const af = Math.max(0, Math.round(f + p.startAt * fps));
    if (data) return visualizeAudio({ fps, frame: af, audioData: data, numberOfSamples: 32, optimizeFor: "speed" }).map((v) => Math.min(1, Math.sqrt(v) * 1.6));
    const e = p.energy?.length && p.energyHz ? p.energy[Math.min(p.energy.length - 1, Math.floor((af / fps) * p.energyHz))] ?? 0 : 0.3;
    return Array.from({ length: 32 }, (_, i) => e * (1 - i / 40));
  };
}
const bass = (s: number[]) => (s[0] + s[1] + s[2] + s[3]) / 4;

const PAL: Record<string, [number, number, number][]> = {
  chorus: [[255, 40, 140], [120, 40, 255], [255, 160, 40]], verse: [[30, 60, 160], [90, 30, 160], [20, 160, 200]],
  intro: [[20, 30, 90], [80, 40, 140], [30, 90, 160]], bridge: [[20, 90, 110], [40, 60, 120], [120, 200, 220]],
  pre_chorus: [[150, 20, 60], [220, 80, 60], [90, 20, 120]], outro: [[40, 50, 90], [120, 70, 110], [20, 20, 40]], other: [[60, 60, 120], [140, 60, 160], [40, 140, 180]],
};

/** generative background on a 192x108 canvas, upscaled (cheap per frame). trails = feedback echoes. */
export const GenBg: React.FC<{ kind: NonNullable<VisualFx["bg"]>; t: number; level: number; sec: string; trails: number; opacity?: number; blend?: boolean }> = ({ kind, t, level, sec, trails, opacity = 1, blend }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = 192, h = 108;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; const img = ctx.createImageData(w, h); const d = img.data;
    const pal = PAL[sec] ?? PAL.other;
    const echoes = Math.round(trails * 5);
    d.fill(0);
    for (let e = echoes; e >= 0; e--) {
      const te = t - e * 0.06, fade = Math.pow(0.55, e), zoom = 1 + e * 0.04 * trails;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = ((x / w - 0.5) / zoom) * 1.78, v = (y / h - 0.5) / zoom;
        let q = 0;
        if (kind === "plasma") q = (Math.sin(u * 6 + te) + Math.sin(v * 7 - te * 1.3) + Math.sin((u + v) * 5 + te * 0.7) + Math.sin(Math.hypot(u, v) * 12 - te * 2 * (1 + level))) / 4;
        else if (kind === "tunnel") { const r = Math.hypot(u, v) + 1e-3, a = Math.atan2(v, u); q = Math.sin(1 / r * 2 + te * 3 * (0.6 + level)) * Math.sin(a * 6 + te); q *= Math.min(1, r * 3); }
        else if (kind === "rings") { const r = Math.hypot(u, v); q = Math.sin(r * 30 - te * 6 - level * 8) * Math.exp(-r * 2); }
        else { const a = Math.sin(u * 3 + Math.sin(v * 4 + te) * 1.5 + te * 0.5); q = Math.sin(a * 4 + v * 6 - te); }
        const k = (q + 1) / 2, i = (y * w + x) * 4;
        const c0 = pal[0], c1 = pal[1], c2 = pal[2], m = k < 0.5 ? k * 2 : (k - 0.5) * 2;
        const A = k < 0.5 ? c0 : c1, B = k < 0.5 ? c1 : c2, br = (0.35 + 0.65 * level) * fade * (0.5 + 0.5 * k);
        d[i] = Math.max(d[i], (A[0] + (B[0] - A[0]) * m) * br); d[i + 1] = Math.max(d[i + 1], (A[1] + (B[1] - A[1]) * m) * br); d[i + 2] = Math.max(d[i + 2], (A[2] + (B[2] - A[2]) * m) * br); d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [t, kind, level, sec, trails]);
  return <AbsoluteFill style={{ opacity, mixBlendMode: blend ? "screen" : undefined }}><canvas ref={ref} width={w} height={h} style={{ width: "100%", height: "100%", filter: "blur(6px) saturate(1.2)", transform: "scale(1.05)" }} /></AbsoluteFill>;
};

export const Spectrum: React.FC<{ kind: NonNullable<VisualFx["spectrum"]>; s: number[]; W: number; H: number; colour?: string; trails?: number; past?: number[][]; base?: number }> = ({ kind, s, W, H, colour = "#fff", past = [], base = 0.97 }) => {
  if (kind === "none") return null;
  const U = Math.min(W, H);
  const draw = (sp: number[], a: number, key: number) => {
    if (kind === "bars") { const n = sp.length, bw = (W * 0.6) / n; return <g key={key} opacity={a}>{sp.map((v, i) => <rect key={i} x={W * 0.2 + i * bw + bw * 0.15} y={H * base - v * H * 0.22} width={bw * 0.7} height={Math.max(2, v * H * 0.22)} rx={bw * 0.2} fill={colour} />)}</g>; }
    if (kind === "ring") { const r0 = U * 0.18; return <g key={key} opacity={a}>{[...sp, ...sp.slice().reverse()].map((v, i, arr) => { const ang = (i / arr.length) * Math.PI * 2 - Math.PI / 2; const r1 = r0 + v * U * 0.14; return <line key={i} x1={W / 2 + Math.cos(ang) * r0} y1={H / 2 + Math.sin(ang) * r0} x2={W / 2 + Math.cos(ang) * r1} y2={H / 2 + Math.sin(ang) * r1} stroke={colour} strokeWidth={U * 0.008} strokeLinecap="round" />; })}</g>; }
    const pts = sp.map((v, i) => `${(i / (sp.length - 1)) * W},${H * 0.5 - (i % 2 ? 1 : -1) * v * H * 0.18}`).join(" ");
    return <polyline key={key} points={pts} fill="none" stroke={colour} strokeWidth={U * 0.006} opacity={a} />;
  };
  return <AbsoluteFill style={{ mixBlendMode: "screen", filter: `drop-shadow(0 0 ${U * 0.012}px ${colour})` }}><svg width={W} height={H}>{past.map((sp, i) => draw(sp, 0.35 * Math.pow(0.6, i), i + 1))}{draw(s, 0.85, 0)}</svg></AbsoluteFill>;
};

/** particles emitted on bass hits (deterministic: each past frame spawns n ∝ bass). */
export const AudioParticles: React.FC<{ spec: Spec; frame: number; amt: number; W: number; H: number; colour?: string }> = ({ spec, frame, amt, W, H, colour = "#ffe7b0" }) => {
  const { fps } = useVideoConfig();
  if (amt <= 0) return null;
  const life = Math.round(fps * 1.4), U = Math.min(W, H), out: React.ReactNode[] = [];
  for (let k = 0; k < life; k += 2) {
    const f0 = frame - k; if (f0 < 0) break;
    const b = bass(spec(f0)); const n = Math.floor(b * b * 10 * amt);
    for (let j = 0; j < n; j++) {
      const r = rng("ap", f0, j), age = k / fps, ang = r.uniform(0, Math.PI * 2), sp = r.uniform(0.15, 0.6) * U;
      const x = W / 2 + Math.cos(ang) * (U * 0.05 + sp * age), y = H / 2 + Math.sin(ang) * (U * 0.05 + sp * age) + 0.1 * U * age * age;
      const a = (1 - k / life) * r.uniform(0.5, 1), sz = r.uniform(2, 7) * (U / 1080);
      out.push(<div key={`${f0}_${j}`} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%", background: colour, opacity: a, boxShadow: `0 0 ${sz * 3}px ${colour}` }} />);
    }
  }
  return <AbsoluteFill style={{ mixBlendMode: "screen" }}>{out}</AbsoluteFill>;
};

/** all reactive layers for the current frame. */
export const Reactive: React.FC<{ p: RenderProps; sec: string; hasMedia: boolean; layer: "bg" | "fg" }> = ({ p, sec, hasMedia, layer }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const v = p.visuals ?? {};
  const spec = useSpectrum(p);
  const t = p.startAt + frame / fps;
  const s = spec(frame), lvl = Math.min(1, bass(s) * 1.2);
  if (layer === "bg") {
    const kind = v.bg && v.bg !== "none" ? v.bg : !hasMedia ? "flow" : null;
    if (!kind) return null;
    return <GenBg kind={kind} t={t} level={lvl} sec={sec} trails={v.trails ?? 0} opacity={hasMedia ? v.bgOpacity ?? 0.35 : 1} blend={hasMedia} />;
  }
  const past = (v.trails ?? 0) > 0 ? [1, 2, 3].slice(0, Math.ceil((v.trails ?? 0) * 3)).map((k) => spec(Math.max(0, frame - k * 2))) : [];
  return <>
    {v.spectrum && v.spectrum !== "none" && <Spectrum kind={v.spectrum} s={s} W={W} H={H} past={past} base={1 - letterboxPx(p.finish, W, H) / H - 0.03} colour={sec === "chorus" ? "#ff5fb0" : "#9fe8ff"} />}
    {(v.audioParticles ?? 0) > 0 && <AudioParticles spec={spec} frame={frame} amt={v.audioParticles!} W={W} H={H} />}
  </>;
};
