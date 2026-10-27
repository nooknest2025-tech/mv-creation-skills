// Auto-direction for camera strength / beat sync / effects per shot — generic for every show mode
// (story, lip-sync, dance, text PV, mograph, combos; stills or video clips). Calm sections glide (sync off),
// choruses ride the beat. User settings (mv.config.json "camfx" / timing.perShot) always win.
import type { FxUse, Strength, Sync } from "../render/SceneFx";
export interface CamFx { camStrength?: Strength; camSync?: Sync; fx?: FxUse[]; move?: string }
export interface CamFxCfg { off?: boolean; sections?: Record<string, CamFx>; ranges?: (FxUse & { start: number; end: number })[] }

export function autoCamFx(sectionType: string | undefined, role?: string, kind?: string): CamFx {
  const st = sectionType ?? "other", r = role ?? "";
  const calm = ["intro", "verse", "outro", "other", "bridge"].includes(st);
  if (st === "chorus") return { camStrength: "normal", camSync: r === "story" || r === "lipsync" ? "bar" : "beat2", fx: [{ id: "bloom", amount: "weak", sync: "off" }, { id: "flash", amount: "weak", sync: "bar" }] };
  if (st === "pre_chorus" || st === "prechorus") return { camStrength: "weak", camSync: "off", fx: [{ id: "halation", amount: "weak", sync: "off" }] };
  if (r === "dance") return { camStrength: "normal", camSync: "beat", fx: [{ id: "film_look", amount: "weak", sync: "off" }] };
  if (calm && (r === "story" || r === "flashback")) return { camStrength: "weak", camSync: "off", fx: [{ id: "halation", amount: "weak", sync: "off" }, { id: "film_look", amount: "weak", sync: "off" }] };
  return { camStrength: "weak", camSync: "off", fx: kind === "video" ? [] : [{ id: "film_look", amount: "weak", sync: "off" }] };
}
/** merge auto < per-section config < per-shot edit. */
export function resolveCamFx(cfg: CamFxCfg | false | undefined, shot: { section?: string; sectionType?: string; role?: string; kind?: string }, perShot?: CamFx): CamFx {
  if (cfg === false || cfg?.off) return { ...(perShot ?? {}) };
  const a = autoCamFx(shot.sectionType, shot.role, shot.kind);
  const sec = cfg?.sections?.[shot.section ?? ""] ?? cfg?.sections?.[shot.sectionType ?? ""] ?? cfg?.sections?.all ?? {};
  return { ...a, ...sec, ...(perShot ?? {}) };
}
