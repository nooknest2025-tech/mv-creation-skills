// Genre recipes: lyric styles per section + fonts + colours. Used by auto-select (resolveLines) when a genre is set or detected.
import type { Song } from "./types";

export interface Palette { fill: string; stroke: string; accent: string }
export interface GenreRecipe {
  ja: string; words: RegExp; preset?: string;
  pools: Record<string, string[]>; accent: Record<string, string>;
  fonts: { base: string; chorus: string; accent?: string }; palette: Palette; chorusPalette?: Palette;
  keywords?: Record<string, string>; why: string;
}
const P = (fill: string, stroke: string, accent: string): Palette => ({ fill, stroke, accent });

export const GENRES: Record<string, GenreRecipe> = {
  ballad: {
    ja: "バラード", words: /バラード|ballad|しっとり|切ない|泣ける/i, preset: "story",
    pools: { intro: ["blur_in", "reveal"], verse: ["reveal", "handwriting", "tategaki"], pre_chorus: ["outline_fill", "blur_in"], chorus: ["reveal", "karaoke", "particles"], bridge: ["tategaki", "particles"], outro: ["blur_in", "particles"], other: ["reveal"] },
    accent: { chorus: "blur_in", other: "reveal" },
    fonts: { base: "shippori_mincho", chorus: "noto_serif", accent: "klee" }, palette: P("#f6efe4", "#2a2320", "#f2c27a"),
    why: "ゆっくり・言葉を読ませる → 明朝＋ふわっと出る動き、暖かい白",
  },
  rock_edm: {
    ja: "ロック / EDM", words: /ロック|rock|edm|エレクトロ|ダブステップ|激しい|ハード/i, preset: "dance",
    pools: { intro: ["glitch", "neon"], verse: ["kinetic", "chromatic_trail", "typewriter"], pre_chorus: ["fly3d", "split_reveal", "mask_wipe"], chorus: ["word_stack", "glitch", "shatter", "extrude3d"], bridge: ["glitch", "letter_rain"], outro: ["shatter", "glitch"], other: ["kinetic"] },
    accent: { chorus: "shatter", pre_chorus: "stamp", other: "scale_pop" },
    fonts: { base: "zen_kaku", chorus: "dela", accent: "bebas" }, palette: P("#ffffff", "#0a0a0a", "#ff2a4a"), chorusPalette: P("#ffffff", "#0a0a0a", "#28e6ff"),
    why: "速い・音圧が高い → 極太ゴシック＋叩きつけ・グリッチ、白×赤/シアン",
  },
  citypop_jazz: {
    ja: "シティポップ / ジャズ", words: /シティポップ|city\s*pop|ジャズ|jazz|ac\s*o?r|80年代|夜の街|おしゃれ/i, preset: "live",
    pools: { intro: ["neon", "blur_in"], verse: ["typewriter", "mask_wipe", "karaoke"], pre_chorus: ["split_reveal", "chromatic_trail"], chorus: ["neon", "ticker", "mask_wipe"], bridge: ["circular", "neon"], outro: ["neon", "blur_in"], other: ["mask_wipe"] },
    accent: { other: "neon" },
    fonts: { base: "mplus1p", chorus: "kaisei_decol", accent: "pacifico" }, palette: P("#fff3e6", "#1b1440", "#ff7ab8"), chorusPalette: P("#fff7d6", "#1b1440", "#5ad7ff"),
    why: "ミドルテンポ・夜の街 → すっきりゴシック＋レトロ書体、ネオンのピンク/水色",
  },
  idol_pop: {
    ja: "アイドル / ポップ", words: /アイドル|idol|ポップ|pop|かわいい|キュート|ハッピー/i, preset: "dance",
    pools: { intro: ["scale_pop", "bounce"], verse: ["bounce", "karaoke", "jelly"], pre_chorus: ["flip3d", "scatter"], chorus: ["scale_pop", "burst", "collage", "jelly"], bridge: ["circular", "particles"], outro: ["burst", "reveal"], other: ["bounce"] },
    accent: { chorus: "burst", other: "scale_pop" },
    fonts: { base: "zen_maru", chorus: "mochiy", accent: "hachi_maru" }, palette: P("#ffffff", "#ff4f9a", "#ffd63c"), chorusPalette: P("#ffffff", "#7a5cff", "#ff69aa"),
    why: "明るく跳ねる → 丸ゴシック＋ポップ体、白文字にピンクのフチ",
  },
  wa: {
    ja: "和風", words: /和風|和ロック|演歌|民謡|和の|雅|侍|着物|祭/, preset: "story",
    pools: { intro: ["tategaki", "blur_in"], verse: ["tategaki", "handwriting", "reveal"], pre_chorus: ["stamp", "outline_fill"], chorus: ["stamp", "tategaki", "extrude3d"], bridge: ["tategaki", "particles"], outro: ["tategaki", "blur_in"], other: ["tategaki"] },
    accent: { other: "stamp" },
    fonts: { base: "yuji_syuku", chorus: "yuji_boku", accent: "zen_antique" }, palette: P("#f4ead6", "#1a1010", "#c8102e"),
    keywords: { 桜: "glow", 月: "glow", 花: "glow", 風: "wave" },
    why: "和の言葉が多い → 筆文字＋縦書き・ハンコ、生成り×朱",
  },
  hiphop: {
    ja: "ヒップホップ", words: /ヒップホップ|hip\s*hop|ラップ|rap|トラップ|ストリート/i, preset: "dance",
    pools: { intro: ["stamp", "kinetic"], verse: ["kinetic", "word_stack", "typewriter"], pre_chorus: ["stamp", "mask_wipe"], chorus: ["word_stack", "collage", "kinetic"], bridge: ["ticker", "kinetic"], outro: ["stamp", "kinetic"], other: ["kinetic"] },
    accent: { other: "stamp" },
    fonts: { base: "dela", chorus: "dela", accent: "bungee" }, palette: P("#ffe600", "#000000", "#ffffff"), chorusPalette: P("#ffffff", "#000000", "#ffe600"),
    why: "言葉数が多い（ラップ） → 極太の語単位キネティック、黄×黒",
  },
  acoustic: {
    ja: "弾き語り / First Take", words: /弾き語り|アコースティック|acoustic|first\s*take|ファーストテイク|一発撮り|アンプラグド/i, preset: "firsttake",
    pools: { intro: ["first_take"], verse: ["first_take", "liner_notes", "reveal"], pre_chorus: ["pencil_note", "karaoke"], chorus: ["letter_glow", "karaoke"], bridge: ["horizon"], outro: ["first_take"], other: ["first_take"] },
    accent: { other: "letter_glow" },
    fonts: { base: "noto_sans", chorus: "zen_kaku", accent: "klee" }, palette: P("#ffffff", "#1a1a1a", "#ffd9a0"),
    why: "声と言葉が主役 → 飾らない細めの書体、動きは最小限",
  },
  dark: {
    ja: "ダーク / ボカロ", words: /ダーク|dark|病み|退廃|ホラー|不穏/i, preset: "vocaloid",
    pools: { intro: ["broken_signal"], verse: ["vocalo_grid", "typewriter", "whisper_smoke"], pre_chorus: ["split_reveal", "censor_bar"], chorus: ["glitch", "broken_signal", "chromatic_trail"], bridge: ["whisper_smoke", "letter_rain"], outro: ["whisper_smoke"], other: ["vocalo_grid"] },
    accent: { other: "censor_bar" },
    fonts: { base: "zen_kaku", chorus: "dela", accent: "noto_serif" }, palette: P("#f2f2f2", "#0a0a12", "#ff2a5a"), chorusPalette: P("#ffffff", "#000000", "#39f0ff"),
    why: "不穏・情報量多め → 機械的な打ち込み＋ノイズ、白黒に差し色1色",
  },
  ambient: {
    ja: "アンビエント / チル", words: /アンビエント|ambient|チル|chill|ヒーリング|lo-?fi|ローファイ|穏やか|眠/i, preset: "story",
    pools: { intro: ["drift_float"], verse: ["horizon", "drift_float", "blur_in"], pre_chorus: ["aurora"], chorus: ["aurora", "letter_glow"], bridge: ["whisper_smoke"], outro: ["drift_float"], other: ["drift_float"] },
    accent: { other: "aurora" },
    fonts: { base: "noto_sans", chorus: "noto_serif" }, palette: P("#eef6ff", "#0b1220", "#9fd8ff"),
    why: "余白と空気感 → 字間ひろめ・ゆっくり、淡い寒色",
  },
};
export const GENRE_IDS = Object.keys(GENRES);

