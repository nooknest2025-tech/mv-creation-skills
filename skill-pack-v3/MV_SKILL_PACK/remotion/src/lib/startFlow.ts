// `npm run start` flow v2 (and the same flow the AI follows for 「開始」「MV作って」):
//   Q1 何がありますか？ (material, auto-detected and preselected) -> Q2 映像はどうする？ (only options the material allows)
//   -> Q3 ここから先は？ おまかせ / 半自動 / こだわり -> confirmation (material, method + why, cost) -> Enter.
// Pure: the wizard script does the I/O; tests drive these functions directly.
import { HYBRIDS, HYBRID_IDS } from "./hybrids";
import { PRESETS, PRESET_IDS } from "./presets";

export type Q1Key = "song" | "images" | "videos" | "chars";
export type Q2Key = "textpv" | "images" | "videos" | "stills" | "tachie" | "animate";
export type Q3Key = "auto" | "semi" | "kodawari";
export interface Material { audio: boolean; lyrics: boolean; nImages: number; nVideos: number; nChars: number }
export interface Opt<K extends string = string> { key: K; label: string; why: string }
export interface Choice { q1: Q1Key; q2: Q2Key; q3: Q3Key }

const LEVEL: Record<Q1Key, number> = { song: 1, images: 2, videos: 3, chars: 4 };
export const Q1_OPTS: Opt<Q1Key>[] = [
  { key: "song", label: "曲と歌詞だけ（SRT/LRC/JSON等の歌詞データもOK）", why: "文字と図形のリリックPVなら0円ですぐ作れる" },
  { key: "images", label: "＋画像", why: "手持ちの画像に動き（ズーム・奥行き・光・拍の揺れ）をつける" },
  { key: "videos", label: "＋動画素材", why: "良い場面を自動で探してビートで切る" },
  { key: "chars", label: "＋キャラ素材（立ち絵・パーツ）", why: "立ち絵をパーツに分けて拍で踊らせる（立ち絵モーションMV）" },
];
/** what the input folder has -> the preselected Q1 answer. */
export function detectQ1(m: Material): Q1Key { return m.nChars ? "chars" : m.nVideos ? "videos" : m.nImages ? "images" : "song"; }
export function materialLine(m: Material): string {
  return `曲 ${m.audio ? "あり" : "なし"} / 歌詞 ${m.lyrics ? "あり" : "なし（自動で書き起こし）"} / 画像 ${m.nImages} 枚 / 動画 ${m.nVideos} 本 / キャラ素材 ${m.nChars} 人`;
}
/** picking more than the folder has: explain where to put it and continue with what was found. */
export function checkQ1(pick: Q1Key, m: Material): { q1: Q1Key; warn?: string } {
  const need: Record<Q1Key, [boolean, string]> = { song: [true, ""], images: [m.nImages > 0, "画像（jpg/png/webp）を input/ に"], videos: [m.nVideos > 0, "動画（mp4/mov）を input/ に"], chars: [m.nChars > 0, "キャラ素材を input/parts/（パーツPNG・PSD）か input/tachie/（PSD・全身の立ち絵1枚）に"] };
  if (need[pick][0]) return { q1: pick };
  const q1 = detectQ1(m);
  return { q1, warn: `「${Q1_OPTS.find((o) => o.key === pick)!.label}」の素材が見つかりません。${need[pick][1]}入れてから、もう一度 start してください。今回は見つかった素材（${Q1_OPTS.find((o) => o.key === q1)!.label}）で進めます。` };
}

