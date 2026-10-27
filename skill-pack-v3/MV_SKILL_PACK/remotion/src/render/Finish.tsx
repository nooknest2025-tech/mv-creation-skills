// Finishing inside Remotion (no external grading app needed): bloom/glow, halation, chromatic fringe,
// letterbox, vignette and film grain. Glow/halation re-render the picture layer blurred and screen it on top.
import React from "react";
import { AbsoluteFill } from "remotion";
import type { FinishFx } from "../lib/types";

export { letterboxPx } from "../lib/finish";
import { letterboxPx } from "../lib/finish";

/** glow / halation wrapper: renders children twice (sharp + blurred screen). */
export const Glow: React.FC<{ f?: FinishFx; U: number; children: React.ReactNode }> = ({ f, U, children }) => {
  const g = f?.glow ?? 0, hl = f?.halation ?? 0;
  return <>
    <AbsoluteFill>{children}</AbsoluteFill>
    {g > 0 && <AbsoluteFill style={{ mixBlendMode: "screen", opacity: Math.min(0.9, g * 0.6), filter: `blur(${U * 0.018}px) brightness(1.1) contrast(1.6) saturate(1.2)` }}>{children}</AbsoluteFill>}
    {hl > 0 && <AbsoluteFill style={{ mixBlendMode: "screen", opacity: Math.min(0.7, hl * 0.5), filter: `blur(${U * 0.006}px) brightness(0.9) contrast(2.2) sepia(1) saturate(4) hue-rotate(-30deg)` }}>{children}</AbsoluteFill>}
  </>;
};

export const FinishTop: React.FC<{ f?: FinishFx; W: number; H: number; frame: number; vignette: number; grain: number }> = ({ f, W, H, frame, vignette, grain }) => {
  const lb = letterboxPx(f, W, H), v = f?.vignette ?? vignette, gr = f?.grain ?? grain, ch = f?.chroma ?? 0;
  return <>
    {ch > 0 && <AbsoluteFill style={{ boxShadow: `inset ${ch * 6}px 0 ${ch * 20}px rgba(255,0,80,0.25), inset ${-ch * 6}px 0 ${ch * 20}px rgba(0,200,255,0.25)` }} />}
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${v}))` }} />
    {gr > 0 && <AbsoluteFill style={{ opacity: gr, backgroundImage: `repeating-radial-gradient(circle at ${17 + (frame * 37) % 60}% ${23 + (frame * 53) % 50}%, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)`, mixBlendMode: "overlay" }} />}
    {lb > 0 && <><div style={{ position: "absolute", left: 0, right: 0, top: 0, height: lb, background: "#000" }} /><div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: lb, background: "#000" }} /></>}
  </>;
};
