// qc:black catches an empty black コマ even when the whole-frame black share is small.
import { describe, expect, it } from "vitest";
import { blackCellMax, blackFraction } from "../src/lib/blackqc";
describe("blackCellMax", () => {
  it("flags a black box in one corner cell", () => {
    const W = 160, H = 96, g = new Uint8Array(W * H);
    for (let i = 0; i < g.length; i++) g[i] = 60 + ((i * 7919) % 50); // textured picture
    for (let y = 0; y < 24; y++) for (let x = 0; x < 40; x++) g[y * W + x] = 0; // empty corner コマ (1/16 of the frame)
    expect(blackFraction(g, W, H)).toBeLessThan(0.08);
    expect(blackCellMax(g, W, H)).toBeGreaterThan(0.9);
  });
  it("dark but textured artwork is not empty", () => {
    const W = 160, H = 96, g = new Uint8Array(W * H); for (let i = 0; i < g.length; i++) g[i] = (i * 31) % 14;
    expect(blackCellMax(g, W, H)).toBe(0);
  });
});
