import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { RenderProps } from "../lib/types";
import { loadFonts } from "./fonts";
import { LyricLayer } from "./LyricLayer";
import { Visuals } from "./Visuals";
import { CATALOG } from "../lib/catalog";

loadFonts();

export const MV: React.FC<RenderProps> = (p) => (
  <AbsoluteFill style={{ background: p.overlayOnly ? "transparent" : "#000" }}>
    {!p.overlayOnly && <Visuals p={p} />}
    <LyricLayer p={p} />
    {p.audio && !p.overlayOnly && <Audio src={/^(https?:|data:)/.test(p.audio) ? p.audio : staticFile(p.audio)} startFrom={Math.round(p.startAt * p.fps)} />}
  </AbsoluteFill>
);

/** Showcase: same MV renderer, plus a style name card (props.lines carry one style per segment). */
export const Showcase: React.FC<RenderProps & { cards?: { t: number; style: string }[] }> = (p) => {
  const f = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = p.startAt + f / fps;
  const card = [...(p.cards ?? [])].reverse().find((c) => t >= c.t);
  const U = Math.min(W, H);
  return <AbsoluteFill>
    <MV {...p} />
    {card && <div style={{ position: "absolute", left: U * 0.04, top: U * 0.04, padding: `${U * 0.012}px ${U * 0.022}px`, background: "rgba(0,0,0,0.6)", borderLeft: `${U * 0.008}px solid #ff46a0`, color: "#fff", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ fontSize: U * 0.03, fontWeight: 700, letterSpacing: 1 }}>{(p.cards ?? []).indexOf(card) + 1}/{(p.cards ?? []).length}　{card.style}</div>
      <div style={{ fontSize: U * 0.022, opacity: 0.9 }}>{CATALOG[card.style]?.short}｜{CATALOG[card.style]?.ja}</div>
    </div>}
  </AbsoluteFill>;
};
