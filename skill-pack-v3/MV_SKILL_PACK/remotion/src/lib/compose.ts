// Editor compositing (scene.comp + data.comp): split screens, manga panels, picture-in-picture, mirror/kaleidoscope,
// impact frames, slash wipes, zoom punches, name cards, per-panel clip source/segment and a selectable colour grade.
// Pure data + geometry helpers shared by the preview, the MP4 export (same <Scene>), server.py (mirror of checkComp) and tests.
// A project without `comp` fields renders exactly as before (Scene only switches to the compositor when scene.comp exists).

export const COMP_LAYOUTS = { full: "1枚（全画面）", split: "分割（縦・斜め・横）", panels: "コマ割り（1〜4）", pip: "ワイプ（小窓）", mirror: "ミラー（左右・上下）", kaleido: "万華鏡（4面ミラー）", custom: "自由（パネルごとの枠）" } as const;
export const COMP_DIRS = { v: "縦に分ける（斜めは角度で）", h: "横に分ける" } as const;
export const COMP_FX = { white: "白フラッシュ", redneg: "赤ネガ", tealneg: "青緑ネガ", chroma: "色収差" } as const;
export const COMP_ENTER = { none: "なし", slash: "斜めスラッシュ", zoom: "ズームパンチ" } as const;
export const COMP_BORDERS = { none: "なし", focus: "集中線", speed: "スピード線", bolt: "稲妻の境目", h: "横の境目", grid: "十字の境目", grow: "コマが増える境目" } as const;
export const COMP_SLIDES = { none: "なし", left: "右から", right: "左から", up: "下から", merge: "重なって合流" } as const;
export const COMP_LOOKS = { none: "なし（元の色）", ink: "墨（白黒＋2色だけ残す）", mono: "白黒", cube: "LUTファイル（.cube）" } as const;
export const COMP_TITLE = { slam: "叩きつけ", logo: "ロゴ（白フラッシュ）" } as const;

export type CompFx = { t: number; d: number; type: keyof typeof COMP_FX };
export type CompPanel = {
  asset: number; from?: number; rate?: number; freeze?: boolean;
  box?: [number, number, number, number]; clip?: [number, number][];
  cx?: number; cy?: number; z?: number; z1?: number; rot?: number; rot1?: number; dx?: number; dx1?: number; dy?: number; dy1?: number;
  /** parallax layer: how strongly the scene camera (shake, punch-in, punch tilt) moves this panel. 1 = like the frame, 0 = fixed, 2 = foreground. */
  depth?: number;
  flipX?: boolean; flipY?: boolean; appear?: number; until?: number; slide?: keyof typeof COMP_SLIDES;
};
export type CompLayout = { type: keyof typeof COMP_LAYOUTS; dir?: keyof typeof COMP_DIRS; ratio?: number; angle?: number; count?: number; grow?: boolean; step?: number };
export type CompCard = { name: string; sub?: string; color?: string; side?: "left" | "right" };
export type CompTitle = { text: string; at?: number; style?: keyof typeof COMP_TITLE };
/** illustration backdrop: a still (or clip) behind the panels with its own camera move (zoom/pan/tilt) and parallax depth.
 *  `dim` darkens it (0 = as is), `blur` in px (0 = sharp). Used instead of the blurred footage for empty slots / wipes / gaps. */
export type CompBackdropArt = { asset: number; from?: number; cx?: number; cy?: number; z?: number; z1?: number; rot?: number; rot1?: number; dx?: number; dx1?: number; dy?: number; dy1?: number; depth?: number; dim?: number; blur?: number };
export type CompBackdrop = "black" | "footage" | CompBackdropArt;
export type SceneComp = { layout?: CompLayout; panels: CompPanel[]; backdrop?: CompBackdrop; fx?: CompFx[]; shake?: number; punch?: number; tilt?: number; enter?: keyof typeof COMP_ENTER; border?: keyof typeof COMP_BORDERS; card?: CompCard; title?: CompTitle };
export type CompGrade = { look: keyof typeof COMP_LOOKS; keep?: string[]; base?: number; lut?: string };
export type GlobalComp = { colors?: { red?: string; teal?: string }; halftone?: number; vignette?: number; grade?: CompGrade; particles?: boolean; endFade?: boolean; shade?: boolean; camera?: CompCamera; backdrop?: CompBackdrop };
/** camera feel (data.comp.camera): shake noise speed (Hz), punch-in decay (s), zoom/tilt ramp easing. */
export type CompCamera = { shakeHz?: number; punchSec?: number; ease?: "smooth" | "linear" };
export const cameraOf = (data: any) => ({ shakeHz: 7, punchSec: 0.22, ease: "smooth" as "smooth" | "linear", ...(globalComp(data).camera ?? {}) });

