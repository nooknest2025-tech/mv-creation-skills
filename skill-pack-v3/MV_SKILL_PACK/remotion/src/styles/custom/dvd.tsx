// 「ライブDVD風」 caption looks (live concert disc / Blu-ray style). Shared by the editor preview, the MP4 export and `npm run mv`.
// Timing params (optional): enter = fade/slide-in seconds (0.8), exit = fade-out seconds (0.6; `fade_out` in npm run mv).
//   dvd_sub   : lyric subtitle, bottom centre, soft darkening at the bottom.            text = the lyric
//   dvd_card  : venue card, top left, red rule.                                         text = big line (e.g. city), sub = small line (e.g. "VENUE · DATE")
//   dvd_title : opening title lockup, centre.                                           pre = small line above, text = title, sub = line under the rule, beat = seconds between reveals
//   dvd_cam   : camcorder on-screen display (corner brackets, REC, running timecode).   text = top-left label, sub = start clock "HH:MM:SS", pre = bottom-left label
//   dvd_dim   : darkens the whole picture (e.g. under a title or credits).              dim = 0..1 (default 0.6)
//   dvd_roll  : end credits. One item per line: "#Title" big, "-" red rule, ">small note", "ROLE|Name" two columns, anything else = centred line, "" = gap.
// Everything song-specific (texts, clock, beat) comes from the line; nothing is built in.
import React from "react";
import type { StyleFn } from "../prims";
import { DVD_DEFAULTS, DVD_KINDS, dvdBeat, dvdTimecode, type DvdSpec } from "../../lib/dvd";
export { DVD_DEFAULTS, DVD_KINDS, DVD_FREE_TEXT, DVD_STYLES_INFO, isDvdMotion, dvdBeat, dvdTimecode, clockSeconds, type DvdSpec } from "../../lib/dvd";

