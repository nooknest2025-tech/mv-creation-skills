// One source of truth: projects/<name>/out/editor/editor-state.json.
// The visual editor saves it, and Japanese instructions (npm run edit) patch the SAME file,
// so manual edits are kept and reopening the editor shows the AI changes.
import { CATALOG } from "./catalog";

export const COLOR_WORDS: [RegExp, string, string][] = [
  [/赤|レッド/, "#e8413c", "赤"], [/ピンク|桃色/, "#ff7eb6", "ピンク"], [/オレンジ|橙/, "#ff9a3c", "オレンジ"],
  [/黄色|黄|イエロー/, "#ffd84a", "黄色"], [/金色|ゴールド/, "#e6c15a", "金色"], [/緑|グリーン/, "#4cc97a", "緑"],
  [/水色|シアン/, "#58dce6", "水色"], [/青|ブルー/, "#4a8dff", "青"], [/紫|パープル/, "#a86bff", "紫"],
  [/白|ホワイト/, "#ffffff", "白"], [/黒|ブラック/, "#141414", "黒"],
];
const SEC: [RegExp, string, string][] = [
  [/ラスサビ|最後のサビ/, "chorus#last", "最後のサビ"], [/サビ/, "chorus", "サビ"], [/Aメロ/i, "verse", "Aメロ"],
  [/Bメロ|プレサビ/i, "pre_chorus", "Bメロ"], [/Cメロ|間奏|ブリッジ/, "bridge", "Cメロ"], [/イントロ/, "intro", "イントロ"],
  [/アウトロ|エンディング/, "outro", "アウトロ"],
];
const KAN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
const TYPE_JA: Record<string, string> = { chorus: "サビ", verse: "Aメロ", pre_chorus: "Bメロ", bridge: "Cメロ", intro: "イントロ", outro: "アウトロ", other: "その他" };
export const SUGGESTIONS = ["「サビの歌詞をもっと派手に」", "「2番の歌詞を赤に」", "「全体をゆっくりに」", "「Aメロの文字を大きく」", "「サビはグリッチで」"];
export const helpText = (t: string) => `「${t}」は読み取れませんでした。たとえば ${SUGGESTIONS.join("、")} のように、場所（全体・1番・2番・サビ・Aメロなど）と変え方（色・速さ・派手さ・大きさ・動き）を入れてください。`;

export type Section = { type: string; label?: string; start: number; end: number };
export type Target = { type?: string; ban?: number; last?: boolean; all: boolean; ja: string };

export function parseTarget(t0: string): Target {
  const t = t0.normalize("NFKC");
  const b = t.match(/([0-9一二三四五])\s*番(目)?/);
  const ban = b ? (KAN[b[1]] ?? Number(b[1])) : undefined;
  for (const [re, type, ja] of SEC) if (re.test(t)) {
    if (type === "chorus#last") return { type: "chorus", last: true, all: false, ja };
    return { type, ban, all: false, ja: ban ? `${ban}番の${ja}` : ja };
  }
  if (ban) return { ban, all: false, ja: `${ban}番` };
  return { all: true, ja: "全体" };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** friendly scene name: 「シーン5（サビ 0:42〜）」 — internal ids (S005) stay hidden. */
export function sceneName(s: any, i: number, sections?: Section[]) {
  const sec = sections?.find((x) => s.start >= x.start - 1e-3 && s.start < x.end);
  const raw = String(s.label ?? "");
  const label = sec ? (sec.label || TYPE_JA[sec.type] || "") : /^(S\d+|シーン\s*\d+)$/i.test(raw) ? "" : (TYPE_JA[raw] ?? raw);
  return `シーン${i + 1}（${label ? label + " " : ""}${fmt(s.start ?? 0)}〜）`;
}

/** 番 = verse(1) ... chorus(1) is 1番; after the n-th chorus comes (n+1)番. */
function banOf(sections: Section[], time: number) {
  let n = 1; const byChorus = sections.some((s) => s.type === "chorus");
  // songs without a サビ: each new Aメロ starts the next 番
  for (let i = 0; i < sections.length; i++) { const s = sections[i]; if (!byChorus && i > 0 && s.type === "verse") n++; if (time < s.end) return n; if (byChorus && s.type === "chorus") n++; }
  return n;
}
function matches(l: any, tg: Target, sections: Section[]) {
  if (tg.all) return true;
  if (!sections.length) return false;
  const sec = sections.find((s) => l.start >= s.start - 1e-3 && l.start < s.end) ?? sections[sections.length - 1];
  if (tg.last) { const last = [...sections].reverse().find((s) => s.type === "chorus"); return !!last && sec === last; }
  if (tg.type && sec.type !== tg.type) return false;
  if (tg.ban && banOf(sections, l.start) !== tg.ban) return false;
  return true;
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, +v.toFixed(2)));
const styleOf = (t: string, words: [RegExp, string][]) => { for (const [re, s] of words) if (re.test(t)) return s.split(":")[0]; return null; };

