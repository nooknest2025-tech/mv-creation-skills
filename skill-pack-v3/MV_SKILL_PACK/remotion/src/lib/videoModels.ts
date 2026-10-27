// Per-model reference capability map + prompt/request adapters + recommender.
// Every capability here is from official docs (see docs/VIDEO_MODELS_ja.md); unknown = null + verified:false.
import type { Asset } from "./assets";
import { proseOf, type ShotSpec } from "./shotprompt";

export type Slot = "first_frame" | "last_frame" | "keyframes" | "subject_refs" | "style_ref" | "elements" | "audio";
export interface RefCaps {
  family: string; verified: boolean; source: string;
  maxRefs: number | null; // subject/character/multi-image refs
  slots: Slot[]; exclusive?: Slot[][]; // groups that cannot be combined
  keyframes?: number; minPx?: number; aspectRange?: [number, number]; maxMB?: number;
  promptMax: number | null; lang: string; camera: "natural" | "bracket" | "motion_only";
  negative: "param" | "inline" | "none"; refToken?: (i: number) => string; notes?: string;
}
export const CAPS: Record<string, RefCaps> = {
  "grok-imagine-video-1.5": { family: "grok", verified: true, source: "https://docs.x.ai/developers/model-capabilities/video/reference-to-video", maxRefs: 14, slots: ["first_frame", "last_frame", "keyframes", "subject_refs", "audio"], keyframes: 4, promptMax: null, lang: "en", camera: "natural", negative: "inline", refToken: (i) => `<IMAGE_${i}>`, notes: "参照は720pまで。音声は preset voice（自前音声はパートナー限定）" },
  "grok-imagine-video-1.5-lite": { family: "grok", verified: true, source: "https://docs.x.ai/developers/model-capabilities/video/overview", maxRefs: 0, slots: ["first_frame"], promptMax: null, lang: "en", camera: "natural", negative: "inline" },
  "grok-imagine-video": { family: "grok", verified: true, source: "https://docs.x.ai/developers/model-capabilities/video/overview", maxRefs: 7, slots: ["first_frame", "subject_refs"], promptMax: null, lang: "en", camera: "natural", negative: "inline", refToken: (i) => `<IMAGE_${i}>` },
  "kling-3.0": { family: "kling", verified: true, source: "https://kling.ai/document-api/api/video/3-0-omni/image-to-video.md", maxRefs: 7, slots: ["first_frame", "last_frame", "subject_refs", "elements", "style_ref"], minPx: 300, aspectRange: [1 / 2.5, 2.5], maxMB: 10, promptMax: 2500, lang: "en/zh", camera: "natural", negative: "inline", refToken: (i) => `<<<image_${i + 1}>>>`, notes: "画像+エレメント合計7（参照動画ありは4）。終了画は開始画が必須。画像3枚以上だと終了画不可" },
  "wan2.6-i2v": { family: "wan", verified: true, source: "https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan2-6-i2v", maxRefs: 0, slots: ["first_frame", "audio"], promptMax: 1500, lang: "zh/en", camera: "natural", negative: "param" },
  "wan2.6-t2v": { family: "wan", verified: true, source: "https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan2-6-t2v", maxRefs: 0, slots: ["audio"], promptMax: 1500, lang: "zh/en", camera: "natural", negative: "param" },
  "wan2.6-r2v": { family: "wan", verified: true, source: "https://www.alibabacloud.com/help/en/model-studio/legacy-wan-reference-to-video-api-reference", maxRefs: 5, slots: ["subject_refs"], promptMax: 1500, lang: "zh/en", camera: "natural", negative: "param", refToken: (i) => `character${i + 1}`, notes: "1枚=1キャラ。順番で character1, character2…" },
  "wan2.2-kf2v-flash": { family: "wan", verified: true, source: "https://www.alibabacloud.com/help/en/model-studio/legacy-image-to-video-by-first-and-last-frame-api-reference", maxRefs: 0, slots: ["first_frame", "last_frame"], minPx: 240, maxMB: 10, promptMax: 800, lang: "zh/en", camera: "natural", negative: "param", notes: "尺は5秒固定・無音" },
  "MiniMax-Hailuo-2.3": { family: "hailuo", verified: true, source: "https://platform.minimax.io/docs", maxRefs: 0, slots: ["first_frame"], promptMax: 2000, lang: "en/zh", camera: "bracket", negative: "none" },
  "seedance-2.0": { family: "seedance", verified: false, source: "https://docs.byteplus.com/en/docs/modelark/seedance-2-0-prompt-guide", maxRefs: 9, slots: ["first_frame", "last_frame", "subject_refs", "audio"], exclusive: [["first_frame", "subject_refs"], ["last_frame", "subject_refs"]], promptMax: null, lang: "en/zh", camera: "natural", negative: "inline", notes: "フレームモードと参照モードは併用不可。参照音声は画像/動画が必要" },
  "veo-3.1-generate-001": { family: "veo", verified: true, source: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", maxRefs: 3, slots: ["first_frame", "last_frame", "subject_refs"], exclusive: [["first_frame", "subject_refs"]], promptMax: null, lang: "en", camera: "natural", negative: "param", notes: "lastFrame は image 必須。image と referenceImages は排他。参照画像使用時は8秒" },
  "vidu/q3": { family: "vidu", verified: true, source: "https://platform.vidu.com/docs/api-reference/video-models/vidu-q3/reference-to-video", maxRefs: 7, slots: ["subject_refs", "audio"], minPx: 128, aspectRange: [0.25, 4], promptMax: null, lang: "en/zh", camera: "natural", negative: "none", refToken: (i) => `[@image${i + 1}]`, notes: "主体は最大7、一時主体は1つにつき3枚まで。POST本体20MB以内" },
  "runway/gen4_turbo": { family: "runway", verified: true, source: "https://help.runwayml.com/ (Gen-4 Video Prompting Guide)", maxRefs: 0, slots: ["first_frame"], promptMax: 1000, lang: "en", camera: "motion_only", negative: "none", notes: "画像→動画のプロンプトは動きだけを書く（公式ガイド）" },
  "runway/gen4.5": { family: "runway", verified: false, source: "https://docs.dev.runwayml.com/", maxRefs: 0, slots: ["first_frame"], promptMax: 1000, lang: "en", camera: "motion_only", negative: "none" },
  "luma/ray-3.2": { family: "luma", verified: false, source: "https://docs.lumalabs.ai/docs/video-generation", maxRefs: null, slots: ["first_frame"], promptMax: null, lang: "en", camera: "natural", negative: "none", notes: "参照・終了画の仕様は未確認" },
  "pixverse/v5": { family: "pixverse", verified: false, source: "https://docs.platform.pixverse.ai/text-to-video-generation-13016634e0", maxRefs: null, slots: ["first_frame"], promptMax: null, lang: "en", camera: "natural", negative: "none" },
  "pollo/pollo-v2": { family: "pollo", verified: false, source: "https://docs.pollo.ai/pollo-ai/pollo-v2", maxRefs: null, slots: [], promptMax: null, lang: "en", camera: "natural", negative: "none" },
};
const capsOf = (id: string): RefCaps => CAPS[id] ?? CAPS[Object.keys(CAPS).find((k) => id.endsWith(k) || id.includes(k)) ?? ""] ?? { family: "generic", verified: false, source: "", maxRefs: 0, slots: ["first_frame"], promptMax: null, lang: "en", camera: "natural", negative: "inline" };
export { capsOf };

// ---- ref packing with graceful downgrade ----
export interface Packed { first?: Asset; last?: Asset; keyframes: Asset[]; refs: Asset[]; audio?: Asset; composite?: Asset[]; dropped: { a: Asset; why: string }[]; notes: string[] }
export function packRefs(modelId: string, refs: Asset[], o: { needsLast?: boolean } = {}): Packed {
  const c = capsOf(modelId), has = (s: Slot) => c.slots.includes(s);
  const p: Packed = { keyframes: [], refs: [], dropped: [], notes: [] };
  const start = refs.find((a) => a.role === "start_frame"), end = refs.find((a) => a.role === "end_frame");
  const subj = refs.filter((a) => !["start_frame", "end_frame", "keyframe", "lipsync_audio"].includes(a.role));
  const excl = (a: Slot, b: Slot) => (c.exclusive ?? []).some((g) => g.includes(a) && g.includes(b));
  // decide mode: frames vs references when exclusive
  const preferRefs = subj.length >= 2 && start == null;
  if (start && has("first_frame") && !(preferRefs && excl("first_frame", "subject_refs"))) p.first = start;
  else if (start) p.dropped.push({ a: start, why: has("first_frame") ? "参照モードと併用不可" : "開始画スロットなし" });
  if (end) {
    if (has("last_frame") && p.first && !excl("last_frame", "subject_refs")) p.last = end;
    else if (has("last_frame") && p.first && excl("last_frame", "subject_refs")) { p.last = end; p.notes.push("フレームモード優先：参照画像は使いません"); }
    else p.dropped.push({ a: end, why: !has("last_frame") ? "終了画スロットなし → 次ショットの開始画として使ってください" : "終了画には開始画が必要" });
  }
  if (has("keyframes")) p.keyframes = refs.filter((a) => a.role === "keyframe").slice(0, c.keyframes ?? 0);
  const refsAllowed = (has("subject_refs") || has("elements")) && !(p.first && excl("first_frame", "subject_refs")) && !(p.last && excl("last_frame", "subject_refs"));
  let max = refsAllowed ? (c.maxRefs ?? 0) : 0;
  if (c.family === "kling") { if (p.last) max = Math.min(max, 0); max -= p.first ? 1 : 0; }
  if (refsAllowed) { p.refs = subj.slice(0, Math.max(0, max)); for (const a of subj.slice(Math.max(0, max))) p.dropped.push({ a, why: `参照の上限 ${c.maxRefs} 枚を超過` }); }
  else if (subj.length) {
    // downgrade: no ref slot -> merge sheet+outfit+location into one composite start frame (generated by image model)
    if (!p.first && has("first_frame")) { p.composite = subj.slice(0, 5); p.notes.push(`このモデルは参照画像に非対応 → 参照${p.composite.length}枚を合成した「開始画」を画像モデルで作ってから image-to-video にします`); }
    else for (const a of subj) p.dropped.push({ a, why: "参照スロットなし（開始画で見た目を固定）" });
  }
  const aud = refs.find((a) => a.role === "lipsync_audio");
  if (aud) { if (has("audio")) p.audio = aud; else p.dropped.push({ a: aud, why: "音声入力なし → 後で口パク（リップシンク）ツールか、静止画モードの口パクで" }); }
  return p;
}

// ---- prompt adapters ----
const BRACKET: Record<string, string> = { push: "[Push in]", pull: "[Pull out]", pan: "[Pan right]", truck: "[Truck right]", tilt: "[Tilt up]", pedestal: "[Pedestal up]", zoom: "[Zoom in]", shake: "[Shake]", track: "[Tracking shot]", static: "[Static shot]", crane: "[Pedestal up]", orbit: "[Truck left,Pan right]" };
export function snapDuration(sec: number, m: { durations?: number[] | null; allowed_durations?: number[] | null; min_sec?: number | null; max_sec?: number | null }) {
  if (m.allowed_durations?.length) return m.allowed_durations.reduce((b, d) => (Math.abs(d - sec) < Math.abs(b - sec) || (Math.abs(d - sec) === Math.abs(b - sec) && d > b) ? d : b));
  const [lo, hi] = m.durations ?? [m.min_sec ?? 1, m.max_sec ?? 15];
  return Math.min(hi, Math.max(lo, Math.ceil(sec)));
}
export interface Request { model: string; prompt: string; negative_prompt?: string; seconds: number; params: Record<string, any>; refs: Packed; warnings: string[] }
export function adapt(sp: ShotSpec, model: any, refs: Asset[] = [], o: { res?: string; aspect?: string } = {}): Request {
  const c = capsOf(model.id), packed = packRefs(model.id, refs);
  const motionOnly = c.camera === "motion_only" && !!(packed.first || packed.composite);
  let prompt = proseOf(sp, { motionOnly });
  if (c.camera === "bracket") prompt = `${BRACKET[sp.move.mm] ?? "[Static shot]"} ` + prompt.replace(/camera: [^.]+\. /, "");
  if (packed.refs.length && c.refToken) prompt += " References: " + packed.refs.map((a, i) => `${c.refToken!(i + (c.family === "grok" && packed.first ? 1 : 0))} = ${a.role.replace("_", " ")}${a.note ? ` (${a.note})` : ""}`).join("; ") + ".";
  if (sp.performance === "lipsync" && /grok|veo|seedance|kling/.test(c.family)) prompt += " The singer's lips are precisely synced to the vocal.";
  const neg = sp.negatives.join(", ");
  if (c.negative === "inline") prompt += ` Avoid: ${neg}.`;
  const warnings: string[] = [];
  if (c.promptMax && prompt.length > c.promptMax) { prompt = prompt.slice(0, c.promptMax - 1); warnings.push(`プロンプトを${c.promptMax}文字に短縮`); }
  if (!c.verified) warnings.push("このモデルの参照/プロンプト仕様は未確認（公式で要確認）");
  const seconds = snapDuration(sp.beatSec, model);
  if (Math.abs(seconds - sp.beatSec) > 0.6) warnings.push(`尺 ${sp.beatSec}s → モデルの対応尺 ${seconds}s（編集でトリム）`);
  const params: Record<string, any> = { duration: seconds, resolution: o.res ?? "720p", aspect_ratio: o.aspect ?? "16:9" };
  if (c.family === "hailuo") params.prompt_optimizer = false; // keep our camera commands literal
  if (c.family === "wan") params.prompt_extend = false;
  return { model: model.id, prompt, negative_prompt: c.negative === "param" ? neg.slice(0, 500) : undefined, seconds, params, refs: packed, warnings };
}

// ---- recommender (fit + budget, Japanese reasons, per-shot override) ----
export interface Pick { model: any; score: number; why: string[]; cost: number | null }
/** price at a resolution; 720p may use the model's 768p tier (MiniMax). Never guesses another tier. */
export const RES_ALIAS: Record<string, string[]> = { "720p": ["720p", "768p"], "1080p": ["1080p"], "480p": ["480p", "540p"], "4k": ["4k"] };
export const priceAt = (m: any, res: string): number | null => { if (!m.price_per_sec) return null; for (const k of [...(RES_ALIAS[res] ?? [res]), "any"]) if (m.price_per_sec[k] != null) return m.price_per_sec[k]; return null; };
export function recommendModel(sp: ShotSpec, models: any[], o: { res?: string; budgetPerShot?: number; refs?: Asset[]; override?: string; verifiedOnly?: boolean } = {}): Pick {
  const res = o.res ?? "720p";
  if (o.override) { const m = models.find((x) => x.id === o.override); if (m) return { model: m, score: 999, why: ["ユーザー指定（このショットは固定）"], cost: priceAt(m, res) }; }
  const cand = models.filter((m) => m.kind === "video" && !m.deprecated && !String(m.id).startsWith("manual/") && (!o.verifiedOnly || (m.verified && m.price_per_sec)));
  const refs = o.refs ?? [];
  const scored = cand.map((m) => {
    const c = capsOf(m.id), why: string[] = []; let s = 0;
    if (!m.durations && !m.allowed_durations && m.max_sec == null) { s -= 25; why.push("対応する尺が未確認"); }
    if (sp.performance === "lipsync") { if (/lipsync/.test(m.audio ?? "")) { s += 30; why.push("口パク付き音声をネイティブ生成"); } else if (/native/.test(m.audio ?? "")) { s += 12; why.push("音声つき生成に対応"); } else s -= 10; }
    const nRefs = refs.filter((a) => /character|outfit|location|prop|style|expression|pose/.test(a.role)).length;
    if (nRefs) { const k = c.maxRefs ?? 0; if (k >= nRefs) { s += 20; why.push(`参照${nRefs}枚をそのまま使える（最大${k}）`); } else if (k > 0) { s += 8; why.push(`参照は${k}枚まで`); } else s -= 6; }
    if (refs.some((a) => a.role === "end_frame")) { if (c.slots.includes("last_frame")) { s += 15; why.push("開始画→終了画のマッチカットに対応"); } else s -= 8; }
    if (sp.move.mm !== "static" && c.camera === "bracket") { s += 10; why.push("カメラ命令で動きを正確に指定できる"); }
    if (sp.performance === "dance" && (m.max_sec ?? 15) >= 8) { s += 5; why.push("長めの尺でダンスを切らずに撮れる"); }
    const sec = snapDuration(sp.beatSec, m); const fit = Math.abs(sec - sp.beatSec);
    s -= fit * 3; if (fit < 0.6) why.push("拍の尺にぴったり合う");
    const p = priceAt(m, res), cost = p == null ? null : +(p * sec).toFixed(3);
    if (cost == null) { s -= 15; why.push("価格未確認"); } else { s += Math.max(0, 10 - cost * 10); if (o.budgetPerShot != null && cost > o.budgetPerShot) s -= 40; }
    if (!m.verified) s -= 5;
    return { model: m, score: +s.toFixed(2), why, cost };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length) throw new Error("no video model");
  return scored[0];
}
