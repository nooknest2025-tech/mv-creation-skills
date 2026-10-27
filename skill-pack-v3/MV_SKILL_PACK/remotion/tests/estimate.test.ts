// Pre-generation cost estimate: math, subscription credits, unverified handling, confirm/cancel.
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs"; import path from "node:path"; import YAML from "yaml";
import { estimate, estimateMd, confirmRun, creditsFor, parsePlanTier, providerOf, type PlansFile } from "../src/lib/estimate";
import { applyInstruction } from "../src/lib/nl";
import { plansJson } from "../scripts/plans_sync";

const MODELS = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/models.yaml"), "utf8")).models;
const PF: PlansFile = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/plans.yaml"), "utf8"));

describe("API pay-as-you-go math", () => {
  it("per shot = price × snapped seconds × takes; images added", () => {
    const e = estimate([{ shot: "S1", model: "grok-imagine-video-1.5", seconds: 5, res: "720p", takes: 2 }, { shot: "S2", model: "MiniMax-Hailuo-2.3", seconds: 4, res: "720p", takes: 1 }], MODELS, PF, {}, [{ count: 3, model: "grok-imagine-image", usd_each: 0.02 }]);
    expect(e.lines[0].usd).toBeCloseTo(0.14 * 5 * 2); // $1.40
    expect(e.lines[1].sec).toBe(6); expect(e.lines[1].snapped).toBe(true); expect(e.lines[1].usd).toBeCloseTo(0.0467 * 6, 3);
    expect(e.images[0].usd).toBeCloseTo(0.06); expect(e.usdTotal).toBeCloseTo(1.4 + 0.28 + 0.06, 2);
    expect(e.clips).toBe(3); expect(e.complete).toBe(true);
  });
  it("1080p uses its own tier, not a guess", () => { const e = estimate([{ shot: "S1", model: "kling-3.0", seconds: 5, res: "1080p", takes: 1 }], MODELS, PF); expect(e.lines[0].usd).toBeCloseTo(0.56); });
});

describe("subscription credits", () => {
  it("Kling Pro: credits used / remaining after", () => {
    const e = estimate([{ shot: "S1", model: "kling-3.0", seconds: 5, res: "1080p", takes: 2, audio: true }], MODELS, PF, { kling: "pro" });
    expect(e.lines[0].mode).toBe("plan"); expect(e.lines[0].credits).toBe(120);
    expect(e.credits.kling).toMatchObject({ used: 120, included: 3000, remaining: 3000, after: 2880, overCredits: 0 });
    expect(e.usdTotal).toBe(0); expect(estimateMd(e)).toMatch(/実行後 2880/);
  });
  it("remaining from config + overage with known unit price (Hailuo $1=70)", () => {
    const e = estimate([{ shot: "S1", model: "MiniMax-Hailuo-2.3", seconds: 6, res: "768p", takes: 4 }], MODELS, PF, { minimax: { plan: "standard", remaining: 50 } });
    expect(e.credits.minimax.used).toBe(100); expect(e.credits.minimax.after).toBe(-50); expect(e.credits.minimax.overUsd).toBeCloseTo(0.71, 2);
    expect(e.credits.minimax.verified).toBe(false); // per-clip credits are third-party only
  });
  it("overage with unknown unit price is flagged, not invented", () => {
    const e = estimate([{ shot: "S1", model: "runway/gen4.5", seconds: 10, res: "720p", takes: 6 }], MODELS, PF, { runway: "standard" });
    expect(e.credits.runway.used).toBe(720); expect(e.credits.runway.overUsd).toBeNull(); expect(e.unknown.some((u) => /不足/.test(u.why))).toBe(true);
  });
  it("Luma per-clip credits pick the next clip length", () => { expect(creditsFor(PF.providers.luma, "luma/ray-3.2", "720p", 7).credits).toBe(300); });
  it("unknown plan name is reported", () => { const e = estimate([{ shot: "S1", model: "kling-3.0", seconds: 5, res: "720p", takes: 1 }], MODELS, PF, { kling: "gold" }); expect(e.unknown[0].why).toMatch(/gold/); });
  it("api setting forces pay-as-you-go", () => expect(estimate([{ shot: "S1", model: "kling-3.0", seconds: 5, res: "720p", takes: 1 }], MODELS, PF, { kling: "api" }).lines[0].mode).toBe("api"));
  it("provider mapping", () => { expect(providerOf(PF, "runway/gen4.5")).toBe("runway"); expect(providerOf(PF, "wan2.6-t2v")).toBeNull(); });
});

