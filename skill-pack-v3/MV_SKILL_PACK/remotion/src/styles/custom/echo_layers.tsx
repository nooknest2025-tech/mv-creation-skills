// Outlined lyric echoes expand above/below the readable foreground line.
import React from "react";
import { clamp, easeOut } from "../../lib/core";
import { layoutH } from "../layout";
import { drawH, exitP, type StyleFn } from "../prims";

export const echoLayers: StyleFn = (c) => {
  const P = c.P;
  const l = layoutH(c.L, c.W, c.H, { size: Number(P.size_base ?? 0.075), v: c.textY, k: c.k, maxw: 0.84 });
  const enter = Math.max(0.08, Number(P.enter ?? 0.32));
  const gap = Math.max(0.5, Math.min(2, Number(P.echo_gap ?? 1.12)));
  const echoOpacity = clamp(Number(P.echo_opacity ?? 0.3));
  const travel = Math.max(0, Math.min(1, Number(P.travel ?? 0.35)));
  const expand = easeOut(clamp((c.t - c.L.tOn) / enter), 3);
  const fade = 1 - easeOut(exitP(c.L, c.t), 2);
  const state = (_i: number, age: number) => {
    if (age < 0) return null;
    const p = easeOut(clamp(age / enter), 3);
    return { a: p, dy: (1 - p) * l.px * travel };
  };
  const foreground = drawH(c, l, state, { font: "sans", sw: 0.035 });
  const ghost = drawH(c, l, (i, age) => { const s = state(i, age); return s && { ...s, a: s.a * echoOpacity, shadow: "none" }; }, { font: "sans", fill: "transparent", stroke: "var(--lyric-accent, #ff46a0)", sw: 0.022 });
  const distance = l.lh * gap * expand;
  const roomAbove = l.box[1] - distance >= c.H * 0.03;
  const roomBelow = l.box[3] + distance <= c.H * 0.97;
  return { el: <>
    {roomAbove && <div style={{ transform: `translateY(${-distance}px)`, opacity: fade, pointerEvents: "none" }}>{ghost.el}</div>}
    {roomBelow && <div style={{ transform: `translateY(${distance}px)`, opacity: fade, pointerEvents: "none" }}>{ghost.el}</div>}
    {foreground.el}
  </>, boxes: foreground.boxes };
};
