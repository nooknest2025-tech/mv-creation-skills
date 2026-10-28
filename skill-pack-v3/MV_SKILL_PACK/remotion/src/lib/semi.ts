// 半自動 (semi-auto) mode: a few Japanese questions, each with a pro-recommended default (Enter = おすすめ).
// Answers become a natural-language instruction list (same path as Codex / --say) + a plan summary to confirm.
import { MODE_IDS, SHOW_MODES, composeCombo, moodOf, proposeCombo, type Mood } from "./mograph";
import { PARTS_PRESETS } from "./rig";
import { STILL_TASTES, TASTE_JA, SEC_PER_IMAGE } from "./stills";
import { allowedModes, genreOptions, type Q2Key, type Material } from "./startFlow";
const PICTURE_MODES = ["story", "lipsync", "dance", "live", "tachie"];
const isStillTaste = (t?: string) => !!t && (STILL_TASTES as readonly string[]).includes(t);

export interface SemiOpt { key: string; label: string; say: string; why: string }
export interface SemiQ { id: string; title: string; multi?: boolean; options: SemiOpt[]; recommend: string[] }
export interface SemiCtx { genre?: string | null; bpm?: number; nImages?: number; faceRatio?: number; duration?: number; cuts?: Record<string, number>; videoCost?: Record<string, string>; hasChar?: boolean /* character material (PSD / parts / 立ち絵) found */; flow?: { q2: Q2Key; m: Material } /* start flow v2: only offer what Q1/Q2 allow */ }

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
  if (c.flow) return flowQuestions(c, baseQuestions(c));
  return baseQuestions(c);
}
const FLOW_TASTE: Record<Q2Key, string> = { textpv: "graphic", images: "own", animate: "own", videos: "own", tachie: "own", stills: "anime" };
/** start flow v2: drop / narrow the questions Q1・Q2 already answered, add ジャンル (folded in from the old menu). */
function flowQuestions(c: SemiCtx, qs: SemiQ[]): SemiQ[] {
  const { q2, m } = c.flow!, allow = new Set(allowedModes(q2, m)), out: SemiQ[] = [];
  for (const q of qs) {
    if (q.id === "show") { const options = q.options.filter((o) => o.key === "mix" || allow.has(o.key)); out.push({ ...q, title: q2 === "textpv" ? "見せ方（文字と図形。複数OK: 例 2,3）" : "見せ方（複数OK: 例 1,2 = 組み合わせ）", options });
      out.push({ id: "genre", title: "ジャンル（演出の型）", options: genreOptions(q2).map((g) => ({ key: g.key, label: g.label, say: "", why: g.why })), recommend: ["auto"] }); }
    else if (q.id === "taste") { if (q2 === "stills") out.push({ ...q, title: "作る画像のテイスト", options: q.options.filter((o) => ["anime", "photo", "illust"].includes(o.key)), recommend: ["anime"] }); }
    else if (q.id === "video") { if (q2 === "images" || q2 === "stills") out.push(q); }
    else if (q.id === "parts") { if (m.nChars) out.push({ ...q, recommend: [q2 === "tachie" ? "tachie" : "auto"] }); }
    else out.push(q);
  }
  return out;
}
function baseQuestions(c: SemiCtx = {}): SemiQ[] {
  const mood: Mood = moodOf(c.genre, c.bpm ?? 120);
  const n = c.nImages ?? 0;
  const rec = proposeCombo(mood, c.faceRatio ?? 0, n, c.flow ? c.flow.q2 === "tachie" : !!c.hasChar);
  const modes: SemiOpt[] = MODE_IDS.map((id) => ({ key: id, label: SHOW_MODES[id].ja, say: "", why: SHOW_MODES[id].desc }));
  modes.push({ key: "mix", label: "ミックス（おすすめの組み合わせ）", say: "", why: n > 0 ? `${rec.map((m) => SHOW_MODES[m].ja).join("＋")}` : `${rec.map((m) => SHOW_MODES[m].ja).join("＋")}（次の質問で画像テイストをアニメ・実写風・イラストにすると、画像を作って「物語＋リリックモーション」にします）` });
  const cut = (k: string) => (c.cuts?.[k] !== undefined ? `（約${c.cuts[k]}カット）` : "");
  const vc = (k: string) => (c.videoCost?.[k] ? `（目安 ${c.videoCost[k]}）` : "");
  return [
    { id: "show", title: "見せ方（複数OK: 例 3,5 = ダンス＋リリックモーション）", multi: true, options: modes, recommend: ["mix"] },
    { id: "taste", title: "画像テイスト", options: TASTES, recommend: [n > 0 ? "own" : "graphic"] }, // no images: free 文字PV by default; picture generation only when chosen
    { id: "density", title: "シーンの細かさ", options: [
      { key: "slow", label: `ゆったり${cut("slow")}`, say: "シーンはゆったり", why: "1枚を長く見せる。バラード向き" },
      { key: "normal", label: `標準${cut("normal")}`, say: "", why: "曲調に合わせてプロが決める" },
      { key: "fast", label: `テンポよく${cut("fast")}`, say: "シーンはテンポよく", why: "サビで8分刻み。ロック・ダンス向き" }], recommend: [mood === "ballad" || mood === "wa" ? "slow" : mood === "rock" ? "fast" : "normal"] },
    { id: "video", title: "動画化（AI動画生成）", options: [
      { key: "none", label: "静止画のみ（0円）", say: "動画化は静止画のみ", why: "カメラワーク＋目パチ口パク＋パーツアニメで動かす" },
      { key: "chorus", label: `サビなど一部だけ${vc("chorus")}`, say: "動画化はサビだけ", why: "見せ場だけ本物の動き。費用を抑えられる" },
      { key: "all", label: `全部${vc("all")}`, say: "動画化は全部", why: "全編を動画に。費用と生成時間がかかる" }], recommend: ["none"] },
    { id: "lyric", title: "リリックの雰囲気と書体", options: LYRIC_LOOKS, recommend: ["auto"] },
    { id: "parts", title: "キャラの動き（パーツアニメ。パーツ素材がある時だけ効きます）", options: [...Object.entries(PARTS_PRESETS).map(([k, p]) => ({ key: k, label: p.ja, say: k === "auto" ? "" : p.say, why: p.why })), TACHIE_PARTS_OPT], recommend: [c.hasChar ? "tachie" : "auto"] },
  ];
}
/** キャラの動き: build a 立ち絵モーションMV (adds the 立ち絵 show mode to whatever 見せ方 was chosen). */
export const TACHIE_PARTS_OPT: SemiOpt = { key: "tachie", label: "立ち絵モーションMVにする（全身を拍でカクカク踊らせる・口パク・縦書き吹き出し）", say: "", why: "input/parts（PSD・パーツPNG）か input/tachie（全身の立ち絵1枚）にキャラ素材が必要" };
export const TACHIE_MATERIAL_HELP = "立ち絵モーションMVには、キャラの素材が必要です。次のどれかを入れてください:\n  ① input/parts/<名前>/ にパーツ分けした PNG（同じキャンバスサイズ。名前に 頭・体・左腕・右腕・目・口 など）\n  ② input/parts/ か input/tachie/ に PSD（レイヤー＝パーツ）\n  ③ input/tachie/ に全身の立ち絵1枚（正面・腕を下ろした絵。自動でパーツに分けます。粗いので確認シートを見てください）\n  試すだけなら: npm run parts -- demo（簡易キャラを作ります）";
/** parse "3,5" / "3+5" / "" -> option keys (1-based numbers). */
export function parsePick(input: string, q: SemiQ): string[] {
  const s = input.normalize("NFKC").trim();
  if (!s) return q.recommend;
  const nums = s.split(/[,+＋、\s]+/).map(Number).filter((x) => x >= 1 && x <= q.options.length);
  const keys = [...new Set(nums.map((x) => q.options[x - 1].key))];
  return keys.length ? (q.multi ? keys : keys.slice(0, 1)) : q.recommend;
}
/** answers -> instruction text (applyInstruction) + plan lines to show before building. */
export function semiToPlan(ans: Record<string, string[]>, c: SemiCtx = {}): { say: string[]; plan: string[]; combo: string[]; warnings: string[]; args: string[] } {
  const qs = semiQuestions(c), say: string[] = [], plan: string[] = [], warnings: string[] = [];
  const args: string[] = [];
  const taste = (ans.taste ?? [])[0] ?? qs.find((q) => q.id === "taste")?.recommend[0] ?? (c.flow ? FLOW_TASTE[c.flow.q2] : "graphic"), n = c.nImages ?? 0, isMix = (ans.show ?? ["mix"]).includes("mix");
  const mood = moodOf(c.genre, c.bpm ?? 120);
  let combo = (ans.show ?? ["mix"]).includes("mix") ? proposeCombo(mood, c.faceRatio ?? 0, c.nImages ?? 0, c.flow ? c.flow.q2 === "tachie" : !!c.hasChar) : ans.show!.filter((k) => SHOW_MODES[k]);
  if (c.flow) { const allow = new Set(allowedModes(c.flow.q2, c.flow.m)); combo = combo.filter((m) => allow.has(m)); if (!combo.length) combo = c.flow.q2 === "tachie" ? ["tachie", "lyric_motion"] : ["typography", "mograph"]; }
  if ((ans.parts ?? qs.find((q) => q.id === "parts")?.recommend ?? [])[0] === "tachie" && !combo.includes("tachie")) combo = ["tachie", ...combo.filter((m) => !(isMix && PICTURE_MODES.includes(m)))];
  if (combo.includes("tachie") && c.hasChar === false) warnings.push(TACHIE_MATERIAL_HELP);
  if ((ans.taste?.[0] ?? (c.flow ? FLOW_TASTE[c.flow.q2] : null)) === "graphic" && !combo.includes("mograph")) combo = [...combo.filter((m) => SHOW_MODES[m].kind === "text" || m === "tachie"), "mograph"];
  // picture tastes need pictures: mix -> story + lyric motion (images are generated when input has none)
  if (isMix && isStillTaste(taste) && !combo.some((m) => PICTURE_MODES.includes(m))) combo = ["story", "lyric_motion", ...combo.filter((m) => m === "typography")];
  if (!isMix && isStillTaste(taste) && !combo.some((m) => PICTURE_MODES.includes(m))) warnings.push(`画像テイスト「${TASTE_JA[taste]}」を選びましたが、見せ方が文字・図形だけなので画像が使われません。→ 見せ方に「物語」を足す（例: 「物語＋リリックモーションで」）か、テイストを「図形中心」にしてください。`);
  if (taste === "own" && n === 0) warnings.push("テイスト「手持ち画像」ですが、input フォルダに画像・動画がありません。→ input に画像を入れるか、テイストを「アニメ」などにすると画像を作る計画を用意します。");
  if (taste === "graphic" && combo.some((m) => PICTURE_MODES.includes(m)) && n === 0) warnings.push("テイスト「図形中心」ですが、見せ方に画像を使うもの（物語など）が入っています。画像がないので図形と文字で作ります。");
  say.push(`${combo.map((m) => SHOW_MODES[m].ja).join("＋")}で`);
  const cb = composeCombo(combo);
  plan.push(`見せ方: ${cb.hybrid.ja}${(ans.show ?? ["mix"]).includes("mix") ? "（おまかせ提案）" : ""}`, ...cb.notes.map((n) => `   ${n}`));
  for (const q of qs.slice(1)) {
    const k = (ans[q.id] ?? q.recommend)[0], o = q.options.find((x) => x.key === k) ?? q.options[0];
    if (o.say && !(q.id === "taste" && k === "graphic")) say.push(o.say);
    if (q.id === "genre" && k !== "auto") args.push("--preset", k);
    plan.push(`${q.title.replace(/（.*$/, "")}: ${o.label}${ans[q.id] ? "" : "（おすすめ）"} — ${o.why}`);
  }
  if (isStillTaste(taste) && n === 0 && combo.some((m) => PICTURE_MODES.includes(m))) {
    const dens = ((ans.density ?? [])[0] ?? "normal") as keyof typeof SEC_PER_IMAGE, scenes = c.duration ? Math.round(c.duration / (SEC_PER_IMAGE[dens] ?? 7)) : null;
    plan.push(`画像: input に画像がないため、${TASTE_JA[taste]}の静止画${scenes ? `（キャラクターシート1枚＋背景数枚＋シーン約${scenes}枚）` : ""}を作る計画を自動で用意します。無料（Grok アプリ等で手動）なら0円。npm run gen -- stills で枚数と費用を確認できます`);
  }
  plan.push("選ばなかった項目は、曲調・セクション・素材からプロの組み合わせを自動で決めます（直線フェードや中央固定の字幕は使いません）。");
  return { say, plan, combo, warnings, args };
}