/** Q2 options for the material; first = recommended. stillsCost: e.g. "無料（手作業）0円／有料なら最安 $0.12". */
export function q2Options(q1: Q1Key, m: Material, stillsCost?: string, animateCost?: string): Opt<Q2Key>[] {
  const o: Record<Q2Key, Opt<Q2Key>> = {
    textpv: { key: "textpv", label: "文字と図形だけ（文字PV・0円）", why: "動く歌詞と図形・線・粒で作る。画像がなくても成立し、費用0円" },
    images: { key: "images", label: "画像だけで作る（0円）", why: `手持ちの画像 ${m.nImages} 枚に動きをつけ、動く歌詞を重ねる` },
    videos: { key: "videos", label: `動画も入れる（0円）`, why: `動画 ${m.nVideos} 本${m.nImages ? `＋画像 ${m.nImages} 枚` : ""}を使い、良い場面をビートで切る` },
    stills: { key: "stills", label: "画像を作る（無料：Grokアプリ等で手作業）", why: `曲に合う画像の作り方リスト（キャラ→背景→シーン${stillsCost ? `・${stillsCost}` : ""}）を用意し、Grok アプリ等で無料で作って取り込む。画像ができるまでは文字PVで仮に作ります` },
    animate: { key: "animate", label: "画像を動画にする（全部 or 選んだシーンだけ／基本は無料の手作業）", why: `画像から短い動画を作り、そのシーンだけ動画に差し替える（残りは静止画のまま）。Grok アプリ等で無料の手作業→取り込み${animateCost === undefined ? "" : ""}` },
    tachie: { key: "tachie", label: "立ち絵で作る（0円）", why: `キャラ ${m.nChars} 人を拍で踊らせ、口パク・縦書き吹き出しの歌詞` },
  };
  const keys: Q2Key[] = q1 === "song" ? ["textpv", "stills"]
    : q1 === "images" ? ["images", "animate", "textpv", "stills"]
    : q1 === "videos" ? ["videos", ...(m.nImages ? ["images" as const] : []), "textpv"]
    : ["tachie", ...(m.nVideos ? ["videos" as const] : []), ...(m.nImages ? ["images" as const, "animate" as const] : []), "textpv"];
  return keys.map((k) => o[k]);
}
export const Q3_OPTS: Opt<Q3Key>[] = [
  { key: "auto", label: "おまかせ", why: "ここまでの答えで、構成・歌詞の動き・書体・色をプロの組み合わせで自動で決める（追加の質問なし）" },
  { key: "semi", label: "半自動", why: "見せ方・ジャンル・シーンの細かさ・歌詞の雰囲気などを、おすすめつきで数問だけ" },
  { key: "kodawari", label: "こだわり", why: "決めることごとに、おすすめ2〜3案を理由つきで比べて選ぶ" },
];
export const Q3_DEFAULT: Q3Key = "auto";

/** does this visual choice put pictures on screen (now)? stills = later, after the images are made. */
export const hasPictures = (q2: Q2Key) => q2 === "images" || q2 === "videos" || q2 === "tachie" || q2 === "animate";
/** show modes (SHOW_MODES ids) allowed for the Q2 choice. */
export function allowedModes(q2: Q2Key, m: Material): string[] {
  const text = ["lyric_motion", "typography", "mograph"];
  if (q2 === "textpv") return text;
  if (q2 === "tachie") return ["tachie", ...(m.nImages || m.nVideos ? ["story", "live", "dance"] : []), ...text];
  return ["story", "lipsync", "dance", "live", ...text, ...(m.nChars ? ["tachie"] : [])];
}
/** genres (presets) that make sense: text-only PVs only use the typography-led looks. */
export function allowedPresets(q2: Q2Key): string[] { return q2 === "textpv" ? ["vocaloid", "firsttake"] : q2 === "tachie" ? ["vocaloid", "dance", "live"] : PRESET_IDS; }
export const genreOptions = (q2: Q2Key) => [{ key: "auto", label: "おまかせ（曲から自動）", why: "BPM・音の強さ・歌詞の密度から選ぶ" }, ...allowedPresets(q2).map((id) => ({ key: id, label: PRESETS[id].ja, why: PRESETS[id].desc }))];

const PICTURE_ROLES = new Set(["lipsync", "story", "dance", "live", "flashback", "performance", "cutaway", "narrative", "oneshot", "insert", "concept", "tachie"]);
/** hybrid layouts that can actually be built without pictures are none; this filters the こだわり structure list. */
export const hybridNeedsPictures = (id: string) => { const h = HYBRIDS[id]; return [h.other, ...Object.values(h.sections)].some((mx) => Object.keys(mx ?? {}).some((r) => PICTURE_ROLES.has(r))); };
export const TEXT_STRUCTURES = [
  { label: "タイポグラフィ＋モーショングラフィックス", say: "タイポグラフィ＋モーショングラフィックスで", why: "文字が主役の全画面と図形の動き。画像なしで一番見栄えがする（おすすめ）" },
  { label: "リリックモーション＋モーショングラフィックス", say: "リリックモーション＋モーショングラフィックスで", why: "図形の背景の上に読みやすい動く歌詞。落ち着いた曲向き" },
  { label: "タイポグラフィだけ", say: "タイポグラフィで", why: "言葉そのものを大きく見せる。バラード・語りの多い曲向き" },
];
export { HYBRID_IDS };