export function genreFromText(t: string): string | undefined {
  return GENRE_IDS.find((g) => GENRES[g].words.test(t));
}
const WA_CHARS = /[桜月花風雪雨空夢恋涙鬼神刀舞祭紅雅]/g;
/** heuristic genre detection from the analysed song (returns null when unsure -> generic pools). */
export function autoGenre(song: Song): { id: string | null; why: string } {
  const text = song.lines.map((l) => l.text).join("");
  const dur = song.lines.reduce((a, l) => a + Math.max(0.1, l.end - l.start), 0) || 1;
  const cps = [...text.replace(/\s/g, "")].length / dur; // sung chars per second
  const wa = (text.match(WA_CHARS) ?? []).length / Math.max(1, [...text].length);
  const en = song.energy?.length ? song.energy.reduce((a, b) => a + b, 0) / song.energy.length : 0.5;
  const bpm = song.bpm || 120;
  const dark = (text.match(/闇|孤独|嘘|壊|死|狂|痛|呪|毒|罰|消え/g) ?? []).length / Math.max(1, song.lines.length);
  if (wa > 0.06) return { id: "wa", why: `和の漢字が多い (${(wa * 100).toFixed(0)}%)` };
  if (cps > 7.5) return { id: "hiphop", why: `言葉数が多い (${cps.toFixed(1)}字/秒)` };
  if (dark > 0.35 && bpm >= 120) return { id: "dark", why: `暗い言葉が多い・BPM ${bpm.toFixed(0)}` };
  if (bpm < 80 && en < 0.4) return { id: "ambient", why: `BPM ${bpm.toFixed(0)}・音が薄い（チル）` };
  if (bpm < 88) return { id: "ballad", why: `BPM ${bpm.toFixed(0)}（ゆっくり）` };
  if (bpm >= 138 && en > 0.55) return { id: "rock_edm", why: `BPM ${bpm.toFixed(0)}・音圧高め` };
  if (bpm >= 125) return { id: "idol_pop", why: `BPM ${bpm.toFixed(0)}（明るく速い）` };
  if (bpm >= 95 && bpm < 125 && en < 0.6) return { id: "citypop_jazz", why: `BPM ${bpm.toFixed(0)}・ミドルテンポ` };
  return { id: null, why: "決め手なし → 汎用の自動選択" };
}
