// Static timeline report (npm run timing -- --png): waveform, beat grid, sections, lyric lines, cuts.
import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFonts } from "./fonts";
loadFonts();
export const Timeline: React.FC<{ data: any }> = ({ data: d }) => {
  if (!d) return <AbsoluteFill style={{ background: "#111" }} />;
  const W = 3000, L = 60, Rw = W - 80, X = (t: number) => L + (t / d.duration) * Rw, B = 60 / d.bpm;
  const beats: number[] = []; for (let t = d.phase; t < d.duration; t += B) beats.push(t);
  return <AbsoluteFill style={{ background: "#15131a", fontFamily: "'Noto Sans JP', sans-serif", color: "#fff" }}>
    <svg width={W} height={900}>
      <text x={L} y={40} fill="#fff" fontSize={30} fontWeight={700}>{d.title}　BPM {d.bpm}　{d.duration.toFixed(1)}s　カット {d.shots.length}　歌詞 {d.lines.length}行</text>
      {(d.peaks ?? []).map((p: number, i: number) => <rect key={i} x={X(i / d.peaksHz)} y={200 - p * 120} width={Math.max(1, Rw / (d.duration * d.peaksHz))} height={p * 240} fill="#6a5a8a" />)}
      {beats.map((t, k) => <rect key={`b${k}`} x={X(t)} y={70} width={1} height={720} fill={k % 4 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.22)"} />)}
      {d.sections.map((s: any, i: number) => <g key={`s${i}`}><rect x={X(s.start)} y={350} width={X(s.end) - X(s.start)} height={60} fill={["#3a2f55", "#2f4555"][i % 2]} /><text x={X(s.start) + 6} y={388} fill="#ffd63c" fontSize={22}>{s.label}</text></g>)}
      {d.lines.map((l: any, i: number) => <g key={`l${i}`}><rect x={X(l.start)} y={440 + (i % 3) * 70} width={Math.max(3, X(l.end) - X(l.start))} height={56} fill="#1f5fa0" /><text x={X(l.start) + 4} y={476 + (i % 3) * 70} fill="#fff" fontSize={20}>{l.text.slice(0, 14)}</text></g>)}
      {d.shots.map((s: any, i: number) => <rect key={`c${i}`} x={X(s.start)} y={660} width={2} height={60} fill="#ff46a0" />)}
      <text x={10} y={210} fill="#aaa" fontSize={18}>波形</text><text x={10} y={388} fill="#aaa" fontSize={18}>構成</text><text x={10} y={520} fill="#aaa" fontSize={18}>歌詞</text><text x={10} y={700} fill="#aaa" fontSize={18}>カット</text>
      {[...Array(Math.ceil(d.duration / 10))].map((_, k) => <text key={`t${k}`} x={X(k * 10)} y={780} fill="#888" fontSize={18}>{k * 10}s</text>)}
    </svg>
  </AbsoluteFill>;
};
