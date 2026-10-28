/**
 * Editor edits of the motion-graphics layer (文字PV and any project whose editor-input.json carries `mograph`).
 *   data.mograph        the built-in plan from npm run mv (kept unchanged; also in original-source.json)
 *   data.mographEdit    whole-video edit   } MoEdit: off / look / colors / intensity / speed / density / transition
 *   scene.mograph       per-scene edit     } scene wins over whole; unset keys = built-in (pixel-identical)
 * Reset = delete the edit (whole: data.mographEdit, scene: scene.mograph).
 */
import type { MoEdit } from "../render/MoGraph";
import { LOOKS, TRANSITIONS_JA } from "./mograph";
export type { MoEdit };
const isObj = (x: any) => !!x && typeof x === "object" && !Array.isArray(x);
export const hasEdit = (e: any) => isObj(e) && Object.keys(e).some((k) => e[k] !== undefined && !(k === "colors" && (!isObj(e[k]) || !Object.keys(e[k]).length)));
/** merged edit for time t (undefined when nothing is edited -> exactly the built-in layer). */
export function mographEditAt(data: any, t: number): MoEdit | undefined {
  const sc = data?.scenes ?? [];
  let i = sc.findIndex((s: any, k: number) => t >= s.start && t < (sc[k + 1]?.start ?? Infinity)); if (i < 0) i = sc.length - 1;
  const a = hasEdit(data?.mographEdit) ? data.mographEdit : undefined, b = hasEdit(sc[i]?.mograph) ? sc[i].mograph : undefined;
  if (!a && !b) return undefined;
  const out: MoEdit = { ...(a ?? {}), ...(b ?? {}) };
  if (a?.colors || b?.colors) out.colors = { ...(a?.colors ?? {}), ...(b?.colors ?? {}) };
  return out;
}
/** the props the shared mograph renderer needs, built from editor data. */
export const mographProps = (data: any) => ({ mograph: data.mograph, shots: data.mographShots ?? [], beat: data.mographBeat ?? { bpm: data.bpm ?? 120, phase: data.phase ?? 0, beatsPerBar: 4 }, lines: (data.lyrics ?? []).map((l: any) => ({ text: l.text, start: l.start })) });
export const MO_LOOKS = LOOKS;
export const MO_TRANSITIONS = TRANSITIONS_JA;
export const MO_LIMITS = { intensity: [0, 2], speed: [0.25, 3], density: [0, 3] } as const;
/** validation (editor front-end + tests; server.py mirrors it). Returns an error message or "". */
export function checkMoEdit(e: any): string {
  if (e === undefined) return "";
  if (!isObj(e)) return "図形レイヤーの設定を確認してください";
  for (const k of Object.keys(e)) if (!["off", "look", "colors", "intensity", "speed", "density", "transition"].includes(k)) return `図形レイヤーの不明な項目: ${k}`;
  if ("off" in e && typeof e.off !== "boolean") return "図形のオン・オフを確認してください";
  if ("look" in e && !(e.look in LOOKS)) return "図形の種類を確認してください";
  if ("transition" in e && !(e.transition in TRANSITIONS_JA)) return "転換の種類を確認してください";
  if ("colors" in e && (!isObj(e.colors) || Object.entries(e.colors).some(([k, v]) => !["bg", "fg", "accent", "sub"].includes(k) || !/^#[0-9a-fA-F]{6}$/.test(String(v))))) return "図形の色は #RRGGBB で指定してください";
  for (const [k, [lo, hi]] of Object.entries(MO_LIMITS)) if (k in e && !(typeof e[k] === "number" && e[k] >= lo && e[k] <= hi)) return `図形の${({ intensity: "強さ", speed: "動きの速さ", density: "量" } as any)[k]}は${lo}〜${hi}です`;
  return "";
}
