// Still image renderer with native puppet animation: cover-fit with smart-crop focus, then
// 目パチ (blink patches or drawn lids), 口パク (jaw stretch of the mouth region + dark interior),
// 呼吸 (breathing), 髪揺れ (masked displacement around the head), beat sway / bounce.
import React from "react";
import { Img, staticFile } from "remotion";
import { blinkState, bodyMotion, breath, hairPhase, mouthOpen } from "../lib/puppet";
import type { FaceRig, PuppetCfg, RenderProps, Shot } from "../lib/types";

const src = (s: string) => (/^(https?:|data:|blob:)/.test(s) ? s : staticFile(s));
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export const PuppetImage: React.FC<{ shot: Shot; W: number; H: number; t: number; p: RenderProps; style: React.CSSProperties; blur?: number }> = ({ shot, W, H, t, p, style, blur = 0 }) => {
  const size = shot.size ?? shot.face?.size;
  const pc: PuppetCfg = shot.puppet ?? { blink: 0, mouth: 0, breath: 0, hair: 0, sway: 0, bounce: 0 };
  if (!size) return <Img src={src(shot.src)} style={{ ...style, objectFit: "cover", width: "100%", height: "100%" }} />;
  const [iw, ih] = size;
  const k = Math.max(W / iw, H / ih), dw = iw * k, dh = ih * k;
  const face = shot.face && shot.face.eyes?.length ? shot.face : undefined;
  const fc = face ? faceCentre(face) : shot.focus ?? [0.5, 0.5];
  const left = Math.min(0, Math.max(W - dw, W / 2 - fc[0] * dw)), top = Math.min(0, Math.max(H - dh, H / 2 - fc[1] * dh));
  const bpm = p.beat.bpm;
  const br = pc.breath * breath(t, bpm), bm = bodyMotion(p.beat, t, pc.sway, pc.bounce);
  const id = `hair_${shot.id}`;
  const hairAmt = face ? pc.hair * dw * 0.006 * hairPhase(t, bpm) : 0;
  const open = face?.mouth && pc.mouth > 0 ? Math.min(1, pc.mouth * mouthOpen(p.lines, t, p.energy, p.energyHz)) : 0;
  const bl = face && pc.blink > 0 ? blinkState(shot.src, t, pc.blink) : 0;
  const box: React.CSSProperties = { position: "absolute", left, top, width: dw, height: dh, transformOrigin: "50% 100%",
    transform: `translateY(${bm.dy * H}px) rotate(${bm.rot}deg) scale(${1 + 0.004 * br}, ${1 + 0.008 * br})` };
  return <div style={{ ...style, position: "absolute", inset: 0, overflow: "hidden" }}>
    <div style={box}>
      <Img src={src(shot.src)} style={{ width: "100%", height: "100%", display: "block", filter: blur ? `blur(${blur}px)` : undefined }} />
      {face && Math.abs(hairAmt) > 0.05 && <>
        <svg width="0" height="0" style={{ position: "absolute" }}><defs><filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={`${(3 / dw).toFixed(5)} ${(9 / dh).toFixed(5)}`} numOctaves={2} seed={7} />
          <feDisplacementMap in="SourceGraphic" scale={hairAmt * 2} xChannelSelector="R" yChannelSelector="G" />
        </filter></defs></svg>
        <Img src={src(shot.src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: `url(#${id})`,
          WebkitMaskImage: hairMask(face, fc), maskImage: hairMask(face, fc) }} />
      </>}
      {face?.mouth && open > 0.02 && <Mouth img={shot.src} m={face.mouth} open={open} />}
      {face && bl > 0 && face.eyes.map((e, i) => {
        const pt = face.patches?.[i];
        if (pt) return <Img key={i} src={src(`project/faces/${bl >= 1 ? pt.closed : pt.half}`)} style={{ position: "absolute", left: pct(pt.x), top: pct(pt.y), width: pct(pt.w), height: pct(pt.h) }} />;
        return <Lid key={i} e={e} amount={bl} skin={face.skin ?? "#e8d0c8"} lash={face.lash ?? "#222"} />;
      })}
    </div>
  </div>;
};

function faceCentre(f: FaceRig): [number, number] {
  const pts = [...f.eyes.map((e) => [e[0], e[1]]), ...(f.mouth ? [[f.mouth[0], f.mouth[1]]] : [])];
  return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
}
/** hair zone: ring around the face (face itself and far background excluded). */
function hairMask(f: FaceRig, c: [number, number]) {
  const ew = Math.abs((f.eyes[1]?.[0] ?? f.eyes[0][0] + 0.1) - f.eyes[0][0]) || 0.1;
  const r0 = ew * 0.9, r1 = ew * 1.4, r2 = ew * 3.2;
  return `radial-gradient(ellipse ${pct(r2)} ${pct(r2 * 1.5)} at ${pct(c[0])} ${pct(c[1])}, transparent ${pct(r0)}, #000 ${pct(r1)}, #000 ${pct(r2 * 0.6)}, transparent ${pct(r2)})`;
}

/** jaw drop: the region under the upper lip is stretched down, with a dark mouth interior. */
const Mouth: React.FC<{ img: string; m: [number, number, number, number]; open: number }> = ({ img, m, open }) => {
  const [x, y, rx, ry] = m;
  const bw = rx * 2.6, bh = ry * 6; // region box (fractions of the image)
  const bx = x - bw / 2, by = y - ry * 0.9;
  const mask = `radial-gradient(ellipse 50% 50% at 50% 42%, #000 55%, transparent 100%)`;
  return <div style={{ position: "absolute", left: pct(bx), top: pct(by), width: pct(bw), height: pct(bh), overflow: "hidden", WebkitMaskImage: mask, maskImage: mask }}>
    <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 10%", transform: `scaleY(${1 + 0.55 * open})` }}>
      <Img src={src(img)} style={{ position: "absolute", width: `${100 / bw}%`, height: `${100 / bh}%`, left: `${(-bx / bw) * 100}%`, top: `${(-by / bh) * 100}%` }} />
    </div>
  </div>;
};

const Lid: React.FC<{ e: [number, number, number, number]; amount: number; skin: string; lash: string }> = ({ e, amount, skin, lash }) => {
  const [x, y, rx, ry] = e;
  const h = ry * 2 * (amount >= 1 ? 1 : 0.55);
  return <div style={{ position: "absolute", left: pct(x - rx * 1.05), top: pct(y - ry * 1.05), width: pct(rx * 2.1), height: pct(h * 1.05) }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: "50% 50% 45% 45%", background: skin, filter: "blur(1px)" }} />
    <div style={{ position: "absolute", left: "4%", right: "4%", bottom: 0, height: "14%", borderRadius: "0 0 50% 50%", borderBottom: `3px solid ${lash}` }} />
  </div>;
};
