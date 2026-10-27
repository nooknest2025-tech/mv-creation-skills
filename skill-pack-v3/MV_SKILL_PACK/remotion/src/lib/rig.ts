// Parts animation (パーツアニメーション, Live2D-like but 2D cut-out): a rig = tree of full-canvas PNG layers with pivots.
// Pure solver: per-part rotation / translation / scale around pivots, spring secondary motion (hair / clothes / accessories),
// blink + mouth shapes, driven by beat, section energy and lyric mora timing. Rendered by src/render/Rig.tsx.
import { clamp, hash, rng, type Beat, beatLen } from "./core";

export type PartKind = "body" | "head" | "hair" | "hair_back" | "eye_l" | "eye_r" | "eyes" | "mouth" | "brow" | "arm_l" | "arm_r" | "hand_l" | "hand_r" | "leg" | "cloth" | "accessory" | "tail" | "other";
export interface Part { id: string; src: string; kind: PartKind; parent?: string | null; pivot: [number, number]; z: number; bbox?: [number, number, number, number]; states?: Record<string, string> /* closed | a i u e o | n */; spring?: number /* 0..1 secondary amount */; locked?: boolean }
export interface Rig { name: string; size: [number, number]; parts: Part[]; note?: string; source?: "psd" | "pngs" | "split" | "ai" | "demo"; quality?: string }

const KIND_WORDS: [RegExp, PartKind][] = [
  [/後ろ髪|うしろ髪|back.?hair|hair.?back|髪.?後/i, "hair_back"], [/前髪|横髪|髪|hair|bang|ahoge|アホ毛/i, "hair"], [/眉|brow/i, "brow"],
  [/左目|目.?左|eye.?l|l.?eye/i, "eye_l"], [/右目|目.?右|eye.?r|r.?eye/i, "eye_r"], [/目|瞳|eye/i, "eyes"], [/口|mouth|lip/i, "mouth"],
  [/左腕|腕.?左|arm.?l|l.?arm|左手|hand.?l/i, "arm_l"], [/右腕|腕.?右|arm.?r|r.?arm|右手|hand.?r/i, "arm_r"],
  [/頭|顔|face|head/i, "head"], [/脚|足|leg/i, "leg"], [/リボン|ribbon|髪飾り/i, "accessory"], [/服|スカート|袖|コート|cloth|skirt|dress|マフラー|scarf/i, "cloth"],
  [/しっぽ|尻尾|tail/i, "tail"], [/アクセ|イヤリング|ピアス|帽子|hat|accessor|earring/i, "accessory"], [/体|胴|body|torso/i, "body"],
];
export function guessKind(name: string): PartKind { for (const [re, k] of KIND_WORDS) if (re.test(name)) return k; return "other"; }
/** pivot guess from the layer's bounding box: heads turn at the neck, arms at the shoulder, hair/cloth hang from the top. */
export function guessPivot(kind: PartKind, b: [number, number, number, number], canvas: [number, number]): [number, number] {
  const [x0, y0, x1, y1] = b, cx = (x0 + x1) / 2, w = x1 - x0, h = y1 - y0;
  switch (kind) {
    case "head": return [cx, y1 - h * 0.08];
    case "body": return [cx, y1 - h * 0.1];
    case "arm_l": case "hand_l": return [x1 - w * 0.2, y0 + h * 0.08]; // left of the picture = character's right; shoulder is the inner top
    case "arm_r": case "hand_r": return [x0 + w * 0.2, y0 + h * 0.08];
    case "hair": case "hair_back": case "cloth": case "accessory": case "brow": return [cx, y0 + h * 0.05];
    case "tail": return [x0 + w * 0.1, y0 + h * 0.5];
    case "leg": return [cx, y0];
    default: return [cx, (y0 + y1) / 2];
  }
}
const HEADISH: PartKind[] = ["hair", "hair_back", "eye_l", "eye_r", "eyes", "mouth", "brow", "accessory"];
/** build a rig from named layers (PSD / PNG list) with guessed kinds, pivots, parents; z = layer order. Every guess is editable in rig.json. */
export function autoRig(name: string, size: [number, number], layers: { name: string; src: string; bbox: [number, number, number, number]; states?: Record<string, string> }[]): Rig {
  const parts: Part[] = layers.map((l, i) => { const kind = guessKind(l.name); return { id: uniq(l.name, i), src: l.src, kind, pivot: guessPivot(kind, l.bbox, size), z: i, bbox: l.bbox, states: l.states, spring: kind === "hair" || kind === "hair_back" ? 0.8 : kind === "cloth" || kind === "accessory" || kind === "tail" ? 0.6 : 0 }; });
  const body = parts.find((p) => p.kind === "body"), head = parts.find((p) => p.kind === "head");
  for (const p of parts) {
    if (p === body) p.parent = null;
    else if (p === head) p.parent = body?.id ?? null;
    else if (head && (HEADISH.includes(p.kind) || p.kind === "other") && (!p.bbox || !head.bbox || p.bbox[1] < head.bbox[3])) p.parent = head.id;
    else if (head && head.bbox && p.bbox && !["arm_l", "arm_r", "hand_l", "hand_r", "leg", "body"].includes(p.kind) && (p.bbox[1] + p.bbox[3]) / 2 < head.bbox[3]) p.parent = head.id; // e.g. a hat / ribbon on the head
    else p.parent = body?.id ?? null;
  }
  return { name, size, parts, source: "pngs" };
}
const uniq = (n: string, i: number) => `${n.normalize("NFKC").replace(/[^\w\u3040-\u9fff]+/g, "_").replace(/^_|_$/g, "") || "part"}_${i}`;
/** sanity issues for the review step (Japanese). */
export function rigIssues(r: Rig): string[] {
  const out: string[] = [], ids = new Set(r.parts.map((p) => p.id));
  if (!r.parts.some((p) => p.kind === "head")) out.push("頭（head）のパーツがありません → 首かしげ・うなずきは動きません。レイヤー名に「頭」を入れるか rig.json の kind を head に");
  if (!r.parts.some((p) => p.kind === "body")) out.push("体（body）のパーツがありません → 体の揺れは全体に掛かります");
  if (!r.parts.some((p) => p.kind === "mouth")) out.push("口（mouth）のパーツがありません → 口パクなし");
  for (const p of r.parts) { if (p.parent && !ids.has(p.parent)) out.push(`${p.id}: 親 ${p.parent} が存在しません`); if (p.pivot.some((v) => !Number.isFinite(v))) out.push(`${p.id}: 支点が不正`); }
  // cycle check
  for (const p of r.parts) { let q: Part | undefined = p; const seen = new Set<string>(); while (q?.parent) { if (seen.has(q.id)) { out.push(`${p.id}: 親子関係がループしています`); break; } seen.add(q.id); q = r.parts.find((x) => x.id === q!.parent); } }
  return out;
}

