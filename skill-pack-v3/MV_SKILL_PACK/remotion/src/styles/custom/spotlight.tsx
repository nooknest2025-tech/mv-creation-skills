// Lyric style "spotlight" (made with npm run style:new): スポットライト.
// The whole line sits dimmed; a soft circle of light glides to the glyph being sung and lights it (sung glyphs stay lit, warmer);
// the light breathes on the beat.
import React from "react";
import { beatPulse, clamp, easeOut } from "../../lib/core";
import { layoutH } from "../layout";
import { boxesH, drawH, exitP, sungP, type StyleFn } from "../prims";

export const spotlight: StyleFn = (c) => {
  const P = c.P;
  const l = layoutH(c.L, c.W, c.H, { size: Number(P.size_base ?? 0.07), v: c.textY, k: c.k, maxw: 0.84 });
  const ex = exitP(c.L, c.t), on = easeOut(clamp((c.t - c.L.tOn) / 0.3)) * (1 - easeOut(ex, 2));
  const dim = Number(P.dim ?? 0.28), warm = String(P.light_color ?? "#ffe9b0");
  // light position: interpolate between the current and next glyph (smooth glide)
  const chars = c.L.chars;
  let k = 0; while (k < chars.length - 1 && c.t >= chars[k + 1].t0) k++;
  const f = k < chars.length - 1 ? clamp((c.t - chars[k].t0) / Math.max(0.05, chars[k + 1].t0 - chars[k].t0)) : 0;
  const [ax, ay] = l.pos[k] ?? [c.W / 2, c.H / 2], [bx, by] = l.pos[Math.min(k + 1, l.pos.length - 1)] ?? [ax, ay];
  const e = easeOut(f, 2), lx = ax + (bx - ax) * e, ly = ay + (by - ay) * e;
  const R = l.px * (1.5 + 0.25 * beatPulse(c.beat, c.t, 0.15));
  const txt = drawH(c, l, (i) => {
    const sung = sungP(c.L, i, c.t), d = Math.hypot(l.pos[i][0] - lx, l.pos[i][1] - ly) / R;
    const lit = Math.max(clamp(1.2 - d), sung > 0 ? 0.75 : 0);
    return { a: on * (dim + (1 - dim) * lit), fill: lit > 0.5 ? "#ffffff" : "#b9b3c4", shadow: lit > 0.3 ? `0 0 ${l.px * 0.35 * lit}px ${warm}` : undefined };
  }, { font: "stamp", sw: 0.04, exit: "none" });
  const beam = <div style={{ position: "absolute", left: lx, top: ly, width: R * 2.6, height: R * 2.6, transform: "translate(-50%,-50%)", borderRadius: "50%",
    background: `radial-gradient(circle, ${warm}aa 0%, ${warm}44 40%, transparent 70%)`, opacity: on, mixBlendMode: "screen" }} />;
  const shade = <div style={{ position: "absolute", left: l.box[0] - l.px, top: l.box[1] - l.px * 0.6, width: l.box[2] - l.box[0] + 2 * l.px, height: l.box[3] - l.box[1] + l.px * 1.2,
    borderRadius: l.px * 0.5, background: "rgba(5,3,10,0.6)", filter: `blur(${l.px * 0.3}px)`, opacity: on }} />;
  return { el: <>{shade}{beam}{txt.el}</>, boxes: boxesH(l) };
};
