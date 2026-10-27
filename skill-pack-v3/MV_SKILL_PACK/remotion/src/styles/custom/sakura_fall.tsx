// Lyric style "sakura_fall" (made with npm run style:new): 桜吹雪.
// Each glyph drifts down like a petal (side sway + spin), lands on its slot; pink petals flutter around the line;
// on exit the glyphs are blown up-and-right by the wind.
import React from "react";
import { beatPulse, clamp, easeOut, rng } from "../../lib/core";
import { layoutH } from "../layout";
import { boxesH, drawH, exitP, type StyleFn } from "../prims";

export const sakuraFall: StyleFn = (c) => {
  const P = c.P;
  const l = layoutH(c.L, c.W, c.H, { size: Number(P.size_base ?? 0.072), v: c.textY, k: c.k, maxw: 0.84 });
  const fall = Number(P.fall ?? 0.55), drop = Number(P.drop ?? 0.22) * c.H, sway = Number(P.sway ?? 0.6);
  const ex = exitP(c.L, c.t);
  const txt = drawH(c, l, (i, age) => {
    const p = clamp((age + 0.08) / fall);
    if (p <= 0) return null;
    const r = rng(c.L.seed, "sk", i), ph = r.uniform(0, Math.PI * 2), q = 1 - easeOut(p, 2.2);
    const bob = age > fall ? Math.sin(c.t * 2.2 + i) * l.px * 0.03 + beatPulse(c.beat, c.t, 0.1) * l.px * 0.04 : 0;
    // exit: wind gust, staggered left -> right
    const w = clamp(ex * 1.6 - (i / Math.max(1, l.pos.length)) * 0.6);
    return {
      a: clamp(p * 2.5) * (1 - w), dx: q * Math.sin(ph + p * 6) * l.px * sway + w * w * c.W * 0.25, dy: -q * drop - bob - w * c.H * 0.12,
      rot: q * (r.uniform(-70, 70)) + w * 120, s: 0.85 + 0.15 * easeOut(p),
    };
  }, { font: "serif", fill: "#fff4f8", stroke: "#7a1f45", sw: 0.06, exit: "none" });
  // petals around the line
  const [x0, y0, x1, y1] = l.box, petals: React.ReactNode[] = [];
  const n = Math.round(Number(P.petals ?? 16)), on = clamp((c.t - c.L.tOn) / 0.4) * (1 - easeOut(ex, 2));
  for (let k = 0; k < n; k++) {
    const r = rng(c.L.seed, "pt", k), period = r.uniform(2.5, 4.5), life = ((c.t + r.uniform(0, period)) % period) / period;
    const x = x0 - l.px + (x1 - x0 + 2 * l.px) * r.uniform(0, 1) + Math.sin(life * 6 + k) * l.px * 0.6 + life * l.px * 1.5;
    const y = y0 - l.px * 2.2 + (y1 - y0 + l.px * 3.2) * life;
    const sz = l.px * r.uniform(0.22, 0.38);
    petals.push(<div key={k} style={{ position: "absolute", left: x, top: y, width: sz, height: sz * 0.7, borderRadius: "80% 0 80% 0", background: r.pick(["#ffc4da", "#ffb0cc", "#ffe1ec"]),
      transform: `translate(-50%,-50%) rotate(${life * 540 + k * 40}deg) scaleX(${Math.cos(life * 9 + k)})`, opacity: on * Math.sin(Math.PI * life) * 0.9 }} />);
  }
  return { el: <>{petals}{txt.el}</>, boxes: boxesH(l) };
};