// ---------- motion presets ----------
export interface PartsPreset { ja: string; say: string; why: string; words: RegExp; head: number; nod: number; tilt: number; arm: number; wave: number; bob: number; sway: number; mouth: number; blink: number }
const PP = (ja: string, say: string, why: string, words: RegExp, x: Partial<PartsPreset>): PartsPreset => ({ ja, say, why, words, head: 0.3, nod: 0, tilt: 0, arm: 0.1, wave: 0, bob: 0.3, sway: 0.3, mouth: 1, blink: 1, ...x });
export const PARTS_PRESETS: Record<string, PartsPreset> = {
  auto: PP("おまかせ（曲に合わせる）", "", "Aメロは待機＋歌、サビはノリ（グルーヴ）を自動で", /^$/, {}),
  idle: PP("待機（呼吸・まばたき）", "キャラは待機で", "静かな呼吸と小さな揺れ。バラード向き", /待機|アイドル状態|呼吸だけ|じっと/, { bob: 0.15, sway: 0.2, arm: 0.05 }),
  nod: PP("うなずき", "キャラはうなずいて", "拍に合わせて首を縦に", /うなず|頷|首を縦/, { nod: 1, bob: 0.25 }),
  sing: PP("歌う（口パク＋頭の動き）", "キャラは歌って", "歌詞の音節で口を開け、フレーズで頭を傾ける", /歌って|歌わせ|口パク(で|して)/, { mouth: 1, head: 0.6, tilt: 0.3 }),
  groove: PP("ダンス・グルーヴ", "キャラはノリノリで", "拍で体が弾み、腕が交互に振れる", /ノリ|グルーヴ|踊って|ダンスして|揺れて/, { bob: 1, sway: 0.8, arm: 0.8, head: 0.5, nod: 0.4 }),
  wave: PP("手を振る", "キャラは手を振って", "片腕を大きく振る（右腕）", /手を振|腕を振|バイバイ/, { wave: 1, bob: 0.4 }),
  tilt: PP("首をかしげる", "キャラは首をかしげて", "首を横に傾けて止める（かわいい/考え中）", /首を?かしげ|首を?傾げ|小首/, { tilt: 1, head: 0.2 }),
};
export const partsPresetFromText = (t: string) => Object.entries(PARTS_PRESETS).find(([k, p]) => k !== "auto" && p.words.test(t))?.[0] ?? null;

