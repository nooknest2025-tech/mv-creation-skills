// Per-project reference-asset library (typed roles) + per-shot auto selection.
export type AssetRole = "character_front" | "character_side" | "character_back" | "expression" | "outfit" | "location" | "prop" | "style" | "start_frame" | "end_frame" | "keyframe" | "pose" | "lipsync_face" | "lipsync_audio";
export interface Asset { id: string; role: AssetRole; file: string; shot?: string; at?: number; note?: string; approved?: boolean; generatedBy?: string; prompt?: string }
export interface AssetLib { assets: Asset[] }
export const ROLE_JA: Record<AssetRole, string> = {
  character_front: "キャラ正面", character_side: "キャラ横", character_back: "キャラ背面", expression: "表情", outfit: "衣装", location: "背景・場所", prop: "小道具",
  style: "ルック（色・質感）", start_frame: "開始画", end_frame: "終了画", keyframe: "中間キー画", pose: "ポーズ/ダンス参照", lipsync_face: "口パク用の顔", lipsync_audio: "口パク用の音声",
};
/** priority used when a model accepts fewer refs than we have (higher first). */
const PRIO: Record<AssetRole, number> = { start_frame: 100, end_frame: 95, character_front: 90, lipsync_face: 88, outfit: 70, location: 60, character_side: 55, pose: 50, expression: 45, prop: 40, style: 35, character_back: 30, keyframe: 25, lipsync_audio: 0 };
export interface ShotNeed { shot: string; role?: string; size?: string; performance?: string; usableOnly?: boolean }
/** pick the refs a shot should attach, best first. Only approved assets unless usableOnly=false. */
export function selectRefs(lib: AssetLib, need: ShotNeed): Asset[] {
  const ok = lib.assets.filter((a) => (need.usableOnly === false || a.approved !== false) && (!a.shot || a.shot === need.shot));
  const wide = ["EWS", "WS"].includes(need.size ?? ""), close = ["CU", "ECU", "MCU"].includes(need.size ?? "");
  const pick = ok.filter((a) => {
    if (["start_frame", "end_frame", "keyframe"].includes(a.role)) return a.shot === need.shot;
    if (a.role === "location") return !close || need.role === "cutaway";
    if (a.role === "pose") return need.performance === "dance";
    if (a.role === "lipsync_face" || a.role === "lipsync_audio") return need.performance === "lipsync";
    if (a.role === "expression") return close;
    if (a.role === "character_back" || a.role === "character_side") return wide || need.performance === "dance";
    if (a.role === "prop") return need.role === "insert" || !close;
    return true;
  });
  const bonus = (a: Asset) => (close && a.role === "expression" ? 30 : 0) + (wide && a.role === "location" ? 30 : 0);
  return pick.sort((a, b) => PRIO[b.role] + bonus(b) - (PRIO[a.role] + bonus(a)));
}
/** generation order for missing assets: sheet first, then world, then per-shot frames. */
export const GEN_ORDER: AssetRole[] = ["character_front", "character_side", "character_back", "expression", "outfit", "location", "prop", "style", "start_frame", "end_frame"];
export function missingAssets(lib: AssetLib, shots: { shot: string; needsStart: boolean; needsEnd?: boolean }[], o: { locations?: string[]; props?: string[] } = {}) {
  const has = (r: AssetRole, shot?: string) => lib.assets.some((a) => a.role === r && (!shot || a.shot === shot));
  const out: { role: AssetRole; shot?: string; name?: string }[] = [];
  for (const r of ["character_front", "character_side", "character_back"] as AssetRole[]) if (!has(r)) out.push({ role: r });
  if (!has("location")) for (const n of o.locations ?? ["main location"]) out.push({ role: "location", name: n });
  for (const n of o.props ?? []) if (!lib.assets.some((a) => a.role === "prop" && a.note === n)) out.push({ role: "prop", name: n });
  for (const s of shots) { if (s.needsStart && !has("start_frame", s.shot)) out.push({ role: "start_frame", shot: s.shot }); if (s.needsEnd && !has("end_frame", s.shot)) out.push({ role: "end_frame", shot: s.shot }); }
  return out.sort((a, b) => GEN_ORDER.indexOf(a.role) - GEN_ORDER.indexOf(b.role));
}
