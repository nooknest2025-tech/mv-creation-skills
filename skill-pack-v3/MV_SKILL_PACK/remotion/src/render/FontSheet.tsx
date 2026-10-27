// Font specimen sheet: every registry font grouped by category (npm run fonts:sheet).
import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_CATEGORIES, FONT_REG, fontCss } from "../lib/fonts";
import { useFonts } from "./fonts";

export const FontSheet: React.FC<{ text?: string }> = ({ text }) => {
  useFonts(FONT_REG.map((f) => f.id));
  const sample = text ?? "夜明けの歌 きみとミライ";
  const cols = 4;
  return <AbsoluteFill style={{ background: "#14121a", color: "#fff", padding: 36, fontFamily: "'Noto Sans JP', sans-serif" }}>
    <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 14 }}>書体見本（fonts.yaml・{FONT_REG.length}書体・すべて再配布できる無料フォント）</div>
    {FONT_CATEGORIES.map((c) => { const fs = FONT_REG.filter((f) => f.category === c); if (!fs.length) return null; return <div key={c} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 22, color: "#ff8fc0", borderBottom: "1px solid #444", marginBottom: 6 }}>{c}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>
        {fs.map((f) => <div key={f.id} style={{ background: "#211d2a", borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ fontFamily: fontCss(f.id), fontSize: 36, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden" }}>{f.jp ? sample : "Midnight Lyric 2026"}</div>
          <div style={{ fontSize: 15, opacity: 0.75 }}>{f.id}｜{f.family}｜{f.moods.slice(0, 3).join(" · ")}</div>
        </div>)}
      </div></div>; })}
  </AbsoluteFill>;
};