export type EditResult = { data: any; changes: string[]; unmatched: string[] };
/** Apply Japanese instructions to editor data (lyrics). Returns unmatched parts so callers can try mv.config edits. */
export function applyToEditorData(data0: any, text: string, styleWords: [RegExp, string][] = []): EditResult {
  const data = JSON.parse(JSON.stringify(data0));
  const sections: Section[] = data.sections ?? [];
  const changes: string[] = [], unmatched: string[] = [];
  for (const t of text.normalize("NFKC").split(/[。\n]/).map((s) => s.trim()).filter(Boolean)) {
    const tg = parseTarget(t);
    const targets = data.lyrics.filter((l: any) => matches(l, tg, sections));
    const color = COLOR_WORDS.find(([re]) => re.test(t) && /色|に|へ|で|カラー/.test(t) && !/配色|パレット|背景/.test(t));
    const slow = /ゆっくり|ゆったり|遅く|スロー/.test(t), fast = /速く|早く|素早く|テンポよく|キビキビ/.test(t) && !/\d/.test(t);
    const loud = /派手|激しく|盛り上げ|目立/.test(t), quiet = /静か|落ち着|控えめ|しっとり|地味/.test(t);
    const big = /大きく/.test(t), small = /小さく/.test(t);
    const st = styleOf(t, styleWords);
    if (!(color || slow || fast || loud || quiet || big || small || (st && CATALOG[st]))) { unmatched.push(t); continue; }
    if (!tg.all && !sections.length) { changes.push(`「${tg.ja}」の場所が分からないため全体ではなく何もしませんでした（曲の構成情報がありません。npm run mv をもう一度実行すると使えます）`); continue; }
    if (!targets.length) { changes.push(`「${tg.ja}」に当たる歌詞が見つかりませんでした（この曲の構成: ${[...new Set(sections.map((s) => s.label || TYPE_JA[s.type]))].join("・")}）`); continue; }
    const done: string[] = [];
    for (const l of targets) {
      if (color) l.fill = color[1];
      if (slow) { l.motionDuration = clamp((l.motionDuration ?? 0.8) * 1.5, 0.1, 3); l.transitionDuration = clamp((l.transitionDuration ?? 0.7) * 1.5, 0.1, 2); }
      if (fast) { l.motionDuration = clamp((l.motionDuration ?? 0.8) * 0.67, 0.1, 3); l.transitionDuration = clamp((l.transitionDuration ?? 0.7) * 0.67, 0.1, 2); }
      if (st && CATALOG[st]) l.motion = st;
      else if (loud) l.motion = "kinetic";
      else if (quiet) l.motion = "blur_in";
      if (loud) { l.scale = clamp((l.scale ?? 0.72) * 1.15, 0.3, 3); l.effect = "glow"; }
      if (quiet) l.effect = "none";
      if (big) l.scale = clamp((l.scale ?? 0.72) * 1.2, 0.3, 3);
      if (small) l.scale = clamp((l.scale ?? 0.72) * 0.83, 0.3, 3);
    }
    if (color) done.push(`色を${color[2]}に`);
    if (slow) done.push("動きをゆっくりに");
    if (fast) done.push("動きを速めに");
    if (st && CATALOG[st]) done.push(`動きを「${CATALOG[st].short}」に`);
    else if (loud) done.push("動きを「キネティック」＋光彩で派手に");
    else if (quiet) done.push("動きを「ピント」で静かに");
    if (big) done.push("文字を大きく"); if (small) done.push("文字を小さく");
    changes.push(`${tg.ja}の歌詞（${targets.length}行）: ${done.join("・")}`);
  }
  return { data, changes, unmatched };
}
