// 半自動 (semi-auto) mode: a few Japanese questions, each with a pro-recommended default (Enter = おすすめ).
// Answers become a natural-language instruction list (same path as Codex / --say) + a plan summary to confirm.
import { MODE_IDS, SHOW_MODES, composeCombo, moodOf, proposeCombo, type Mood } from "./mograph";
import { PARTS_PRESETS } from "./rig";

export interface SemiOpt { key: string; label: string; say: string; why: string }
export interface SemiQ { id: string; title: string; multi?: boolean; options: SemiOpt[]; recommend: string[] }
export interface SemiCtx { genre?: string | null; bpm?: number; nImages?: number; faceRatio?: number; duration?: number; cuts?: Record<string, number>; videoCost?: Record<string, string> }

export const TASTES: SemiOpt[] = [
  { key: "anime", label: "アニメ", say: "画像はアニメ調で", why: "キャラクターの表情が伝わりやすい。目パチ・口パク・パーツアニメと相性◎" },
  { key: "photo", label: "実写風", say: "画像は実写風で", why: "映画っぽい質感。文字は細めで上品に" },
  { key: "illust", label: "イラスト", say: "画像はイラスト調で", why: "絵本・水彩など柔らかい世界観" },
  { key: "graphic", label: "図形中心", say: "モーショングラフィックスで。画像は図形中心", why: "画像なしでも成立。図形・線・文字だけで作る（生成コスト0円）" },
  { key: "own", label: "手持ち画像", say: "画像は手持ちの素材で", why: "input フォルダの画像・動画をそのまま使う" },
];
export const LYRIC_LOOKS: SemiOpt[] = [
  { key: "auto", label: "おまかせ（曲に合わせる）", say: "", why: "曲調とセクションからプロの組み合わせを自動で" },
  { key: "bold", label: "力強い（極太ゴシック・叩きつけ）", say: "サビはスマッシュで。極太の文字で", why: "ロック・速い曲向き。白黒＋赤の3色" },
  { key: "elegant", label: "上品（明朝・ゆっくり）", say: "Aメロは短冊で。明朝の文字で", why: "バラード・和風向き。縦書き明朝と長い間" },
  { key: "pop", label: "ポップ（弾む・色ブロック）", say: "サビはバネで。ポップな色で", why: "アイドル・明るい曲向き" },
  { key: "cool", label: "クール（細めゴシック・ラベル・照準UI）", say: "Aメロはラベルで", why: "エレクトロ・シティポップ向き" },
];

/** the semi-auto questions with recommended defaults for this song. */
export function semiQuestions(c: SemiCtx = {}): SemiQ[] {
  const mood: Mood = moodOf(c.genre, c.bpm ?? 120);
  const n = c.nImages ?? 0;
  const rec = proposeCombo(mood, c.faceRatio ?? 0, n);
  const modes: SemiOpt[] = MODE_IDS.map((id) => ({ key: id, label: SHOW_MODES[id].ja, say: "", why: SHOW_MODES[id].desc }));
  modes.push({ key: "mix", label: "ミックス（おすすめの組み合わせ）", say: "", why: `${rec.map((m) => SHOW_MODES[m].ja).join("＋")}` });
  const cut = (k: string) => (c.cuts?.[k] !== undefined ? `（約${c.cuts[k]}カット）` : "");
  const vc = (k: string) => (c.videoCost?.[k] ? `（目安 ${c.videoCost[k]}）` : "");
  return [
    { id: "show", title: "見せ方（複数OK: 例 3,5 = ダンス＋リリックモーション）", multi: true, options: modes, recommend: ["mix"] },
    { id: "taste", title: "画像テイスト", options: TASTES, recommend: [n > 0 ? "own" : mood === "rock" || mood === "electronic" ? "graphic" : "anime"] },
    { id: "density", title: "シーンの細かさ", options: [
      { key: "slow", label: `ゆったり${cut("slow")}`, say: "シーンはゆったり", why: "1枚を長く見せる。バラード向き" },
      { key: "normal", label: `標準${cut("normal")}`, say: "", why: "曲調に合わせてプロが決める" },
      { key: "fast", label: `テンポよく${cut("fast")}`, say: "シーンはテンポよく", why: "サビで8分刻み。ロック・ダンス向き" }], recommend: [mood === "ballad" || mood === "wa" ? "slow" : mood === "rock" ? "fast" : "normal"] },
    { id: "video", title: "動画化（AI動画生成）", options: [
      { key: "none", label: "静止画のみ（0円）", say: "動画化は静止画のみ", why: "カメラワーク＋目パチ口パク＋パーツアニメで動かす" },
      { key: "chorus", label: `サビなど一部だけ${vc("chorus")}`, say: "動画化はサビだけ", why: "見せ場だけ本物の動き。費用を抑えられる" },
      { key: "all", label: `全部${vc("all")}`, say: "動画化は全部", why: "全編を動画に。費用と生成時間がかかる" }], recommend: ["none"] },
    { id: "lyric", title: "リリックの雰囲気と書体", options: LYRIC_LOOKS, recommend: ["auto"] },
    { id: "parts", title: "キャラの動き（パーツアニメ。パーツ素材がある時だけ効きます）", options: Object.entries(PARTS_PRESETS).map(([k, p]) => ({ key: k, label: p.ja, say: k === "auto" ? "" : p.say, why: p.why })), recommend: ["auto"] },
  ];
}
/** parse "3,5" / "3+5" / "" -> option keys (1-based numbers). */
export function parsePick(input: string, q: SemiQ): string[] {
  const s = input.normalize("NFKC").trim();
  if (!s) return q.recommend;
  const nums = s.split(/[,+＋、\s]+/).map(Number).filter((x) => x >= 1 && x <= q.options.length);
  const keys = [...new Set(nums.map((x) => q.options[x - 1].key))];
  return keys.length ? (q.multi ? keys : keys.slice(0, 1)) : q.recommend;
}
/** answers -> instruction text (applyInstruction) + plan lines to show before building. */
export function semiToPlan(ans: Record<string, string[]>, c: SemiCtx = {}): { say: string[]; plan: string[]; combo: string[] } {
  const qs = semiQuestions(c), say: string[] = [], plan: string[] = [];
  const mood = moodOf(c.genre, c.bpm ?? 120);
  let combo = (ans.show ?? ["mix"]).includes("mix") ? proposeCombo(mood, c.faceRatio ?? 0, c.nImages ?? 0) : ans.show!.filter((k) => SHOW_MODES[k]);
  if ((ans.taste ?? [])[0] === "graphic" && !combo.includes("mograph")) combo = [...combo.filter((m) => SHOW_MODES[m].kind === "text"), "mograph"];
  say.push(`${combo.map((m) => SHOW_MODES[m].ja).join("＋")}で`);
  const cb = composeCombo(combo);
  plan.push(`見せ方: ${cb.hybrid.ja}${(ans.show ?? ["mix"]).includes("mix") ? "（おまかせ提案）" : ""}`, ...cb.notes.map((n) => `   ${n}`));
  for (const q of qs.slice(1)) {
    const k = (ans[q.id] ?? q.recommend)[0], o = q.options.find((x) => x.key === k) ?? q.options[0];
    if (o.say && !(q.id === "taste" && k === "graphic")) say.push(o.say);
    plan.push(`${q.title.replace(/（.*$/, "")}: ${o.label}${ans[q.id] ? "" : "（おすすめ）"} — ${o.why}`);
  }
  plan.push("選ばなかった項目は、曲調・セクション・素材からプロの組み合わせを自動で決めます（直線フェードや中央固定の字幕は使いません）。");
  return { say, plan, combo };
}