const SANS = "'LINE Seed JP','Zen Kaku Gothic New','Noto Sans JP',sans-serif", MONO = "'M PLUS 1 Code',monospace";
const SOFT = "0 2px 6px rgba(0,0,0,.75),0 0 18px rgba(0,0,0,.45)";
const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
export function dvdDraw(s: DvdSpec, t: number, W: number, H: number): { el: React.ReactNode; boxes: [number, number, number, number][] } {
  const u = H / 720, inD = Math.max(0.05, num(s.enter, DVD_DEFAULTS.enter)), outD = Math.max(0.05, num(s.exit, DVD_DEFAULTS.exit));
  const a = Math.min(ease((t - s.start) / inD), ease((s.end - t) / outD)), k = num(s.scale, 1);
  const red = s.accent || DVD_DEFAULTS.accent, fill = s.fill || DVD_DEFAULTS.fill, font = s.font || SANS, text = String(s.text ?? "");
  if (s.motion === "dvd_card") {
    const slide = (1 - ease((t - s.start) / inD)) * -18 * u;
    return { boxes: [[W * 0.05, H * 0.065, W * 0.5, H * 0.2]], el: <div style={{ position: "absolute", left: W * 0.05, top: H * 0.065, opacity: a, transform: `translateX(${slide}px)`, display: "flex", alignItems: "stretch" }}>
      <div style={{ position: "absolute", left: -W * 0.05, top: -H * 0.065, width: W * 0.5, height: H * 0.3, background: "radial-gradient(ellipse at 10% 30%,rgba(0,0,0,.55),rgba(0,0,0,0) 70%)" }} />
      <div style={{ width: 4 * u, background: red, marginRight: 16 * u, position: "relative" }} />
      <div style={{ position: "relative", fontFamily: font, color: fill, textShadow: SOFT }}>
        <div style={{ fontSize: 40 * u * k, letterSpacing: ".22em", lineHeight: 1.1, whiteSpace: "nowrap" }}>{text}</div>
        {s.sub ? <div style={{ fontSize: 19 * u * k, letterSpacing: ".16em", color: "#e2e2e2", marginTop: 8 * u, whiteSpace: "nowrap" }}>{s.sub}</div> : null}
      </div></div> };
  }
  if (s.motion === "dvd_sub") {
    const rise = (1 - ease((t - s.start) / inD)) * 8 * u;
    return { boxes: [[W * 0.08, H * 0.85, W * 0.92, H * 0.925]], el: <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.26, opacity: a * 0.9, background: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.55))" }} />
      <div style={{ position: "absolute", left: W * 0.08, right: W * 0.08, bottom: H * 0.075, textAlign: "center", opacity: a, transform: `translateY(${rise}px)`, fontFamily: font, fontSize: 36 * u * k, letterSpacing: ".06em", color: fill, textShadow: s.glow ? `${SOFT},0 0 14px ${s.glow}` : SOFT, whiteSpace: "nowrap" }}>{text}</div></> };
  }
  if (s.motion === "dvd_title") {
    const b = Math.max(0, num(s.beat, DVD_DEFAULTS.beat)), r = (i: number) => ease((t - s.start - i * b) / 0.9), g = ease((s.end - t) / outD);
    return { boxes: [[W * 0.2, H * 0.32, W * 0.8, H * 0.68]], el: <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font, color: fill, textShadow: SOFT, background: `radial-gradient(ellipse at 50% 50%,rgba(0,0,0,${0.45 * g}),rgba(0,0,0,0) 60%)` }}>
      {s.pre ? <div style={{ fontSize: 26 * u, letterSpacing: ".6em", paddingLeft: ".6em", opacity: r(0) * g, transform: `translateY(${(1 - r(0)) * 10 * u}px)` }}>{s.pre}</div> : null}
      <div style={{ fontSize: 96 * u * k, letterSpacing: ".18em", paddingLeft: ".18em", lineHeight: 1.15, opacity: r(1) * g, filter: `blur(${(1 - r(1)) * 8 * u}px)` }}>{text}</div>
      <div style={{ width: W * 0.24 * r(2), height: 2 * u, background: red, margin: `${10 * u}px 0 ${14 * u}px`, opacity: g, boxShadow: `0 0 10px ${red}` }} />
      {s.sub ? <div style={{ fontSize: 24 * u, letterSpacing: ".5em", paddingLeft: ".5em", opacity: r(2.5) * g, transform: `translateY(${(1 - r(2.5)) * 10 * u}px)` }}>{s.sub}</div> : null}</div> };
  }
  if (s.motion === "dvd_cam") {
    const el = t - s.start, tc = dvdTimecode(s.sub ?? DVD_DEFAULTS.clock, el, num(s.fps, DVD_DEFAULTS.fps)), blink = Math.floor(el * 1.6) % 2 === 0;
    const fs = 23 * u, c: React.CSSProperties = { position: "absolute", fontFamily: MONO, fontSize: fs, color: "#f2f2f2", letterSpacing: ".08em", textShadow: "0 1px 2px rgba(0,0,0,.9)", opacity: Math.min(1, a * 1.5) };
    const line = "2px solid rgba(255,255,255,.75)";
    const br = (key: string, x: number, y: number, sx: number, sy: number) => <div key={key} style={{ position: "absolute", left: x, top: y, width: 30 * u, height: 30 * u, borderLeft: sx > 0 ? line : undefined, borderRight: sx < 0 ? line : undefined, borderTop: sy > 0 ? line : undefined, borderBottom: sy < 0 ? line : undefined, transform: `translate(${sx < 0 ? -30 * u : 0}px,${sy < 0 ? -30 * u : 0}px)`, opacity: a * 0.8 }} />;
    const foot = s.pre ?? DVD_DEFAULTS.camFoot;
    return { boxes: [], el: <>{br("tl", W * 0.05, H * 0.06, 1, 1)}{br("tr", W * 0.95, H * 0.06, -1, 1)}{br("bl", W * 0.05, H * 0.94, 1, -1)}{br("br", W * 0.95, H * 0.94, -1, -1)}
      {text ? <div style={{ ...c, left: W * 0.065, top: H * 0.08 }}>{text}</div> : null}
      <div style={{ ...c, right: W * 0.065, top: H * 0.08, display: "flex", alignItems: "center", gap: 8 * u }}><span style={{ display: "inline-block", width: fs * 0.7, height: fs * 0.7, borderRadius: "50%", background: "#ff2a2a", opacity: blink ? 1 : 0.15, boxShadow: "0 0 6px #ff2a2a" }} />REC</div>
      <div style={{ ...c, right: W * 0.065, bottom: H * 0.08 }}>{tc}</div>
      {foot ? <div style={{ ...c, left: W * 0.065, bottom: H * 0.08 }}>{foot}</div> : null}</> };
  }
  if (s.motion === "dvd_dim") return { boxes: [], el: <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.max(0, Math.min(1, num(s.dim, DVD_DEFAULTS.dim))) * a})` }} /> };
  if (s.motion === "dvd_roll") {
    const rise = (1 - ease((t - s.start) / inD)) * 10 * u;
    return { boxes: [[W * 0.07, H * 0.1, W * 0.93, H * 0.9]], el: <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 * u, opacity: a, transform: `translateY(${rise}px)`, fontFamily: font, color: fill, textShadow: SOFT }}>
      {text.split("\n").map((ln, i) => {
        if (ln === "") return <div key={i} style={{ height: 10 * u }} />;
        if (ln.startsWith("#")) return <div key={i} style={{ fontSize: 62 * u * k, letterSpacing: ".2em", paddingLeft: ".2em", textAlign: "center" }}>{ln.slice(1)}</div>;
        if (ln === "-") return <div key={i} style={{ width: W * 0.12, height: 2 * u, background: red, boxShadow: `0 0 8px ${red}` }} />;
        if (ln.startsWith(">")) return <div key={i} style={{ fontSize: 18 * u * k, letterSpacing: ".12em", color: "#cfcfcf", textAlign: "center" }}>{ln.slice(1)}</div>;
        if (ln.includes("|")) { const [role, name] = ln.split("|"); return <div key={i} style={{ display: "flex", width: W * 0.86, alignItems: "baseline", gap: 28 * u }}><div style={{ flex: 1, textAlign: "right", fontSize: 17 * u * k, letterSpacing: ".18em", color: "#cfcfcf", whiteSpace: "nowrap" }}>{role}</div><div style={{ flex: 1, textAlign: "left", fontSize: 27 * u * k, letterSpacing: ".06em", whiteSpace: "nowrap" }}>{name}</div></div>; }
        return <div key={i} style={{ fontSize: 26 * u * k, letterSpacing: ".22em", paddingLeft: ".22em", textAlign: "center" }}>{ln}</div>;
      })}</div> };
  }
  return { el: null, boxes: [] };
}

/** `npm run mv` / showcase: the same looks as lyric styles. Texts come from params (sub / pre / beat / dim / accent). */
const asStyle = (motion: string): StyleFn => (c) => {
  const P = c.P ?? {}, text = motion === "dvd_sub" || P.text === undefined ? c.L.chars.map((x) => x.ch).join("") || c.L.text : String(P.text);
  return dvdDraw({ motion, text, start: c.L.tOn, end: c.L.tEnd, sub: P.sub, pre: P.pre, enter: P.enter, exit: P.fade_out, scale: P.scale, accent: P.accent ?? P.rule_color, glow: P.glow, fill: P.fill, beat: dvdBeat(P.beat, c.beat?.bpm), dim: P.dim, fps: P.fps }, c.t, c.W, c.H);
};
export const DVD_STYLES: Record<string, StyleFn> = Object.fromEntries(DVD_KINDS.map((k) => [k, asStyle(k)]));