export const COMP_DEFAULT_COLORS = { red: "#E0182D", teal: "#2FF5D0" };
export const hasComp = (s: any): s is { comp: SceneComp } => !!s && typeof s.comp === "object" && s.comp !== null && Array.isArray(s.comp.panels);
export const globalComp = (data: any): GlobalComp => (data && typeof data.comp === "object" && data.comp) || {};
export const compColors = (data: any) => ({ ...COMP_DEFAULT_COLORS, ...(globalComp(data).colors ?? {}) });

export type Slot = { box: [number, number, number, number]; clip?: [number, number][]; appear?: number; flipX?: boolean; flipY?: boolean; slide?: CompPanel["slide"]; reuse?: number };
const FULL: [number, number, number, number] = [0, 0, 100, 100];
/** a straight cut across the frame: `ratio` = where the cut crosses the centre, `angle` = tilt in degrees (0 = straight). */
export function cutPolys(dir: "v" | "h", ratio: number, angle: number, W: number, H: number): [[number, number][], [number, number][]] {
  const t = Math.tan((angle * Math.PI) / 180);
  if (dir === "h") {
    const off = (t * (W / 2)) / H * 100, y = ratio * 100; // left edge higher when angle > 0
    return [[[0, 0], [100, 0], [100, y + off], [0, y - off]], [[0, y - off], [100, y + off], [100, 100], [0, 100]]];
  }
  const off = (t * (H / 2)) / W * 100, x = ratio * 100; // top further right when angle > 0
  return [[[0, 0], [x + off, 0], [x - off, 100], [0, 100]], [[x + off, 0], [100, 0], [100, 100], [x - off, 100]]];
}
/** geometry slots a layout gives to its panels (panel.box / panel.clip still win). `beat` = seconds per beat. */
export function layoutSlots(l: CompLayout | undefined, W: number, H: number, beat: number): Slot[] {
  const type = l?.type ?? "custom", r = l?.ratio ?? 0.5, step = (l?.step ?? 1) * beat;
  if (type === "full") return [{ box: FULL }];
  if (type === "split") { const dir = l?.dir ?? "v"; const [a, b] = cutPolys(dir, r, l?.angle ?? 0, W, H); return [{ box: FULL, clip: a }, { box: FULL, clip: b }]; }
  if (type === "mirror") { const h = l?.dir === "h"; const [a, b] = cutPolys(h ? "h" : "v", r, l?.angle ?? 0, W, H); return [{ box: FULL, clip: a }, { box: FULL, clip: b, flipX: !h, flipY: h, reuse: 0 }]; }
  if (type === "kaleido") return [{ box: [0, 0, 50, 50] }, { box: [50, 0, 50, 50], flipX: true, reuse: 0 }, { box: [0, 50, 50, 50], flipY: true, reuse: 0 }, { box: [50, 50, 50, 50], flipX: true, flipY: true, reuse: 0 }];
  if (type === "pip") return [{ box: FULL }, { box: [66, 6, 30, 30], appear: l?.grow === false ? 0 : 0.2, slide: "right" }, { box: [4, 62, 30, 32], appear: l?.grow === false ? 0 : 0.65, slide: "left" }];
  if (type === "panels") {
    const n = Math.max(1, Math.min(4, Math.round(l?.count ?? 2))), p = r * 100;
    if (l?.grow) { // manga panels growing on the beat: full frame, then right half, bottom-left, bottom-right
      const g: Slot[] = [{ box: FULL }, { box: [50, 0, 50, 100], appear: step, slide: "right" }, { box: [0, 50, 50, 50], appear: 2 * step, slide: "up" }, { box: [50, 50, 50, 50], appear: 3 * step, slide: "left" }];
      return g.slice(0, n);
    }
    if (n === 1) return [{ box: FULL }];
    if (n === 2) return [{ box: [0, 0, p, 100] }, { box: [p, 0, 100 - p, 100] }];
    if (n === 3) return [{ box: [0, 0, p, 100] }, { box: [p, 0, 100 - p, 50] }, { box: [p, 50, 100 - p, 50] }];
    return [{ box: [0, 0, 50, 50] }, { box: [50, 0, 50, 50] }, { box: [0, 50, 50, 50] }, { box: [50, 50, 50, 50] }];
  }
  return [];
}
export type ResolvedPanel = Required<Omit<CompPanel, "box" | "clip" | "until">> & { box: [number, number, number, number]; clip?: [number, number][]; until?: number };
/** panels to draw (layout geometry + panel settings). Mirror/kaleido slots without their own panel reuse panel 0, mirrored. */
export function resolvePanels(c: SceneComp, W: number, H: number, beat: number): ResolvedPanel[] {
  const slots = layoutSlots(c.layout, W, H, beat), n = Math.max(c.panels.length, slots.filter((s, i) => i < c.panels.length || s.reuse !== undefined).length);
  const out: ResolvedPanel[] = [];
  for (let i = 0; i < n; i++) {
    const slot = slots[i], own = c.panels[i], p = own ?? (slot?.reuse !== undefined ? c.panels[slot.reuse] : undefined);
    if (!p) continue;
    const fx = !!slot?.flipX, fy = !!slot?.flipY, mirrored = fx !== fy;
    const rot = p.rot ?? 0, rot1 = p.rot1 ?? rot;
    out.push({
      asset: p.asset, from: p.from ?? 0, rate: p.rate ?? 1, freeze: !!p.freeze,
      box: own?.box ?? slot?.box ?? FULL, clip: own?.clip ?? (own?.box ? undefined : slot?.clip),
      cx: p.cx ?? 50, cy: p.cy ?? 50, z: p.z ?? 1, z1: p.z1 ?? p.z ?? 1,
      rot: mirrored ? -rot : rot, rot1: mirrored ? -rot1 : rot1, dx: (fx ? -1 : 1) * (p.dx ?? 0), dx1: (fx ? -1 : 1) * (p.dx1 ?? p.dx ?? 0),
      dy: (fy ? -1 : 1) * (p.dy ?? 0), dy1: (fy ? -1 : 1) * (p.dy1 ?? p.dy ?? 0), depth: p.depth ?? 1,
      flipX: !!p.flipX !== fx, flipY: !!p.flipY !== fy,
      appear: own?.appear ?? slot?.appear ?? 0, until: own?.until, slide: own?.slide ?? slot?.slide ?? "none",
    });
  }
  return out;
}
/** smallest zoom at which a panel's picture still covers its whole box: zoom origin (cx, cy) and slide dx (percent of the box)
 * push an edge in, rotation exposes the corners. Panels are drawn at max(z, coverScale) so a crop never shows an empty black strip. */
