// Font registry access (pure; generated from ../../fonts.yaml by `npm run fonts:sync`).
import REG from "./fonts.gen.json";

export interface FontInfo { id: string; family: string; file: string; category: string; jp: boolean; moods: string[]; present?: boolean }
export const FONT_REG: FontInfo[] = REG as FontInfo[];
export const FONT_CATEGORIES = ["明朝", "ゴシック", "丸ゴシック", "手書き", "筆・和風", "ポップ", "デザイン・レトロ", "欧文"];
const byId = (id: string) => FONT_REG.find((f) => f.id === id);

/** Japanese words -> font id (first available of the list). Order matters: specific first. */
export const FONT_WORDS: [RegExp, string[]][] = [
  [/筆文字|筆で|毛筆|書道|墨/, ["yuji_syuku", "yuji_boku", "zen_antique"]],
  [/荒々しい筆|力強い筆|殴り書き/, ["yuji_boku", "yuji_syuku"]],
  [/和風(の|な)?(字|文字|書体|フォント)|和の(字|書体)/, ["zen_antique", "yuji_syuku", "zen_old_mincho"]],
  [/明朝/, ["shippori_mincho", "noto_serif", "zen_old_mincho"]],
  [/丸っこい|丸文字|丸ゴシ|まるい(字|文字)|丸い(字|文字)|やわらかい(字|文字)|柔らかい(字|文字)/, ["zen_maru", "mplus_rounded", "kosugi_maru"]],
  [/手書き(の|風の)?(字|文字|書体|フォント)|手描き文字|ペン字|日記っぽい字/, ["klee", "zen_kurenaido", "yomogi"]],
  [/マーカー|サインペン/, ["yusei", "permanent_marker"]],
  [/かわいい(字|文字|書体)|可愛い(字|文字|書体)|アイドルっぽい字|ギャル文字/, ["hachi_maru", "mochiy", "zen_maru"]],
  [/ポップ(な|体)?(字|文字|書体|フォント)/, ["mochiy", "potta", "rocknroll"]],
  [/ドット|ピクセル|8bit|レトロゲーム/i, ["dotgothic"]],
  [/昭和|レトロ(な|の)?(字|文字|書体|フォント)/, ["train_one", "new_tegomin", "kaisei_decol"]],
  [/おしゃれ(な)?(字|文字|書体)|シティポップ(っぽい|風)?の?(字|文字|書体)/, ["kaisei_decol", "mplus1p"]],
  [/立体(的な)?(字|文字|書体)|袋文字/, ["rampart"]],
  [/極太|太い(字|文字)|太字|ゴシック/, ["dela", "zen_kaku", "noto_sans"]],
  [/細い(字|文字)|シンプルな(字|文字|書体)|普通の(字|文字)/, ["noto_sans"]],
  [/筆記体/, ["pacifico"]],
  [/英字|欧文|アルファベット/, ["bebas", "bungee", "playfair"]],
];

/** id | family | category | Japanese description -> available font id (falls back within category, then noto_sans). */
export function resolveFont(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const n = String(name).normalize("NFKC").trim();
  const low = n.toLowerCase();
  const hit = byId(low) ?? FONT_REG.find((f) => f.family.toLowerCase() === low);
  if (hit) return hit.id;
  if (FONT_CATEGORIES.includes(n)) return FONT_REG.find((f) => f.category === n)?.id;
  for (const [re, ids] of FONT_WORDS) if (re.test(n)) { const f = ids.find(byId); if (f) return f; }
  return undefined;
}
export function fontFromText(t: string): string | undefined {
  for (const [re, ids] of FONT_WORDS) if (re.test(t)) { const f = ids.find(byId); if (f) return f; }
  const m = FONT_REG.find((f) => t.includes(f.family) || new RegExp(`\\b${f.id}\\b`).test(t));
  return m?.id;
}
/** CSS font-family for a registry id (Japanese fallback so Latin-only fonts still show kana). */
export function fontCss(id: string | undefined): string | undefined {
  const f = id ? byId(id) : undefined;
  return f ? `'${f.family}', 'Noto Sans JP', sans-serif` : undefined;
}
export const fontFile = (id: string) => byId(id)?.file;
/** best font for a set of moods (registry moods tags). */
export function suggestFont(moods: string[], category?: string): string {
  let best = "noto_sans", score = -1;
  for (const f of FONT_REG) {
    if (category && f.category !== category) continue;
    const s = f.moods.filter((m) => moods.includes(m)).length * 2 + (f.jp ? 1 : 0);
    if (s > score) { best = f.id; score = s; }
  }
  return best;
}
