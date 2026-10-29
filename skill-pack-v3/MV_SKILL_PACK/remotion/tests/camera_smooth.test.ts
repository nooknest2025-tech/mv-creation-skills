// Smooth camera (no per-frame random shake, eased punch/zoom), panels that always cover their box, lyric outline, black-area QC.
import { describe, expect, it } from "vitest";
import { checkGlobalComp, coverScale, cameraOf } from "../src/lib/compose";
import { noise1 } from "../src/render/Compose";
import { effectFilter } from "../src/lib/lyricEdits";
import { blackFraction, impactWindows, isIntentional } from "../src/lib/blackqc";

describe("smooth camera", () => {
  it("shake noise is continuous: tiny steps between neighbouring frames", () => {
    let maxStep = 0;
    for (let f = 0; f < 300; f++) maxStep = Math.max(maxStep, Math.abs(noise1("s", ((f + 1) / 30) * 7) - noise1("s", (f / 30) * 7)));
    expect(maxStep).toBeLessThan(0.6); // white noise would jump up to 2
    for (let f = 0; f < 100; f++) expect(Math.abs(noise1("s", f / 7))).toBeLessThanOrEqual(1);
  });
  it("camera defaults and validation", () => {
    expect(cameraOf({})).toEqual({ shakeHz: 7, punchSec: 0.22, ease: "smooth" });
    expect(cameraOf({ comp: { camera: { ease: "linear" } } }).ease).toBe("linear");
    expect(() => checkGlobalComp({ camera: { shakeHz: 7, punchSec: 0.2, ease: "smooth" }, backdrop: "footage" })).not.toThrow();
    expect(() => checkGlobalComp({ camera: { shakeHz: 0 } })).toThrow();
    expect(() => checkGlobalComp({ camera: { jitter: 1 } })).toThrow();
    expect(() => checkGlobalComp({ backdrop: "white" })).toThrow();
  });
});
describe("panels cover their box", () => {
  it("centred, unrotated panel needs no zoom", () => expect(coverScale(50, 50, 0, 0, 16 / 9)).toBeCloseTo(1));
  it("off-centre origin and rotation need more zoom", () => {
    expect(coverScale(50, 35, 0, 0, 16 / 9)).toBeCloseTo(50 / 35);
    expect(coverScale(50, 50, 0, 8, 16 / 9)).toBeGreaterThan(1.2);
  });
});
describe("lyric outline", () => {
  it("outline = ring in the stroke colour + drop shadow", () => {
    const f = effectFilter("outline", 6, "#000000")!;
    expect(f.match(/drop-shadow/g)!.length).toBe(9);
    expect(f).toContain("#000000");
  });
});
describe("black-area QC", () => {
  it("flat black counts, dark texture does not", () => {
    const W = 64, H = 64, g = new Uint8Array(W * H);
    expect(blackFraction(g, W, H)).toBe(1);
    for (let i = 0; i < g.length; i++) g[i] = (i * 37) % 23; // dark but textured
    expect(blackFraction(g, W, H)).toBe(0);
  });
  it("impact fx windows are allowed", () => {
    const w = impactWindows({ fps: 30, scenes: [{ start: 2, comp: { fx: [{ t: 0.5, d: 0.05, type: "white" }] } }] });
    expect(isIntentional(2.52, w)).toBe(true); expect(isIntentional(3, w)).toBe(false);
  });
});