export function coverScale(cx: number, cy: number, dx: number, rotDeg: number, boxAspect: number, dy = 0) {
  const ox = (50 + Math.abs(dx)) / Math.max(1, Math.min(cx, 100 - cx)), oy = (50 + Math.abs(dy)) / Math.max(1, Math.min(cy, 100 - cy));
  const r = Math.abs(rotDeg) * Math.PI / 180, a = Math.max(boxAspect, 1 / Math.max(1e-3, boxAspect));
  return Math.max(ox, oy) * (Math.cos(r) + Math.sin(r) * a);
}
/** seconds inside the panel's clip at `local` seconds after the panel appeared. Never loops: holds the last frame. */
export function panelSourceTime(p: { from?: number; rate?: number; freeze?: boolean }, local: number, clipDur?: number, fps = 30) {
  const at = (p.from ?? 0) + (p.freeze ? 0 : Math.max(0, local) * (p.rate ?? 1));
  return clipDur && Number.isFinite(clipDur) && clipDur > 0 ? Math.max(0, Math.min(at, clipDur - 1 / fps)) : at;
}
export const fxActive = (c: SceneComp, st: number) => (c.fx ?? []).filter((x) => st >= x.t && st < x.t + x.d + 1e-6).map((x) => x.type);

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (x: any) => typeof x === "number" && Number.isFinite(x);
const inR = (x: any, a: number, b: number) => num(x) && x >= a && x <= b;
/** the effective backdrop of a scene: scene.comp.backdrop wins over data.comp.backdrop (default black). */
export const backdropOf = (data: any, c: SceneComp | undefined): CompBackdrop => c?.backdrop ?? globalComp(data).backdrop ?? "black";
const BD_KEYS = ["asset", "from", "cx", "cy", "z", "z1", "rot", "rot1", "dx", "dx1", "dy", "dy1", "depth", "dim", "blur"];
/** validation of a backdrop value (scene or global). nAssets undefined = asset index only checked as a non-negative integer. */
export function checkBackdrop(b: any, nAssets?: number) {
  const bad = (m: string) => { throw new Error(m); };
  if (b === "black" || b === "footage") return;
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some((k) => !BD_KEYS.includes(k))) bad("背景は black / footage / イラスト素材です");
  if (!(Number.isInteger(b.asset) && b.asset >= 0 && (nAssets === undefined || b.asset < nAssets))) bad("背景の素材を確認してください");
  if (b.from !== undefined && !inR(b.from, 0, 3600)) bad("背景の開始位置は0秒以上です");
  for (const k of ["cx", "cy"]) if (b[k] !== undefined && !inR(b[k], 0, 100)) bad("背景の中心は0〜100%です");
  for (const k of ["z", "z1"]) if (b[k] !== undefined && !inR(b[k], 0.5, 5)) bad("背景の拡大は0.5〜5倍です");
  for (const k of ["rot", "rot1"]) if (b[k] !== undefined && !inR(b[k], -180, 180)) bad("背景の傾きは-180〜180度です");
  for (const k of ["dx", "dx1", "dy", "dy1"]) if (b[k] !== undefined && !inR(b[k], -50, 50)) bad("背景の移動は-50〜50%です");
  if (b.depth !== undefined && !inR(b.depth, 0, 3)) bad("奥行き（パララックス）は0〜3です");
  if (b.dim !== undefined && !inR(b.dim, 0, 1)) bad("背景の暗さは0〜1です");
  if (b.blur !== undefined && !inR(b.blur, 0, 40)) bad("背景のぼかしは0〜40pxです");
}
/** validation (mirror: server.py check_comp / check_gcomp). Throws a Japanese message. */
export function checkComp(c: any, nAssets: number, sceneLen: number) {
  if (c === undefined) return;
  const bad = (m: string) => { throw new Error(m); };
  if (!c || typeof c !== "object" || !Array.isArray(c.panels) || c.panels.length < 1 || c.panels.length > 6) bad("合成のパネルは1〜6枚です");
  const keys = ["layout", "panels", "backdrop", "fx", "shake", "punch", "tilt", "enter", "border", "card", "title"];
  if (Object.keys(c).some((k) => !keys.includes(k))) bad("合成の設定を確認してください");
  if (c.layout !== undefined) {
    const l = c.layout; if (!l || typeof l !== "object" || !(l.type in COMP_LAYOUTS)) bad("合成の型を確認してください");
    if (Object.keys(l).some((k) => !["type", "dir", "ratio", "angle", "count", "grow", "step"].includes(k))) bad("合成の型の設定を確認してください");
    if (l.dir !== undefined && !(l.dir in COMP_DIRS)) bad("分割の向きを確認してください");
    if (l.ratio !== undefined && !inR(l.ratio, 0.1, 0.9)) bad("分割の比率は0.1〜0.9です");
    if (l.angle !== undefined && !inR(l.angle, -45, 45)) bad("分割の角度は-45〜45度です");
    if (l.count !== undefined && !(Number.isInteger(l.count) && l.count >= 1 && l.count <= 4)) bad("コマの数は1〜4です");
    if (l.grow !== undefined && typeof l.grow !== "boolean") bad("コマが増える設定を確認してください");
    if (l.step !== undefined && !inR(l.step, 0.25, 8)) bad("コマが増える間隔は0.25〜8拍です");
  }
  const pk = ["asset", "from", "rate", "freeze", "box", "clip", "cx", "cy", "z", "z1", "rot", "rot1", "dx", "dx1", "dy", "dy1", "depth", "flipX", "flipY", "appear", "until", "slide"];
  for (const p of c.panels) {
    if (!p || typeof p !== "object" || Object.keys(p).some((k) => !pk.includes(k))) bad("パネルの設定を確認してください");
    if (!(Number.isInteger(p.asset) && p.asset >= 0 && p.asset < nAssets)) bad("パネルの素材を確認してください");
    if (p.from !== undefined && !inR(p.from, 0, 3600)) bad("パネルの開始位置は0秒以上です");
    if (p.rate !== undefined && !inR(p.rate, 0.1, 4)) bad("パネルの速さは0.1〜4倍です");
    for (const k of ["freeze", "flipX", "flipY"]) if (p[k] !== undefined && typeof p[k] !== "boolean") bad("パネルのオン・オフを確認してください");
    if (p.box !== undefined && !(Array.isArray(p.box) && p.box.length === 4 && p.box.every((v: any) => inR(v, 0, 100)))) bad("パネルの枠は0〜100%です");
    if (p.clip !== undefined && !(Array.isArray(p.clip) && p.clip.length >= 3 && p.clip.length <= 12 && p.clip.every((q: any) => Array.isArray(q) && q.length === 2 && q.every((v: any) => inR(v, -50, 150))))) bad("パネルの切り抜きを確認してください");
    for (const k of ["cx", "cy"]) if (p[k] !== undefined && !inR(p[k], 0, 100)) bad("切り抜きの中心は0〜100%です");
    for (const k of ["z", "z1"]) if (p[k] !== undefined && !inR(p[k], 0.5, 5)) bad("パネルの拡大は0.5〜5倍です");
    for (const k of ["rot", "rot1"]) if (p[k] !== undefined && !inR(p[k], -180, 180)) bad("パネルの傾きは-180〜180度です");
    for (const k of ["dx", "dx1"]) if (p[k] !== undefined && !inR(p[k], -50, 50)) bad("パネルの横移動は-50〜50%です");
    for (const k of ["dy", "dy1"]) if (p[k] !== undefined && !inR(p[k], -50, 50)) bad("パネルの縦移動は-50〜50%です");
    if (p.depth !== undefined && !inR(p.depth, 0, 3)) bad("奥行き（パララックス）は0〜3です");
    if (p.appear !== undefined && !inR(p.appear, 0, sceneLen)) bad("パネルの出る秒はシーンの中です");
    if (p.until !== undefined && !(inR(p.until, 0, sceneLen + 1e-6) && p.until > (p.appear ?? 0))) bad("パネルの消える秒は出る秒より後です");
    if (p.slide !== undefined && !(p.slide in COMP_SLIDES)) bad("パネルの入り方を確認してください");
  }
  if (c.backdrop !== undefined) checkBackdrop(c.backdrop, nAssets);
  if (c.fx !== undefined && !(Array.isArray(c.fx) && c.fx.length <= 16 && c.fx.every((x: any) => x && Object.keys(x).every((k) => ["t", "d", "type"].includes(k)) && inR(x.t, 0, sceneLen) && inR(x.d, 0.01, 2) && x.type in COMP_FX))) bad("インパクト効果（秒・長さ・種類）を確認してください");
  if (c.shake !== undefined && !inR(c.shake, 0, 60)) bad("揺れは0〜60です");
  if (c.punch !== undefined && !inR(c.punch, 0, 1)) bad("ズームパンチは0〜1です");
  if (c.tilt !== undefined && !inR(c.tilt, -45, 45)) bad("傾きは-45〜45度です");
  if (c.enter !== undefined && !(c.enter in COMP_ENTER)) bad("入り方を確認してください");
  if (c.border !== undefined && !(c.border in COMP_BORDERS)) bad("線の種類を確認してください");
  if (c.card !== undefined) { const k = c.card; if (!k || typeof k.name !== "string" || !k.name || k.name.length > 40 || (k.sub !== undefined && (typeof k.sub !== "string" || k.sub.length > 60)) || (k.color !== undefined && !HEX.test(k.color)) || (k.side !== undefined && !["left", "right"].includes(k.side)) || Object.keys(k).some((x) => !["name", "sub", "color", "side"].includes(x))) bad("名前カードを確認してください"); }
  if (c.title !== undefined) { const k = c.title; if (!k || typeof k.text !== "string" || !k.text || k.text.length > 40 || (k.at !== undefined && !inR(k.at, 0, sceneLen)) || (k.style !== undefined && !(k.style in COMP_TITLE)) || Object.keys(k).some((x) => !["text", "at", "style"].includes(x))) bad("タイトル文字を確認してください"); }
}
export function checkGlobalComp(g: any, nAssets?: number) {
  if (g === undefined) return;
  const bad = (m: string) => { throw new Error(m); };
  if (!g || typeof g !== "object" || Object.keys(g).some((k) => !["colors", "halftone", "vignette", "grade", "particles", "endFade", "shade", "camera", "backdrop"].includes(k))) bad("合成の全体設定を確認してください");
  if (g.backdrop !== undefined) checkBackdrop(g.backdrop, nAssets);
  if (g.camera !== undefined) { const m = g.camera; if (!m || typeof m !== "object" || Object.keys(m).some((k) => !["shakeHz", "punchSec", "ease"].includes(k)) || (m.shakeHz !== undefined && !inR(m.shakeHz, 1, 30)) || (m.punchSec !== undefined && !inR(m.punchSec, 0.05, 1)) || (m.ease !== undefined && !["smooth", "linear"].includes(m.ease))) bad("カメラ設定を確認してください（揺れ1〜30Hz・パンチ0.05〜1秒・smooth/linear）"); }
  if (g.colors !== undefined && (!g.colors || typeof g.colors !== "object" || Object.entries(g.colors).some(([k, v]) => !["red", "teal"].includes(k) || !HEX.test(String(v))))) bad("合成の色は #RRGGBB で指定してください");
  for (const k of ["halftone", "vignette"]) if (g[k] !== undefined && !inR(g[k], 0, 1)) bad("網点・周辺の暗さは0〜1です");
  for (const k of ["particles", "endFade", "shade"]) if (g[k] !== undefined && typeof g[k] !== "boolean") bad("合成の全体設定を確認してください");
  if (g.grade !== undefined) {
    const k = g.grade; if (!k || typeof k !== "object" || !(k.look in COMP_LOOKS) || Object.keys(k).some((x) => !["look", "keep", "base", "lut"].includes(x))) bad("色調（ルック）を確認してください");
    if (k.keep !== undefined && !(Array.isArray(k.keep) && k.keep.length <= 4 && k.keep.every((v: any) => HEX.test(String(v))))) bad("残す色は #RRGGBB で4色までです");
    if (k.base !== undefined && !inR(k.base, 0, 1)) bad("残す彩度は0〜1です");
    if (k.lut !== undefined && !(typeof k.lut === "string" && /^[A-Za-z0-9_\-/.]+\.cube$/.test(k.lut) && !k.lut.includes("..") && !k.lut.startsWith("/"))) bad("LUTファイルはプロジェクト内の .cube を指定してください");
    if (k.look === "cube" && !k.lut) bad("LUTファイルを指定してください");
  }
}
/** grade settings filled with defaults (ink keeps the two comp colours). */
export function gradeOf(data: any): CompGrade | null {
  const g = globalComp(data).grade; if (!g || g.look === "none") return null;
  const c = compColors(data);
  return { look: g.look, keep: g.keep ?? [c.red, c.teal], base: g.base ?? 0.1, lut: g.lut };
}
