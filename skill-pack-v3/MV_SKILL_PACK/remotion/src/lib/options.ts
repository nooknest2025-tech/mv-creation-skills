// こだわり mode: 2-3 pro-recommended options per decision, each with a reason (the planner's fit ranking, not a fixed menu).
import { HYBRIDS, HYBRID_IDS, pickHybrid } from "./hybrids";
import { fitSet } from "./direction";
import { CATALOG } from "./catalog";

export interface Option { label: string; say: string; why: string }
export function structureOptions(genre: string | null, faceRatio: number, n = 3): Option[] {
  const seen = new Set<string>(), out: Option[] = [];
  // rank every template by the same fit score the auto planner uses (re-run with each one excluded)
  const ranked = HYBRID_IDS.map((id) => ({ id, s: (pickHybrid(genre, faceRatio, 8).id === id ? 1 : 0) + (genre && HYBRIDS[id].genres.includes(genre) ? 2 - HYBRIDS[id].genres.indexOf(genre) * 0.2 : 0) - (HYBRIDS[id].needsFaces && faceRatio < 0.15 ? 5 : 0) }))
    .sort((a, b) => b.s - a.s);
  for (const { id } of ranked) { if (seen.has(id) || out.length >= n) continue; seen.add(id); out.push({ label: HYBRIDS[id].ja, say: `${HYBRIDS[id].ja}で`, why: HYBRIDS[id].why }); }
  return out;
}
export function lyricOptions(genre: string | null, secType = "chorus"): Option[] {
  return fitSet({ genre, secType, energy: secType === "chorus" ? 0.9 : 0.4, cps: 4, bpm: 120, text: "" }, 3).map((f) => ({ label: CATALOG[f.style].short, say: `${secType === "chorus" ? "サビ" : "Aメロ"}は${CATALOG[f.style].short}で`, why: f.why.join("・") || "曲に合う" }));
}
/** こだわり: 立ち絵モーションMV as one of the structure comparisons (needs character material). */
export const TACHIE_OPTION: Option = { label: "立ち絵モーションMV（パーツアニメ）", say: "立ち絵で", why: "キャラの立ち絵をパーツに分け、拍でカクカク踊らせて口パク。縦書き吹き出しの歌詞・ゲスト演出。ボカロ・ゆっくり系に◎（キャラ素材が必要）" };
export const VARIETY_OPTIONS: Option[] = [
  { label: "統一感重視", say: "リリックは統一感重視", why: "1曲を1つの世界観で通す。バラード・弾き語り向き" },
  { label: "標準（おすすめ）", say: "", why: "セクションごとに変え、同じセクションの繰り返しは同じ動き（モチーフ）" },
  { label: "変化多め", say: "リリックは変化多め", why: "曲に合う範囲で毎回違う動き。アイドル・ボカロ・EDM向き" },
];
