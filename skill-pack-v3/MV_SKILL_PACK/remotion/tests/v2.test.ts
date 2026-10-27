import { describe, expect, it } from "vitest";
import { blinkState, mouthOpen, resolvePuppet, PUPPET_OFF } from "../src/lib/puppet";
import { RAMPS, rampProgress } from "../src/lib/ramp";
import { letterboxPx } from "../src/lib/finish";
import { applyInstruction } from "../src/lib/nl";
import { DEFAULT_CONFIG } from "../src/lib/config";
import { PRESETS } from "../src/lib/presets";
import { recommend, loadModels } from "../scripts/gen";

describe("puppet", () => {
  it("blinks sometimes, briefly, deterministically", () => {
    const xs = Array.from({ length: 30 * 30 }, (_, i) => blinkState("a", i / 30));
    const closed = xs.filter((x) => x > 0).length / xs.length;
    expect(closed).toBeGreaterThan(0.01); expect(closed).toBeLessThan(0.15);
    expect(blinkState("a", 3.3)).toBe(blinkState("a", 3.3));
    expect(xs.every((_, i) => blinkState("a", i / 30, 0) === 0)).toBe(true);
  });
  it("mouth opens only while singing", () => {
    const lines: any = [{ start: 1, end: 2, text: "あいう", chars: [{ ch: "あ", t0: 1, t1: 1.3 }, { ch: "い", t0: 1.3, t1: 1.6 }, { ch: "う", t0: 1.6, t1: 2 }] }];
    expect(mouthOpen(lines, 0.5)).toBe(0);
    expect(Math.max(...[1.1, 1.15, 1.4, 1.7].map((t) => mouthOpen(lines, t)))).toBeGreaterThan(0.3);
    expect(mouthOpen(lines, 3)).toBe(0);
  });
  it("later overrides win", () => {
    const p = resolvePuppet({ ...PUPPET_OFF, blink: 1 }, { mouth: 1 }, { blink: 0 });
    expect(p.blink).toBe(0); expect(p.mouth).toBe(1);
  });
});

describe("speed ramps", () => {
  it.each(RAMPS)("%s is monotone with F(0)=0, F(1)=1", (k) => {
    expect(rampProgress(k, 0)).toBeCloseTo(0, 3); expect(rampProgress(k, 1)).toBeCloseTo(1, 3);
    let prev = -1; for (let u = 0; u <= 1; u += 0.02) { const v = rampProgress(k, u); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
  });
  it("punch is fast then slow", () => expect(rampProgress("punch", 0.3)).toBeGreaterThan(0.5));
});

describe("finish", () => {
  it("letterbox grows with amount and is 0 when off", () => {
    expect(letterboxPx(undefined, 1920, 1080)).toBe(0);
    const a = letterboxPx({ letterbox: 0 } as any, 1920, 1080), b = letterboxPx({ letterbox: 1 } as any, 1920, 1080);
    expect(b).toBeGreaterThan(a); expect(b).toBeGreaterThan(100);
  });
});

describe("Japanese commands v2", () => {
  const run = (t: string) => applyInstruction(structuredClone(DEFAULT_CONFIG), t).cfg as any;
  it("per-shot puppet without switching preset", () => {
    const c = run("S012は口パクなし");
    expect(c.timing.perShot.S012.puppet.mouth).toBe(0); expect(c.preset).toBe(DEFAULT_CONFIG.preset);
  });
  it("visuals / finish / ramps", () => {
    expect(run("TouchDesigner風にして").visuals).toBeTruthy();
    expect(run("シネスコの黒帯を入れて").finish.letterbox).toBeGreaterThan(0);
    expect(JSON.stringify(run("サビはスピードランプ"))).toMatch(/punch|smooth|in|out/);
  });
});

describe("presets differ beyond colour", () => {
  it("each preset has a distinct rhythm/layout/fx signature", () => {
    const sig = Object.values(PRESETS).map((p: any) => JSON.stringify([p.cutBeats ?? p.cuts, p.textY, p.textSize, p.ramps, p.visuals, p.finish, p.puppet]));
    expect(new Set(sig).size).toBe(sig.length);
  });
});

describe("provider-agnostic models", () => {
  it("pollo hero uses pricier model than filler", () => {
    const ms = loadModels();
    const h = recommend({ sectionType: "chorus", move: "push_in" } as any, "story", ms, undefined, "pollo");
    const f = recommend({ sectionType: "verse", move: "push_in" } as any, "story", ms, undefined, "pollo");
    expect(h.model.id).toMatch(/^pollo\//); expect(h.model.id).not.toBe(f.model.id);
    expect(ms.filter((m) => m.id.startsWith("pollo/") && m.verified).every((m) => m.source.startsWith("https://"))).toBe(true);
  });
});