// ---------- mora -> mouth ----------
const ROWS: [string, string][] = [["a", "あかさたなはまやらわがざだばぱぁゃアカサタナハマヤラワガザダバパァャ"], ["i", "いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ"], ["u", "うくすつぬふむゆるぐずづぶぷぅゅウクスツヌフムユルグズヅブプゥュヴ"], ["e", "えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ"], ["o", "おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョ"], ["n", "んンっッ"]];
export function vowelOf(ch: string): "a" | "i" | "u" | "e" | "o" | "n" { for (const [v, s] of ROWS) if (s.includes(ch)) return v as any; return /[a-z]/i.test(ch) ? "a" : "a"; }
export interface Mora { t0: number; t1: number; ch: string }
/** mouth at time t: open amount 0..1 + vowel shape (per lyric mora). */
export function mouthAt(mora: Mora[], t: number): { open: number; shape: "a" | "i" | "u" | "e" | "o" | "n" | "closed" } {
  const m = mora.find((x) => t >= x.t0 - 0.03 && t < Math.max(x.t1, x.t0 + 0.08));
  if (!m) return { open: 0, shape: "closed" };
  const v = vowelOf(m.ch), d = Math.max(0.08, m.t1 - m.t0), p = clamp((t - m.t0 + 0.03) / d);
  const env = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 0.6;
  const base = v === "a" ? 1 : v === "o" ? 0.8 : v === "e" ? 0.65 : v === "u" ? 0.45 : v === "i" ? 0.4 : 0.1;
  return { open: base * env, shape: env < 0.15 ? "closed" : v };
}
/** blink: ~every 3-5 s, 4 frames, deterministic. */
export function blinkAt(t: number, seed = 1): number {
  const per = 3.6, k = Math.floor(t / per), r = rng("blink", seed, k), at = k * per + r.uniform(0.3, per - 0.4), d = t - at;
  return d >= 0 && d < 0.14 ? Math.sin((Math.PI * d) / 0.14) : 0;
}

// ---------- solver ----------
export interface PartPose { rot: number; dx: number; dy: number; sx: number; sy: number; state?: string }
export interface DriveCtx { beat: Beat; energy: number /* 0..1 section energy */; mora: Mora[]; sectionType?: string; seed?: number }
const base = (): PartPose => ({ rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 });
/** primary pose of the big parts (body / head / arms) at time t. */
export function primary(preset: PartsPreset, t: number, c: DriveCtx, H: number) {
  const B = beatLen(c.beat), x = (t - c.beat.phase) / B, ph = x - Math.floor(x), e = 0.4 + 0.6 * c.energy;
  const hit = Math.exp(-ph * 4); // decays after each beat
  const bob = preset.bob * e * (H * 0.012) * (1 - Math.cos(2 * Math.PI * ph)) * 0.5 + preset.bob * 0.15 * H * 0.01 * Math.sin(t * 1.6);
  const sway = preset.sway * e * 2.2 * Math.sin(Math.PI * x);
  const body: PartPose = { ...base(), dy: bob, rot: sway * 0.5, sy: 1 + 0.006 * Math.sin(t * 2.2) * (1 + preset.bob) }; // breath
  const phraseTilt = c.mora.length ? Math.sin(t * 0.9 + (c.seed ?? 0)) * 3 * preset.head : 0;
  const head: PartPose = { ...base(), rot: -sway * 0.6 + phraseTilt + preset.tilt * 12, dy: preset.nod * e * H * 0.006 * hit };
  head.sy = 1 - preset.nod * e * 0.03 * hit;
  const swing = preset.arm * e * 14 * Math.sin(Math.PI * x);
  const wave = preset.wave ? 35 + 25 * Math.sin(t * 9) : 0;
  return { body, head, armL: { ...base(), rot: swing }, armR: { ...base(), rot: -swing - wave } };
}
/** spring secondary motion: follows the parent's angular velocity with a damped oscillation kernel (frame-rate independent). */
export function secondary(parentRot: (t: number) => number, t: number, amount: number, tau = 0.35, freq = 2.2): number {
  if (!amount) return 0; const dt = 1 / 60; let s = 0;
  for (let n = 0; n < 60; n++) { const tn = t - n * dt; const v = parentRot(tn) - parentRot(tn - dt); s += Math.exp(-(n * dt) / tau) * Math.cos(2 * Math.PI * freq * n * dt) * v; }
  return -s * amount * 1.6;
}
/** pose of every part at time t. */
export function solveRig(r: Rig, presetId: string, t: number, c: DriveCtx): Record<string, PartPose> {
  const preset = PARTS_PRESETS[presetId] ?? PARTS_PRESETS.idle, H = r.size[1];
  const P = (tt: number) => primary(preset, tt, c, H);
  const now = P(t), out: Record<string, PartPose> = {};
  const blink = preset.blink ? blinkAt(t, c.seed ?? hash(r.name)) : 0, mouth = preset.mouth ? mouthAt(c.mora, t) : { open: 0, shape: "closed" as const };
  for (const p of r.parts) {
    let q = base();
    if (p.kind === "body") q = now.body;
    else if (p.kind === "head") q = now.head;
    else if (p.kind === "arm_l" || p.kind === "hand_l") q = now.armL;
    else if (p.kind === "arm_r" || p.kind === "hand_r") q = now.armR;
    else if (p.spring) { const parent = r.parts.find((x) => x.id === p.parent); const pk = parent?.kind === "head" ? "head" : "body"; q = { ...base(), rot: secondary((tt) => P(tt)[pk].rot + (pk === "head" ? P(tt).body.rot : 0) + P(tt)[pk].dy * 0.05, t, p.spring) }; }
    if (p.kind === "eye_l" || p.kind === "eye_r" || p.kind === "eyes") { if (p.states?.closed) q = { ...q, state: blink > 0.5 ? "closed" : undefined }; else q = { ...q, sy: 1 - 0.9 * blink }; }
    if (p.kind === "mouth") { const st = mouth.shape !== "closed" && p.states?.[mouth.shape] ? mouth.shape : mouth.open > 0.15 && p.states?.a ? "a" : undefined; q = { ...q, state: st, sy: st ? 1 : 1 + mouth.open * 0.9 * (p.states ? 0 : 1) }; }
    out[p.id] = q;
  }
  return out;
}
/** which preset to use for a section when the user said 「おまかせ」. */
export function autoPartsPreset(sectionType: string, energy: number): string {
  if (sectionType === "chorus") return energy > 0.55 ? "groove" : "sing";
  if (sectionType === "intro" || sectionType === "outro") return "idle";
  if (sectionType === "bridge") return "tilt";
  return "sing";
}

