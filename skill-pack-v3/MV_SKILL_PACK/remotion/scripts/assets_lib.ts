// Project asset library IO, missing-asset image generation plan, Japanese commands.
import { fs, path } from "./common";
import { GEN_ORDER, ROLE_JA, missingAssets, type Asset, type AssetLib, type AssetRole } from "../src/lib/assets";

export const assetsDir = (dir: string) => path.join(dir, "assets");
export function loadLib(dir: string): AssetLib { const f = path.join(assetsDir(dir), "assets.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { assets: [] }; }
export function saveLib(dir: string, lib: AssetLib) { fs.mkdirSync(assetsDir(dir), { recursive: true }); fs.writeFileSync(path.join(assetsDir(dir), "assets.json"), JSON.stringify(lib, null, 2)); }

/** copy a file into the PROJECT asset folder (never into the user's own folders) and register it. */
export function addAsset(dir: string, file: string, role: AssetRole, o: { shot?: string; note?: string; approved?: boolean; generatedBy?: string; prompt?: string } = {}): Asset {
  if (!ROLE_JA[role]) throw new Error(`unknown role ${role}`);
  const lib = loadLib(dir), ext = path.extname(file) || ".png";
  const id = `${role}${o.shot ? "_" + o.shot : ""}_${lib.assets.length + 1}`;
  const dst = path.join(assetsDir(dir), id + ext);
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(file, dst);
  // replacing a per-shot frame: older one for the same shot+role is retired
  if (o.shot && /frame/.test(role)) lib.assets = lib.assets.filter((a) => !(a.role === role && a.shot === o.shot));
  const a: Asset = { id, role, file: path.relative(dir, dst), shot: o.shot, note: o.note, approved: o.approved ?? !o.generatedBy, generatedBy: o.generatedBy, prompt: o.prompt };
  lib.assets.push(a); saveLib(dir, lib); return a;
}
export function setApproval(dir: string, id: string, ok: boolean) { const lib = loadLib(dir); const a = lib.assets.find((x) => x.id === id); if (!a) throw new Error(`asset ${id} not found`); a.approved = ok; saveLib(dir, lib); return a; }

const ROLE_PROMPT: Partial<Record<AssetRole, string>> = {
  character_front: "character reference sheet, full body, front view, neutral pose, neutral expression, even soft lighting, plain light-grey background",
  character_side: "same character, full body, side profile view, neutral pose, even lighting, plain light-grey background",
  character_back: "same character, full body, back view, even lighting, plain light-grey background",
  expression: "same character, head-and-shoulders expression sheet: smile, sad, singing, surprised",
  location: "establishing view of the location, no people, cinematic, {palette}",
  prop: "single prop on a plain background, product-style lighting",
  start_frame: "first frame of the shot: {spec}",
  end_frame: "last frame of the shot: {spec}",
};
export interface ImageTask { role: AssetRole; shot?: string; name?: string; prompt: string; refs: string[]; model: string; usd: number | null; save_to: string }
/** ordered image tasks (sheet -> world -> frames), each later step references the approved sheet. */
export function planImages(dir: string, lib: AssetLib, need: Parameters<typeof missingAssets>[1], o: { model: any; character?: string; wardrobe?: string; specs?: Record<string, string>; palette?: string; locations?: string[]; props?: string[] }): { tasks: ImageTask[]; total: number | null } {
  const miss = missingAssets(lib, need, o);
  const sheet = lib.assets.filter((a) => a.role === "character_front" && a.approved).map((a) => a.file);
  const tasks = miss.map((m) => {
    const base = (ROLE_PROMPT[m.role] ?? m.role).replace("{palette}", o.palette ?? "").replace("{spec}", (m.shot && o.specs?.[m.shot]) ?? "");
    const who = /character|expression|frame/.test(m.role) ? `${o.character ?? "the singer"}${o.wardrobe ? `, wearing ${o.wardrobe}` : ""}, ` : "";
    const refs = m.role === "character_front" ? [] : /character|expression|frame/.test(m.role) ? (sheet.length ? sheet : ["<character_front をこの後で承認>"]) : [];
    return { role: m.role, shot: m.shot, name: m.name, prompt: `${who}${m.name ? m.name + ", " : ""}${base}. no text, no watermark`, refs, model: o.model.id, usd: o.model.price_per_image ?? null, save_to: path.join(assetsDir(dir), "incoming") };
  });
  const total = tasks.some((t) => t.usd == null) ? null : +tasks.reduce((a, t) => a + (t.usd ?? 0), 0).toFixed(3);
  return { tasks, total };
}

/** Japanese natural commands → actions. */
export type AssetCmd = { kind: "make_sheet" } | { kind: "make_bg" } | { kind: "make_frames"; shots?: string[] } | { kind: "replace"; shot: string; role: "start_frame" | "end_frame" } | { kind: "approve"; id?: string; all?: boolean } | { kind: "list" };
export function parseAssetCmd(s: string): AssetCmd | null {
  const t = s.normalize("NFKC"), shot = t.match(/S\s*0*(\d{1,3})/i), sid = shot ? "S" + shot[1].padStart(3, "0") : undefined;
  if (/(差し替|入れ替|変え|替え)/.test(t) && sid) return { kind: "replace", shot: sid, role: /(終了|終わり|ラスト|最後)/.test(t) ? "end_frame" : "start_frame" };
  if (/キャラ(クター)?(シート|設定|表)/.test(t)) return { kind: "make_sheet" };
  if (/(背景|ロケ|場所|小道具)/.test(t) && /(作|生成)/.test(t)) return { kind: "make_bg" };
  if (/(開始画|始まり|最初のフレーム|終了画|スタートフレーム)/.test(t) && /(作|生成)/.test(t)) return { kind: "make_frames", shots: sid ? [sid] : undefined };
  if (/(承認|OK|オーケー|採用)/i.test(t)) return { kind: "approve", all: /(全部|すべて|全て)/.test(t) };
  if (/(素材|参照|アセット).*(一覧|見せ|確認)/.test(t)) return { kind: "list" };
  return null;
}
export const ORDER_JA = GEN_ORDER.map((r) => ROLE_JA[r]).join(" → ");
