import { describe, expect, it } from "vitest";
import { ASPECTS_WH, sample } from "./harness";
import { CATALOG, canonicalStyle } from "../../src/lib/catalog";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyInstruction } from "../../src/lib/nl";

describe("style echo_layers", () => {
  it("is registered", () => { expect(CATALOG.echo_layers).toBeTruthy(); expect(canonicalStyle("echo_layers")).toBe("echo_layers"); });
  it.each(ASPECTS_WH)("stays inside the frame at %ix%i and has no NaN", (W, H) => {
    for (const s of sample("echo_layers", W, H)) {
      for (const b of s.boxes) { expect(b.every(Number.isFinite)).toBe(true); expect(b[0]).toBeGreaterThan(-W * 0.02); expect(b[2]).toBeLessThan(W * 1.02); expect(b[1]).toBeGreaterThan(-H * 0.02); expect(b[3]).toBeLessThan(H * 1.02); }
    }
  });
  it("is hidden before the line and visible while sung", () => {
    const [before, , mid] = sample("echo_layers", 1920, 1080, [0.2, 1.2, 2.2]);
    expect(mid.boxes.length).toBeGreaterThan(0);
    const markup = (el: React.ReactNode) => renderToStaticMarkup(React.createElement(React.Fragment, null, el));
    expect(markup(before.out.el)).not.toContain("光");
    expect((markup(mid.out.el).match(/光/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(markup(mid.out.el)).toContain("--lyric-accent");
  });
  it("recognises the Japanese name", () => expect(JSON.stringify(applyInstruction({}, "サビは文字の輪郭レイヤーで").cfg)).toContain("echo_layers"));
});