const STATE_SUFFIX = /^(.*?)[_\-\s・]+(閉じ?|とじ|closed?|[aiueo]|あ|い|う|え|お|ん|n)$/i;
const STATE_KEY: Record<string, string> = { 閉: "closed", 閉じ: "closed", とじ: "closed", close: "closed", closed: "closed", あ: "a", い: "i", う: "u", え: "e", お: "o", ん: "n" };
/** named layers (PSD / PNG files / split output) -> rig. 「目_閉じ」「口_a」 style layers become states of 「目」「口」. */
export function layersToRig(name: string, size: [number, number], layers: { name: string; src: string; bbox: [number, number, number, number] }[]): Rig {
  const leaf = (n: string) => n.split("/").pop()!.replace(/\.(png|webp)$/i, "");
  const names = new Set(layers.map((l) => leaf(l.name)));
  const base: typeof layers = [], states: Record<string, Record<string, string>> = {};
  for (const l of layers) {
    const m = leaf(l.name).match(STATE_SUFFIX);
    if (m && names.has(m[1])) { const k = STATE_KEY[m[2].toLowerCase()] ?? m[2].toLowerCase(); (states[m[1]] ??= {})[k] = l.src; }
    else base.push(l);
  }
  return autoRig(name, size, base.map((l) => ({ ...l, name: leaf(l.name), states: states[leaf(l.name)] })));
}
/** edit one field: "head_4.pivot=320,410" | "hair_6.parent=head_4" | "x.kind=hair" | "x.z=3" | "x.spring=0.7". */
export function editRig(r: Rig, expr: string): string {
  const m = expr.match(/^([^.=]+)\.(pivot|parent|kind|z|spring)=(.*)$/); if (!m) throw new Error(`書式: パーツID.pivot=x,y / .parent=ID / .kind=head / .z=3 / .spring=0.6（${expr}）`);
  const p = r.parts.find((x) => x.id === m[1] || x.id.startsWith(m[1] + "_")); if (!p) throw new Error(`パーツ ${m[1]} がありません: ${r.parts.map((x) => x.id).join(", ")}`);
  const v = m[3].trim();
  if (m[2] === "pivot") { const [x, y] = v.split(",").map(Number); if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("pivot は x,y の数字で"); p.pivot = [x, y]; }
  else if (m[2] === "parent") p.parent = v === "none" || v === "" ? null : v;
  else if (m[2] === "kind") p.kind = v as PartKind;
  else if (m[2] === "z") p.z = Number(v);
  else p.spring = Math.max(0, Math.min(1, Number(v)));
  p.locked = true;
  return `${p.id}.${m[2]} → ${v}`;
}
