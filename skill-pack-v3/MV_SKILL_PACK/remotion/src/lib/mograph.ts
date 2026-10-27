// Pro auto director + motion-graphics plan + combinable "show modes" (ダンス＋リリックモーション etc.).
// Pure: used by the pipeline, the wizard (自動/半自動/こだわり) and natural-language instructions.
import { HYBRIDS, hybridFromText, type Hybrid } from "./hybrids";
import { PALETTES, beatAccents, literalColor, type Accent, type AccentKind, type Palette } from "./pro";
import type { Song } from "./types";

// ---------- show modes (multi-select, combinable) ----------
export type ModeKind = "picture" | "text";
export interface ShowMode { id: string; ja: string; kind: ModeKind; words: RegExp; role?: string; desc: string }
export const SHOW_MODES: Record<string, ShowMode> = {
  story: { id: "story", ja: "物語", kind: "picture", role: "story", words: /物語|ストーリー|ドラマ/, desc: "情景や登場人物で物語を見せる" },
  lipsync: { id: "lipsync", ja: "リップシンク", kind: "picture", role: "lipsync", words: /リップ(シンク)?|口パク|歌う顔|歌唱/, desc: "歌う顔のアップ（口パク）" },
  dance: { id: "dance", ja: "ダンス", kind: "picture", role: "dance", words: /ダンス|踊/, desc: "全身の動きで拍を見せる" },
  live: { id: "live", ja: "ライブ", kind: "picture", role: "live", words: /ライブ|演奏/, desc: "ステージ・演奏の熱量" },
  lyric_motion: { id: "lyric_motion", ja: "リリックモーション", kind: "text", words: /リリック\s*モーション|リリックPV|文字PV|歌詞(を|の)?動/, desc: "画の上に、動く歌詞を重ねる" },
  typography: { id: "typography", ja: "タイポグラフィ", kind: "text", role: "typo", words: /タイポ(グラフィ)?|キネティック\s*タイポ|文字(が|を)?主役|全画面.?文字/, desc: "文字そのものが主役の全画面演出" },
  mograph: { id: "mograph", ja: "モーショングラフィックス", kind: "text", role: "mograph", words: /モーション\s*グラフィック(ス)?|モーグラ|モーショングラフィ|図形(の)?アニメ|図形中心/, desc: "図形・線・粒の動きで見せる" },
};
export const MODE_IDS = Object.keys(SHOW_MODES);

/** 「ダンス＋リリックモーションで」 -> ["dance","lyric_motion"] (order kept). null if fewer than one mode word, or a single picture word without a text mode. */
export function comboFromText(t: string): string[] | null {
  const s = t.normalize("NFKC");
  // strip text-mode words first so 「リリックモーション」 does not also read as モーション/リリック in other modes
  const hits: [number, string][] = [];
  let rest = s;
  for (const id of ["lyric_motion", "typography", "mograph", "story", "lipsync", "dance", "live"]) {
    const m = rest.match(SHOW_MODES[id].words); if (!m || m.index === undefined) continue;
    hits.push([s.indexOf(m[0]), id]); rest = rest.replace(m[0], "　".repeat(m[0].length));
  }
  if (!hits.length) return null;
  const ids = hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]);
  const hasText = ids.some((i) => SHOW_MODES[i].kind === "text");
  const joined = /[+＋×x&と・]|ミックス|組み合わせ|混ぜ/.test(s);
  if (!hasText && (hybridFromText(s) || !(joined && ids.length >= 2))) return null; // existing named templates keep priority // plain 「ダンス」 is handled by presets / hybrids
  return ids;
}