describe("unverified handling", () => {
  it("unverified price -> 未確認, excluded from total, incomplete", () => {
    const e = estimate([{ shot: "S1", model: "seedance-2.0", seconds: 5, res: "720p", takes: 1 }, { shot: "S2", model: "grok-imagine-video-1.5-lite", seconds: 5, res: "720p", takes: 1 }], MODELS, PF);
    expect(e.lines[0].usd).toBeNull(); expect(e.usdTotal).toBeCloseTo(0.15); expect(e.complete).toBe(false); expect(estimateMd(e)).toMatch(/未確認/);
  });
  it("deprecated model flagged", () => expect(estimate([{ shot: "S1", model: "sora-2", seconds: 4, res: "720p", takes: 1 }], MODELS, PF).unknown[0].why).toMatch(/終了/));
  it("unpriced image model flagged", () => expect(estimate([], MODELS, PF, {}, [{ count: 2, model: "flux", usd_each: null }]).unknown[0].why).toMatch(/flux/));
  it("every plan table has a source + date; unverified plans marked", () => { for (const [k, p] of Object.entries(PF.providers)) { expect(p.source, k).toMatch(/^https/); expect(p.verified_at, k).toBeTruthy(); } expect(PF.providers.pollo.plans.lite.verified).toBe(false); });
  it("plans.gen.json is in sync with plans.yaml", () => expect(fs.readFileSync(path.join(__dirname, "../src/lib/plans.gen.json"), "utf8")).toBe(plansJson()));
});

describe("confirm / cancel", () => {
  const ok = estimate([{ shot: "S1", model: "grok-imagine-video-1.5-lite", seconds: 5, res: "720p", takes: 1 }], MODELS, PF);
  it("interactive N cancels (no run)", async () => { const ask = vi.fn(async () => "n"); const r = await confirmRun(ok, { interactive: true, ask }); expect(r.go).toBe(false); expect(r.reason).toMatch(/キャンセル/); expect(ask).toHaveBeenCalledOnce(); });
  it("interactive empty answer = cancel (default N)", async () => expect((await confirmRun(ok, { interactive: true, ask: async () => "" })).go).toBe(false));
  it("interactive y runs", async () => expect((await confirmRun(ok, { interactive: true, ask: async () => "y" })).go).toBe(true));
  it("non-interactive needs exact --confirm", async () => {
    expect((await confirmRun(ok, { interactive: false })).go).toBe(false);
    expect((await confirmRun(ok, { interactive: false, confirm: 0.1 })).go).toBe(false);
    expect((await confirmRun(ok, { interactive: false, confirm: ok.usdTotal })).go).toBe(true);
  });
  it("cap and unverified API price block before asking", async () => {
    const ask = vi.fn(async () => "y");
    expect((await confirmRun(ok, { interactive: true, ask, cap: 0.01 })).go).toBe(false);
    const bad = estimate([{ shot: "S1", model: "seedance-2.0", seconds: 5, res: "720p", takes: 1 }], MODELS, PF);
    expect((await confirmRun(bad, { interactive: true, ask })).go).toBe(false); expect(ask).not.toHaveBeenCalled();
  });
});

describe("Japanese plan tier", () => {
  it("parses", () => {
    expect(parsePlanTier("KlingはProプラン", PF)).toEqual({ provider: "kling", plan: "pro", remaining: undefined });
    expect(parsePlanTier("RunwayはAPI", PF)).toEqual({ provider: "runway", plan: "api" });
    expect(parsePlanTier("Klingの残り1,200クレジット", PF)?.remaining).toBe(1200);
    expect(parsePlanTier("HailuoはMasterプラン", PF)?.plan).toBe("master");
  });
  it("applyInstruction writes gen.plans", () => {
    let r = applyInstruction({}, "KlingはProプラン"); expect(r.cfg.gen?.plans?.kling).toBe("pro");
    r = applyInstruction(r.cfg, "Klingの残り800クレジット"); expect(r.cfg.gen?.plans?.kling).toEqual({ plan: "pro", remaining: 800 });
  });
});
