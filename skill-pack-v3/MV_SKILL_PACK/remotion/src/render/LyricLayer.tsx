import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { STYLES } from "../styles/styles";
import { KwDecor, type Ctx } from "../styles/prims";
import type { RenderProps } from "../lib/types";
import { fontCss } from "../lib/fonts";
import { fontsOfLines, useFonts } from "./fonts";

export const LyricLayer: React.FC<{ p: RenderProps }> = ({ p }) => {
  useFonts(fontsOfLines(p.lines));
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const t = p.startAt + frame / fps;
  const vis = p.lines.filter((L) => t >= L.tOn && t < L.tEnd);
  return <AbsoluteFill style={{ overflow: "hidden" }}>
    {vis.map((L) => {
      const c: Ctx = { L, t, P: L.params, W, H, beat: p.beat, k: p.textSize ?? 1, textY: L.params.textY ?? p.textY };
      const fn = STYLES[L.style] ?? STYLES.reveal;
      const out = fn(c);
      const pal = L.params.palette ?? {};
      const vars: any = { ...(L.params.font ? { "--lyric-font": fontCss(L.params.font) } : {}), ...(pal.fill ? { "--lyric-fill": pal.fill } : {}), ...(pal.stroke ? { "--lyric-stroke": pal.stroke } : {}), ...(pal.accent ? { "--lyric-accent": pal.accent } : {}) };
      return <AbsoluteFill key={L.li} style={vars}>{out.el}<KwDecor c={c} boxes={out.boxes} /></AbsoluteFill>;
    })}
  </AbsoluteFill>;
};