export interface Combo { id: string; modes: string[]; hybrid: Hybrid; textMode: Record<string, "overlay" | "typo" | "mograph">; notes: string[] }
const SEC = ["intro", "verse", "pre_chorus", "chorus", "bridge", "outro"] as const;
const SEC_JA: Record<string, string> = { intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", bridge: "Cメロ", outro: "アウトロ", other: "その他" };
/** pro section-by-section mix for any combination of show modes, with reasons. */
export function composeCombo(modes0: string[]): Combo {
  const modes = [...new Set(modes0.filter((m) => SHOW_MODES[m]))];
  if (!modes.length) modes.push("lyric_motion");
  const pics = modes.filter((m) => SHOW_MODES[m].kind === "picture"), texts = modes.filter((m) => SHOW_MODES[m].kind === "text");
  const sections: Hybrid["sections"] = {}; const textMode: Combo["textMode"] = {}; const notes: string[] = [];
  const verseP = pics[0], chorusP = pics.includes("dance") ? "dance" : pics[pics.length - 1];
  const rolePic = (sec: string) => (!pics.length ? null : sec === "chorus" ? chorusP : sec === "pre_chorus" && pics.length > 1 ? pics[1] : verseP);
  for (const sec of SEC) {
    const p = rolePic(sec), mix: Record<string, number> = {};
    const add = (role: string, w: number) => (mix[role] = (mix[role] ?? 0) + w);
    const peak = sec === "chorus", calm = sec === "intro" || sec === "outro" || sec === "bridge";
    let tm: "overlay" | "typo" | "mograph" = "overlay"; const why: string[] = [];
    if (p) add(SHOW_MODES[p].role!, 1);
    if (pics.length > 1 && sec === "chorus" && chorusP !== verseP) add(SHOW_MODES[verseP].role!, 0.3);
    if (texts.includes("typography")) {
      if (!p) { add("typo", 1); tm = "typo"; why.push("全編を文字が主役の画面で"); }
      else if (peak) { mix[SHOW_MODES[p].role!] = 0.4; add("typo", 0.6); tm = "typo"; why.push(`サビは全画面タイポグラフィで言葉を叩きつけ、${SHOW_MODES[p].ja}を挟む`); }
      else if (calm) { add("typo", 0.5); why.push("間奏は文字の画面で息継ぎ"); }
      else { mix[SHOW_MODES[p].role!] = 0.75; add("typo", 0.25); why.push(`${SHOW_MODES[p].ja}を主体に、要所だけ全画面の文字`); }
    }
    if (texts.includes("mograph")) {
      if (!p && !texts.includes("typography")) { add("mograph", 1); tm = "mograph"; why.push("図形と線の動きで全編を構成"); }
      else if (peak || calm) { add("mograph", p ? 0.5 : 0.4); if (tm === "overlay") tm = "mograph"; why.push(peak ? "サビは拍に合わせた図形のバースト" : "間奏は図形トランジションでつなぐ"); }
      else { add("mograph", 0.25); why.push("場面転換を図形ワイプで"); }
    }
    if (texts.includes("lyric_motion") || !texts.length) why.push(p ? `${SHOW_MODES[p].ja}の上にリリックモーションを重ねる` : "文字の動きが主役（背景は控えめ）");
    if (!Object.keys(mix).length) add("lyric", 1);
    sections[sec] = mix; textMode[sec] = tm;
    notes.push(`${SEC_JA[sec]}: ${Object.entries(mix).map(([r, w]) => `${ROLE_JA[r] ?? r}${Math.round((w / Object.values(mix).reduce((a, b) => a + b, 0)) * 100)}%`).join("・")} — ${why.join("／")}`);
  }
  const id = `combo_${modes.join("_")}`;
  const ja = modes.map((m) => SHOW_MODES[m].ja).join("＋");
  const hybrid: Hybrid = { ja, words: new RegExp(`^${id}$`), genres: [], other: sections.verse ?? { lyric: 1 }, sections, why: notes.join("｜"), needsFaces: modes.includes("lipsync") };
  HYBRIDS[id] = hybrid; // registered so applyHybrid / reports can use it like any template
  return { id, modes, hybrid, textMode, notes };
}
const ROLE_JA: Record<string, string> = { story: "物語", lipsync: "歌唱", dance: "ダンス", live: "ライブ", typo: "全画面タイポ", mograph: "モーショングラフィックス", lyric: "リリック" };

/** auto proposal when the user picked nothing: picture modes from media, text modes from mood. */
export function proposeCombo(mood: Mood, faceRatio: number, nMedia: number): string[] {
  const pic = nMedia === 0 ? [] : faceRatio > 0.3 ? ["story", "lipsync"] : ["story"];
  const text = mood === "rock" ? ["typography", "lyric_motion"] : mood === "electronic" ? ["mograph", "lyric_motion"] : mood === "pop" ? ["lyric_motion", "mograph"] : ["lyric_motion"];
  if (!pic.length) return mood === "ballad" ? ["typography"] : ["typography", "mograph"];
  return [...pic, ...text];
}

// ---------- mood / looks / director ----------
export type Mood = "rock" | "ballad" | "electronic" | "pop" | "city" | "wa";
export const MOOD_JA: Record<Mood, string> = { rock: "ロック", ballad: "バラード", electronic: "エレクトロ", pop: "ポップ", city: "シティポップ", wa: "和" };
export function moodOf(genre: string | null | undefined, bpm: number): Mood {
  switch (genre) {
    case "rock_edm": case "hiphop": return "rock";
    case "ballad": case "acoustic": case "ambient": return "ballad";
    case "dark": return "electronic";
    case "idol_pop": return "pop";
    case "citypop_jazz": return "city";
    case "wa": return "wa";
  }
  return bpm < 90 ? "ballad" : bpm >= 140 ? "rock" : bpm >= 124 ? "electronic" : "pop";
}
export type Look = "none" | "blocks" | "geo" | "burst" | "hud" | "tanzaku" | "mono";
export const LOOKS: Record<Look, string> = { none: "なし", blocks: "色ブロック", geo: "幾何学（ポーズtoポーズ）", burst: "同心円バースト＋拍の粒", hud: "UI・照準・小さな英字（パララックス）", tanzaku: "短冊・縦書き明朝（ゆっくり）", mono: "白黒＋差し色・大きな切れ文字" };
export type Transition = "cut" | "circle" | "rect" | "ripple" | "cloud" | "glyph_zoom" | "push_text" | "diag_sweep" | "slow_wipe";
export const TRANSITIONS_JA: Record<Transition, string> = { cut: "カット", circle: "円で塗りつぶし", rect: "矩形で塗りつぶし", ripple: "波紋", cloud: "雲のようなワイプ", glyph_zoom: "文字の中へズーム", push_text: "巨大文字が押し出す", diag_sweep: "斜め線スイープ", slow_wipe: "ゆっくり直線ワイプ" };
export type Texture = "grain" | "halftone" | "rgb" | "anaglyph";
interface Recipe { palette: string[]; look: [Look, Look, Look]; tr: Transition[]; acc: [number, number, number]; kinds: AccentKind[]; tex: Texture[]; lyric: [string[], string[], string[]]; cut: [number, number, number]; why: string }
// [calm(intro/verse/bridge/outro), build(pre-chorus), peak(chorus)]
export const RECIPES: Record<Mood, Recipe> = {
  rock: { palette: ["mono_red", "paper_red", "acid"], look: ["mono", "hud", "mono"], tr: ["rect", "glyph_zoom", "diag_sweep", "push_text"], acc: [1, 2, 3], kinds: ["invert", "bump", "rotate"], tex: ["grain", "rgb"], lyric: [["pro_slide", "pro_box", "pro_line"], ["pro_stretch", "pro_diag"], ["pro_smash", "pro_crop", "pro_stretch"]], cut: [2, 1, 0.5], why: "ロックのサビ=8分〜16分で刻むカット・叩きつける文字・白黒赤" },
  ballad: { palette: ["dusk", "ink_blue", "paper_red"], look: ["tanzaku", "tanzaku", "geo"], tr: ["slow_wipe", "cloud", "ripple"], acc: [0, 0, 1], kinds: ["bump"], tex: ["grain"], lyric: [["pro_tanzaku", "pro_line"], ["pro_line", "pro_slide"], ["pro_slide", "pro_pillar"]], cut: [8, 4, 4], why: "バラード=明朝の縦書き・長めの間・ゆっくりワイプ" },
  wa: { palette: ["paper_red", "sakura", "ink_blue"], look: ["tanzaku", "tanzaku", "mono"], tr: ["slow_wipe", "cloud", "rect"], acc: [0, 1, 1], kinds: ["bump"], tex: ["grain"], lyric: [["pro_tanzaku", "pro_pillar"], ["pro_pillar", "pro_line"], ["pro_crop", "pro_tanzaku"]], cut: [4, 4, 2], why: "和=紙白と朱・縦書き・短冊" },
  electronic: { palette: ["neon", "acid", "city"], look: ["hud", "geo", "burst"], tr: ["circle", "glyph_zoom", "push_text", "diag_sweep"], acc: [1, 2, 2], kinds: ["invert", "bump", "rotate"], tex: ["anaglyph", "halftone"], lyric: [["pro_label", "pro_slide"], ["pro_diag", "pro_stretch"], ["pro_stretch", "pro_diag", "pro_crop"]], cut: [4, 2, 1], why: "エレクトロ=ポーズtoポーズのネオン幾何学・照準UI" },
  pop: { palette: ["pop", "candy", "city"], look: ["blocks", "geo", "burst"], tr: ["circle", "rect", "ripple"], acc: [1, 1, 2], kinds: ["bump", "rotate"], tex: ["halftone"], lyric: [["pro_pop", "pro_label"], ["pro_pop", "pro_slide"], ["pro_pop", "pro_stretch"]], cut: [4, 2, 1], why: "ポップ=バネで弾む文字・色ブロック" },
  city: { palette: ["city", "dusk", "pop"], look: ["blocks", "geo", "geo"], tr: ["rect", "circle", "diag_sweep"], acc: [0, 1, 1], kinds: ["bump"], tex: ["grain", "halftone"], lyric: [["pro_label", "pro_line"], ["pro_slide", "pro_label"], ["pro_line", "pro_pop"]], cut: [4, 2, 2], why: "シティポップ=落ち着いた色ブロックと小さな英字" },
};
const tier = (type: string) => (type === "chorus" ? 2 : type === "pre_chorus" ? 1 : 0);

export interface MoSection { label: string; type: string; start: number; end: number; look: Look; palette: Palette; transition: Transition; textures: Texture[]; accentDensity: number; parallax: boolean; particlesOnBeat: boolean; lyricPrefer: string[]; cutBeats: number; mono?: boolean; why: string }
export interface MoGraphPlan { mood: Mood; sections: MoSection[]; accents: Accent[]; combo?: { id: string; modes: string[]; notes: string[]; textMode: Combo["textMode"] }; solo: boolean /* no media: graphics paint the background */ }
export interface DirectOpts {
  genre?: string | null; combo?: string[] | null; nMedia?: number; faceRatio?: number;
  density?: "slow" | "normal" | "fast"; // シーンの細かさ
  look?: Look | Record<string, Look>; palette?: string; transition?: Transition; seed?: number; accents?: boolean;
}
/** the pro auto director: mood x section -> look, palette, transition, accents, preferred lyric styles, cut length (with reasons). */
export function directPro(song: Song, o: DirectOpts = {}): MoGraphPlan {
  const mood = moodOf(o.genre, song.bpm), R = RECIPES[mood], seed = o.seed ?? 1;
  const secs = song.sections.length ? song.sections : [{ label: "全体", type: "other" as const, start: 0, end: song.duration }];
  const combo = o.combo?.length ? composeCombo(o.combo) : null;
  const dens = o.density === "slow" ? 2 : o.density === "fast" ? 0.5 : 1;
  const accents: Accent[] = [];
  const sections = secs.map((s, i): MoSection => {
    const k = tier(s.type);
    const lookO = typeof o.look === "string" ? o.look : o.look?.[s.type];
    let look: Look = lookO ?? R.look[k];
    const tm = combo?.textMode[s.type];
    if (!lookO && tm === "typo" && look === "tanzaku" && k === 2) look = "mono";
    const pal = PALETTES[o.palette ?? R.palette[k === 2 ? 0 : k === 1 ? Math.min(1, R.palette.length - 1) : 0]] ?? PALETTES.mono_red;
    // chorus keeps the main palette, bridge shifts to the alt palette (contrast), lyric-literal colour words override the accent
    const alt = s.type === "bridge" ? PALETTES[R.palette[1]] ?? pal : pal;
    const text = song.lines.filter((L) => L.start >= s.start && L.start < s.end).map((L) => L.text).join(" ");
    const lit = literalColor(text);
    const palette: Palette = { ...alt, ...(lit?.accent ? { accent: lit.accent } : {}) };
    const transition: Transition = i === 0 ? "cut" : o.transition ?? R.tr[(i + seed) % R.tr.length];
    const ad = o.accents === false ? 0 : R.acc[k];
    if (ad) accents.push(...beatAccents({ bpm: song.bpm, phase: song.phase, beatsPerBar: song.beatsPerBar || 4 }, s.start, s.end, ad, R.kinds, seed + i));
    const cutBeats = Math.max(0.5, R.cut[k] * dens * ((o.nMedia ?? 10) < 8 && R.cut[k] < 1 ? 2 : 1));
    const why = [`${s.label}: ${MOOD_JA[mood]}→${LOOKS[look]}・${palette.ja}・転換=${TRANSITIONS_JA[transition]}`, k === 2 ? R.why : "", lit?.why ?? "", ad ? `拍アクセント(${ad === 3 ? "8分" : ad === 2 ? "毎拍" : "小節頭"})` : "アクセント控えめ", tm && tm !== "overlay" ? `この区間は${tm === "typo" ? "全画面タイポ" : "モーショングラフィックス"}あり` : ""].filter(Boolean).join("｜");
    return { label: s.label, type: s.type, start: s.start, end: s.end, look, palette, transition, textures: R.tex, accentDensity: ad, parallax: look === "hud" || look === "mono" || k === 2, particlesOnBeat: look === "burst" || (k === 2 && mood !== "ballad"), lyricPrefer: R.lyric[k], cutBeats, mono: lit?.mono, why };
  });
  return { mood, sections, accents, combo: combo ? { id: combo.id, modes: combo.modes, notes: combo.notes, textMode: combo.textMode } : undefined, solo: (o.nMedia ?? 0) === 0 };
}
/** approx number of cuts for a density choice (semi-auto question 「シーンの細かさ」). */
export function estimateCuts(song: Song, genre: string | null | undefined, density: "slow" | "normal" | "fast", nMedia = 10): number {
  const p = directPro(song, { genre, density, nMedia, accents: false });
  const B = 60 / Math.max(40, song.bpm || 120);
  return Math.round(p.sections.reduce((a, s) => a + (s.end - s.start) / (B * s.cutBeats), 0));
}
