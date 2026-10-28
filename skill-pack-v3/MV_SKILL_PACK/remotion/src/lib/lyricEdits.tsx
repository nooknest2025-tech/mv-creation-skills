import React from "react";
/**
 * Pack-wide rule (v6.5): every renderer has a built-in default look, and the editor's per-line / per-scene edits always win.
 * "Edited" = differs from the project's original-source.json (what the generator wrote). Editor defaults never count as edits.
 * The result is stored on the line as `edited: string[]` (and on scenes as `edited`), recomputed by the editor front-end and by server.py on save/export.
 */
export const LYRIC_EDIT_KEYS = ["motion", "params", "font", "fill", "stroke", "accent", "scale", "y", "position", "angle", "effect", "effectOffset", "motionDuration", "entrance", "departure", "transitionDuration", "stageStyle"] as const;
export const SCENE_EDIT_KEYS = ["stage", "camera", "cameraMove", "cameraStrength", "cameraSync", "zoom", "x", "y"] as const;
/** stage-native lyric styles a custom stage offers per line (editor: 「ステージの文字スタイル」). */
export const STAGE_STYLES: Record<string, string> = { auto: "おまかせ（元の見た目）", tate: "縦書き吹き出し", bigBehind: "後ろに大きく", band: "下の帯", pop: "ポップ（強調語を大きく）", ghost: "斜めの半透明", center: "中央の縦書き" };
const same = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const baseOf = (x: any, byId: Map<string, any>) => byId.get(x.id) ?? byId.get(x.sourceParts?.[0]?.line);
export function editedKeys(x: any, base: any, keys: readonly string[]): string[] {
  if (!base) return [];
  return keys.filter((k) => k in x || k in base).filter((k) => !same(x[k], base[k]) && !(k === "stageStyle" && (x[k] ?? "auto") === (base[k] ?? "auto")));
}
/** sets / clears `edited` on every lyric and scene of `data` by comparing with the original source. Mutates and returns data. */
export function markEdited(data: any, orig: any) {
  if (!data || !orig) return data;
  const L = new Map<string, any>((orig.lyrics ?? []).map((l: any) => [l.id, l])), S = new Map<string, any>((orig.scenes ?? []).map((s: any) => [s.id, s]));
  for (const l of data.lyrics ?? []) { const e = editedKeys(l, baseOf(l, L), LYRIC_EDIT_KEYS); if (e.length) l.edited = e; else delete l.edited; }
  if (data.stage && typeof data.stage === "object" && Object.keys(data.stage).length && !orig.stage) data.editedStage = true; else delete data.editedStage;
  for (const s of data.scenes ?? []) { const e = editedKeys(s, S.get(s.id), SCENE_EDIT_KEYS); if (e.length) s.edited = e; else delete s.edited; }
  return data;
}
export const isEdited = (x: any, ...keys: string[]) => Array.isArray(x?.edited) && (keys.length ? keys.some((k) => x.edited.includes(k)) : x.edited.length > 0);
/** the line picked a motion sample (モーションの見本 / bulk apply) -> draw it with the editor's normal motion renderer. */
export const wantsEditorMotion = (l: any) => isEdited(l, "motion", "params", "motionDuration");
/** entrance / departure (入り方・消え方), shared by the editor lyric layer and custom stages. */
export function combined(el: React.ReactNode, l: any, t: number, cx: number, cy: number, W: number, H: number) {
  const enter = l.entrance ?? "none", exit = l.departure ?? "none", duration = Math.max(0.05, Math.min(l.transitionDuration ?? 0.7, (l.end - l.start) / 2));
  const p = Math.max(0, Math.min(1, (t - l.start) / duration)), q = Math.max(0, Math.min(1, (t - (l.end - duration)) / duration));
  const kind = p < 1 && enter !== "none" ? enter : q > 0 && exit !== "none" ? exit : "none";
  if (kind === "none") return el;
  const amount = p < 1 && enter !== "none" ? Math.pow(1 - p, 3) : q * q;
  if (kind === "fade") return <div style={{ position: "absolute", inset: 0, opacity: 1 - amount }}>{el}</div>;
  return <>{[-1, 1].map((sign) => <div key={sign} style={{ position: "absolute", inset: 0, transform: `translate(${kind === "lr" ? sign * W * 0.42 * amount : 0}px,${kind === "tb" ? sign * H * 0.42 * amount : 0}px)`, opacity: 1 - amount * 0.8 }}><div style={{ position: "absolute", inset: 0, clipPath: kind === "lr" ? (sign < 0 ? `inset(0 ${W - cx}px 0 0)` : `inset(0 0 0 ${cx}px)`) : (sign < 0 ? `inset(0 0 ${H - cy}px 0)` : `inset(${cy}px 0 0 0)`) }}>{el}</div></div>)}</>;
}
export const effectFilter = (effect: string, offset = 6) => effect === "shadow" ? `drop-shadow(${offset}px ${offset}px 3px #101310)` : effect === "glow" ? `drop-shadow(0 0 ${offset + 2}px #f4dfb0) drop-shadow(0 0 ${offset * 2 + 3}px #e6aa96)` : undefined;
export const POSITION_XY: Record<string, [number, number]> = { tl: [0.2, 0.18], tc: [0.5, 0.18], tr: [0.8, 0.18], ml: [0.2, 0.5], mc: [0.5, 0.5], mr: [0.8, 0.5], bl: [0.2, 0.84], bc: [0.5, 0.84], br: [0.8, 0.84] };
