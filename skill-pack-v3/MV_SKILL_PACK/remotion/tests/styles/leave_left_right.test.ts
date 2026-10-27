import { describe, expect, it } from "vitest";
import { ASPECTS_WH, sample } from "./harness";
import { CATALOG, canonicalStyle } from "../../src/lib/catalog";

describe("style leave_left_right", () => {
  it("is registered", () => { expect(CATALOG.leave_left_right).toBeTruthy(); expect(canonicalStyle("leave_left_right")).toBe("leave_left_right"); });
  it.each(ASPECTS_WH)("stays inside the frame at %ix%i and has no NaN", (W, H) => {
    for (const s of sample("leave_left_right", W, H)) {
      for (const b of s.boxes) { expect(b.every(Number.isFinite)).toBe(true); expect(b[0]).toBeGreaterThan(-W * 0.02); expect(b[2]).toBeLessThan(W * 1.02); expect(b[1]).toBeGreaterThan(-H * 0.02); expect(b[3]).toBeLessThan(H * 1.02); }
    }
  });
  it("is hidden before the line and visible while sung", () => {
    const [before, , mid] = sample("leave_left_right", 1920, 1080, [0.2, 1.2, 2.2]);
    expect(mid.boxes.length).toBeGreaterThan(0);
    expect(before.out.el).toBeTruthy();
  });
});