/** Q2 -> instruction text (same path as Codex / --say) and extra CLI flags for npm run mv. */
export function q2Plan(q2: Q2Key, taste = "anime"): { say: string[]; args: string[]; why: string } {
  switch (q2) {
    case "textpv": return { say: ["タイポグラフィ＋モーショングラフィックスで"], args: ["--text-only"], why: "画像を使わず、動く歌詞と図形で作る文字PV" };
    case "images": return { say: ["画像は手持ちの素材で"], args: [], why: "手持ちの画像に動きをつけて、動く歌詞を重ねる" };
    case "videos": return { say: ["画像は手持ちの素材で"], args: [], why: "動画の良い場面をビートで切り、動く歌詞を重ねる" };
    case "stills": return { say: [`画像は${({ anime: "アニメ", photo: "実写", illust: "イラスト" } as Record<string, string>)[taste] ?? "アニメ"}調で`, "物語＋リリックモーションで"], args: [], why: "画像の作り方リストを用意。画像ができるまでは文字PVで仮に作り、画像を入れて作り直すと物語＋動く歌詞になる" };
    case "animate": return { say: ["画像は手持ちの素材で"], args: [], why: "手持ちの画像で作り、選んだシーンを動画AIの短い動画に差し替える（残りは静止画）。動画ができるまでは静止画のまま完成させます" };
    case "tachie": return { say: ["立ち絵モーション＋リリックモーションで"], args: [], why: "キャラ素材を拍で踊らせ、口パクと縦書き吹き出しの歌詞" };
  }
}
/** confirmation screen lines. */
export function confirmLines(m: Material, c: Choice, o: { why: string; cost: string; aspect: string; extra?: string[] }): string[] {
  const q2 = q2Options(c.q1, m).find((x) => x.key === c.q2) ?? { label: c.q2 };
  return [
    "📋 この内容で作ります（Enter で開始 / n でやめる）",
    `  素材: ${materialLine(m)}`,
    `  映像: ${q2.label.replace(/（.*$/, "")} — ${o.why}`,
    `  進め方: ${Q3_OPTS.find((x) => x.key === c.q3)!.label}`,
    ...(o.extra ?? []).map((l) => `     ${l}`),
    `  画面: ${o.aspect}`,
    `  費用: ${o.cost}`,
    "  できあがり: MP4（projects/<曲名>/out/）と編集画面用のプロジェクト（あとから全部直せます: npm run editor -- --project <曲名>）",
  ];
}

/** 「画像を動画にする」: which scenes and how (default = free manual, never a paid call without confirmation). */
export type AnimScope = "chorus" | "all" | "pick";
export type AnimMethod = "manual" | "paid";
export const ANIM_SCOPES = (n: { chorus: number; all: number }, _cost: { chorus?: string; all?: string } = {}): Opt<AnimScope>[] => [
  { key: "chorus", label: `選んだシーンだけ: サビの見せ場（約${n.chorus}本）`, why: "見せ場だけ本物の動き。手作業なら0円" },
  { key: "pick", label: "選んだシーンだけ: 画像を番号で選ぶ", why: "動かしたい画像を選ぶ（例 1,3）。その画像のシーンだけ動画にする" },
  { key: "all", label: `全部（約${n.all}本）`, why: "全編を動画に。手作業なら0円（手間は多め）" },
];
export const ANIM_METHODS = (_perClip?: string, _total?: string): Opt<AnimMethod>[] => [
  { key: "manual", label: "無料（Grokアプリ等で手作業→取り込み）", why: "プロンプト一覧（prompts.csv）と元画像を Grok アプリ / grok.com の「画像から動画」に入れて作り、npm run gen -- import で取り込む。0円" },
  { key: "paid", label: "MCP・動画生成APIを使う（有料。使う直前に見積もりを見せて毎回確認）", why: "Pollo などの MCP や Grok Imagine API で作る。いまは作業リストを作るだけで、生成するときに金額を見せて確認します（自動では実行しません）" },
];
/** args for npm run mv. */
export const animArgs = (scope: AnimScope, method: AnimMethod, images: string[] = []) => ["--video-scope", scope, "--video-method", method, ...(scope === "pick" && images.length ? ["--video-images", images.join(",")] : [])];
