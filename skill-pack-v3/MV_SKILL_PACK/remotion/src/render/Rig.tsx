// Parts-animation renderer: nested part tree, each part a full-canvas PNG transformed around its pivot.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { solveRig, type Part, type PartPose, type Rig } from "../lib/rig";
import type { RenderProps } from "../lib/types";

const src = (s: string) => (/^(https?:|data:|blob:)/.test(s) ? s : staticFile(s));
const T = (p: Part, q: PartPose | undefined) => { const v = q ?? { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }; return { transformOrigin: `${p.pivot[0]}px ${p.pivot[1]}px`, transform: `translate(${v.dx}px, ${v.dy}px) rotate(${v.rot}deg) scale(${v.sx}, ${v.sy})` }; };
/** flat draw in global z order; each part is wrapped in its ancestors' transforms (so z order is never trapped inside a parent). */
export const RigView: React.FC<{ r: Rig; pose: Record<string, PartPose> }> = ({ r, pose }) => {
  const [W, H] = r.size, byId = new Map(r.parts.map((p) => [p.id, p]));
  const chain = (p: Part) => { const c: Part[] = []; let q: Part | undefined = p; const seen = new Set<string>(); while (q && !seen.has(q.id)) { seen.add(q.id); c.unshift(q); q = q.parent ? byId.get(q.parent) : undefined; } return c; };
  return <>{[...r.parts].sort((a, b) => a.z - b.z).map((p) => {
    const q = pose[p.id], file = q?.state && p.states?.[q.state] ? p.states[q.state] : p.src;
    const img = <Img src={src(file)} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
    return <React.Fragment key={p.id}>{chain(p).reduceRight<React.ReactNode>((inner, a) => <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...T(a, pose[a.id]) }}>{inner}</div>, img)}</React.Fragment>;
  })}</>;
};
/** character layer for the MV: placed bottom-anchored at parts.x, height parts.h of the frame, presets per section. */
export const PartsLayer: React.FC<{ p: RenderProps }> = ({ p }) => {
  const f = useCurrentFrame(); const { width: W, height: H, fps } = useVideoConfig();
  const P = p.parts; if (!P) return null;
  const t = p.startAt + f / fps, seg = P.segments.find((s) => t >= s.start && t < s.end);
  if (!seg || seg.preset === "off") return null;
  const r = P.rig, sc = (H * (P.h ?? 0.9)) / r.size[1];
  const live = p.lines.filter((L) => t >= L.start - 0.2 && t < L.end + 0.2);
  const mora = live.flatMap((L) => L.chars.map((c) => ({ t0: c.t0, t1: c.t1, ch: c.ch })));
  const pose = solveRig(r, seg.preset, t, { beat: p.beat, energy: seg.energy, mora, sectionType: seg.type });
  const x = (P.x ?? 0.5) * W - (r.size[0] * sc) / 2, y = H - r.size[1] * sc + H * (P.dy ?? 0.02);
  return <AbsoluteFill style={{ overflow: "hidden" }}><div style={{ position: "absolute", left: x, top: y, width: r.size[0], height: r.size[1], transformOrigin: "0 0", transform: `scale(${sc})` }}><RigView r={r} pose={pose} /></div></AbsoluteFill>;
};
