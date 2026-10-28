import { describe, it, expect } from "vitest";
import { CAMERA_MOVES, EFFECT_FX, cameraPose, fxAmount, syncProgress, syncPulse, activeFx } from "../src/render/SceneFx";
import { autoCamFx, resolveCamFx } from "../src/lib/camfx";
const beat = { bpm: 120, phase: 0, beatsPerBar: 4 };
const c = (p: number, extra: any = {}) => ({ p, t: p * 4, t0: 0, dur: 4, beat, seed: 1, W: 1280, ...extra });
describe("camera moves", () => {
  it("has pack + extra + pro groups with Japanese labels", () => {
    const g = new Set(Object.values(CAMERA_MOVES).map(m => m.group));
    expect([...g].sort()).toEqual(["プロ仕様", "基本", "追加"].sort());
    for (const k of ["kb_in", "whip_l", "parallax", "orbit", "dutch", "rack_focus", "dolly_zoom", "handheld", "crash_zoom", "speed_ramp", "roll_drop"]) expect(CAMERA_MOVES[k]).toBeTruthy();
  });
  it("weak < normal < strong and all poses finite", () => {
    for (const id of Object.keys(CAMERA_MOVES)) for (const p of [0, 0.3, 0.7, 1]) {
      const w = cameraPose(id, c(p), "weak"), s = cameraPose(id, c(p), "strong");
      for (const v of [w.s, w.x, w.y, w.r, w.blur, s.s]) expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(w.s - 1)).toBeLessThanOrEqual(Math.abs(s.s - 1) + 1e-9);
    }
  });
  it("beat sync steps progress; off glides", () => {
    expect(syncProgress("off", beat, 1.25, 0, 4)).toBeCloseTo(1.25 / 4);
    expect(syncProgress("beat", beat, 0.49, 0, 4)).toBeCloseTo(1 / 8, 2); // just before the 2nd beat, step 1 complete
    expect(syncPulse("off", beat, 0)).toBe(0);
    expect(syncPulse("bar", beat, 2.0)).toBeCloseTo(1); // bar downbeat at 2s
    expect(syncPulse("bar", beat, 2.5)).toBeLessThan(0.05); // beat 2 of the bar: no hit
  });
});
describe("effects", () => {
  it("basic + 高級 groups", () => {
    const hi = Object.values(EFFECT_FX).filter(f => f.group === "高級").length;
    expect(hi).toBeGreaterThanOrEqual(10);
    for (const k of ["grain", "glitch", "flash", "vignette", "letterbox", "leak", "vhs", "anamorphic", "god_rays", "film_burn", "teal_orange", "glass", "light_sweep"]) expect(EFFECT_FX[k]).toBeTruthy();
  });
  it("sync off = steady amount, on = pulse", () => {
    expect(fxAmount({ id: "flash", amount: "normal", sync: "off" }, 0.3, beat)).toBe(1);
    expect(fxAmount({ id: "flash", amount: "normal", sync: "beat" }, 0.0, beat)).toBeCloseTo(1);
    expect(fxAmount({ id: "flash", amount: "normal", sync: "beat" }, 0.4, beat)).toBeLessThan(0.1);
  });
  it("ranges apply only inside their time", () => {
    const r = [{ id: "flash", start: 10, end: 20 }];
    expect(activeFx([], r, 5)).toHaveLength(0);
    expect(activeFx([{ id: "grain" }], r, 15)).toHaveLength(2);
  });
});
describe("auto direction (all modes)", () => {
  it("calm story glides, chorus rides the beat", () => {
    expect(autoCamFx("verse", "story").camSync).toBe("off");
    expect(autoCamFx("chorus", "dance").camSync).not.toBe("off");
    expect(autoCamFx("verse", "dance").camSync).toBe("beat");
  });
  it("user config wins over auto", () => {
    expect(resolveCamFx({ sections: { chorus: { camSync: "off" } } }, { sectionType: "chorus" }).camSync).toBe("off");
    expect(resolveCamFx(false, { sectionType: "chorus" }).fx).toBeUndefined();
  });
});
