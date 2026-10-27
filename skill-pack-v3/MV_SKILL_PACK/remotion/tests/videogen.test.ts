// Pro video generation: shot specs, shot-list critic, per-model adapters, ref packing, recommender, assets, JP commands, clip QA.
import { describe, expect, it } from "vitest";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { buildSpecs, reviewShotList, proseOf, NEGATIVES_BASE } from "../src/lib/shotprompt";
import { adapt, packRefs, recommendModel, snapDuration, CAPS } from "../src/lib/videoModels";
import { selectRefs, missingAssets, type Asset } from "../src/lib/assets";
import { parseAssetCmd, planImages, addAsset, loadLib, setApproval } from "../scripts/assets_lib";
import type { Shot } from "../src/lib/types";

const MODELS = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/models.yaml"), "utf8")).models;
const M = (id: string) => MODELS.find((m: any) => m.id === id);
const shot = (id: string, sec: string, t: any, move: string, role?: string, a = 0, b = 2.5): Shot => ({ id, start: a, end: b, src: "", kind: "image", move, section: sec, sectionType: t, role });
const SHOTS: Shot[] = [shot("S001", "intro", "intro", "kb_in"), shot("S002", "verse1", "verse", "kb_in", undefined, 2.5, 5), shot("S003", "verse1", "verse", "kb_in", undefined, 5, 7.5), shot("S004", "verse1", "verse", "slow_push", undefined, 7.5, 10),
  shot("S005", "chorus1", "chorus", "face_push", "lipsync", 10, 12), { ...shot("S006", "chorus1", "chorus", "whip_l", "dance", 12, 14) }, { ...shot("S007", "chorus1", "chorus", "push", undefined, 14, 16), z0: 1.2 }];
const A = (role: any, shot?: string, approved = true): Asset => ({ id: role + (shot ?? ""), role, file: `assets/${role}${shot ?? ""}.png`, shot, approved });

describe("shot spec builder", () => {
  const specs = buildSpecs(SHOTS, { subject: "a young singer", continuity: { wardrobe: "red jacket", location: "rooftop" }, bpm: 120 });
  it("has every cinematographer field + colour script per section", () => {
    const s = specs[4];
    expect(s.size).toMatch(/CU/); expect(s.lens).toMatch(/mm/); expect(s.move.motivation).toBeTruthy(); expect(s.performance).toBe("lipsync");
    expect(s.palette).toContain("electric cyan"); expect(specs[1].palette).not.toEqual(s.palette);
    expect(s.composition).toMatch(/negative space at the bottom/); expect(s.negatives).toContain("extra fingers"); expect(s.negatives).toContain("out-of-sync lips");
    expect(proseOf(s)).toMatch(/red jacket/); expect(proseOf(s)).toMatch(/rooftop/);
  });
  it("beat-matched duration + match cuts", () => { expect(specs[0].beatSec % 0.5).toBeCloseTo(0); expect(specs[5].matchCutTo).toBe("S007"); expect(specs[6].startFrame).toBeTruthy(); });
  it("dance negatives", () => expect(specs[5].negatives).toContain("sliding feet"));
});

describe("shot-list critic", () => {
  it("fixes repeated moves/sizes, keeps locks as suggestions", () => {
    const specs = buildSpecs(SHOTS, {});
    const r = reviewShotList(specs, new Set(["S003"]));
    expect(r.issues.some((i) => i.rule === "same-move")).toBe(true);
    const lockedIssue = r.issues.find((i) => i.at === "S003"); if (lockedIssue) expect(lockedIssue.fixed).toBe(false);
    for (let i = 1; i < specs.length; i++) if (specs[i].shot !== "S003" && specs[i - 1].shot !== "S003") expect(specs[i].move.mm === specs[i - 1].move.mm && specs[i].move.mm !== "static").toBe(false);
  });
});

describe("per-model adapters", () => {
  const sp = buildSpecs(SHOTS, { bpm: 120 })[1];
  it("MiniMax uses bracket camera commands and snaps to 6/10s", () => {
    const r = adapt(sp, M("MiniMax-Hailuo-2.3")); expect(r.prompt.startsWith("[Push in]")).toBe(true); expect([6, 10]).toContain(r.seconds); expect(r.params.prompt_optimizer).toBe(false);
  });
  it("Wan puts negatives in negative_prompt (<=500) and respects 1500 chars", () => {
    const r = adapt(sp, M("wan2.6-t2v")); expect(r.negative_prompt).toMatch(/morphing/); expect(r.negative_prompt!.length).toBeLessThanOrEqual(500); expect(r.prompt.length).toBeLessThanOrEqual(1500); expect(r.prompt).not.toMatch(/Avoid:/);
  });
  it("Runway i2v writes motion only", () => { const r = adapt(sp, M("runway/gen4_turbo"), [A("start_frame", "S002")]); expect(r.prompt).not.toMatch(/color palette/); expect(r.refs.first).toBeTruthy(); });
  it("Grok inlines negatives and tags refs <IMAGE_n>", () => { const r = adapt(sp, M("grok-imagine-video-1.5"), [A("character_front"), A("outfit")]); expect(r.prompt).toMatch(/<IMAGE_0>/); expect(r.prompt).toMatch(/Avoid:/); });
  it("unverified models warn", () => expect(adapt(sp, M("seedance-2.0")).warnings.join()).toMatch(/未確認/));
  it("snapDuration", () => { expect(snapDuration(7, { allowed_durations: [5, 8] })).toBe(8); expect(snapDuration(20, { durations: [2, 15] })).toBe(15); expect(snapDuration(0.3, { durations: [4, 15] })).toBe(4); });
});

describe("reference packing + downgrade", () => {
  const sheet = [A("character_front"), A("character_side"), A("outfit"), A("location"), A("prop"), A("style"), A("expression"), A("pose"), A("character_back")];
  it("Grok 1.5 takes up to 14 refs + first/last", () => { const p = packRefs("grok-imagine-video-1.5", [A("start_frame", "S1"), A("end_frame", "S1"), ...sheet]); expect(p.first && p.last).toBeTruthy(); expect(p.refs.length).toBe(9); });
  it("Kling caps images+elements at 7 and no refs with end frame", () => { const p = packRefs("kling-3.0", sheet); expect(p.refs.length).toBe(7); const q = packRefs("kling-3.0", [A("start_frame", "S1"), A("end_frame", "S1"), ...sheet]); expect(q.last).toBeTruthy(); expect(q.refs.length).toBe(0); });
  it("Veo: references vs first frame are exclusive", () => { const p = packRefs("veo-3.1-generate-001", [A("start_frame", "S1"), ...sheet]); expect(p.first).toBeTruthy(); expect(p.refs.length).toBe(0); const q = packRefs("veo-3.1-generate-001", sheet); expect(q.refs.length).toBe(3); });
  it("Hailuo (no ref slot) downgrades to a composite start frame", () => { const p = packRefs("MiniMax-Hailuo-2.3", sheet); expect(p.composite!.length).toBeGreaterThan(0); expect(p.notes.join()).toMatch(/合成/); });
  it("Wan kf2v gets first+last; t2v drops frames", () => { expect(packRefs("wan2.2-kf2v-flash", [A("start_frame", "S1"), A("end_frame", "S1")]).last).toBeTruthy(); expect(packRefs("wan2.6-t2v", [A("start_frame", "S1")]).dropped.length).toBe(1); });
  it("audio only where supported", () => { expect(packRefs("wan2.6-i2v", [A("lipsync_audio")]).audio).toBeTruthy(); expect(packRefs("kling-3.0", [A("lipsync_audio")]).dropped.length).toBe(1); });
  it("every cap has a source", () => { for (const [k, c] of Object.entries(CAPS)) expect(c.source, k).toMatch(/http|README/); });
});

describe("recommender", () => {
  const specs = buildSpecs(SHOTS, { bpm: 120 });
  it("lip-sync close-up -> native lip-sync model with Japanese reasons", () => { const r = recommendModel(specs[4], MODELS, { verifiedOnly: true }); expect(r.model.audio).toMatch(/lipsync/); expect(r.why.join()).toMatch(/口パク/); });
  it("override wins", () => expect(recommendModel(specs[1], MODELS, { override: "kling-3.0" }).model.id).toBe("kling-3.0"));
  it("budget excludes expensive models", () => { const r = recommendModel(specs[1], MODELS, { verifiedOnly: true, budgetPerShot: 0.1 }); expect(r.cost!).toBeLessThanOrEqual(0.1); });
  it("never picks deprecated or unpriced when verifiedOnly", () => { for (const s of specs) { const r = recommendModel(s, MODELS, { verifiedOnly: true }); expect(r.model.deprecated).toBeFalsy(); expect(r.model.price_per_sec).toBeTruthy(); } });
});

describe("asset library", () => {
  it("auto-selects refs per shot", () => {
    const lib = { assets: [A("character_front"), A("location"), A("expression"), A("pose"), A("start_frame", "S005"), A("start_frame", "S009"), A("outfit", undefined, false)] };
    const cu = selectRefs(lib, { shot: "S005", size: "CU", performance: "lipsync" }).map((a) => a.role);
    expect(cu[0]).toBe("start_frame"); expect(cu).toContain("expression"); expect(cu).not.toContain("location"); expect(cu).not.toContain("pose"); expect(cu).not.toContain("outfit");
    const ws = selectRefs(lib, { shot: "S006", size: "WS", performance: "dance" }).map((a) => a.role);
    expect(ws).toContain("pose"); expect(ws).toContain("location"); expect(ws).not.toContain("start_frame");
  });
  it("missing assets in order sheet -> world -> frames", () => { const m = missingAssets({ assets: [] }, [{ shot: "S001", needsStart: true }], { props: ["guitar"] }); expect(m.map((x) => x.role)).toEqual(["character_front", "character_side", "character_back", "location", "prop", "start_frame"]); });
  it("add / replace / approve in a temp project; image plan costs", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mvp-")), img = path.join(dir, "x.png"); fs.writeFileSync(img, "png");
    addAsset(dir, img, "start_frame", { shot: "S005" }); addAsset(dir, img, "start_frame", { shot: "S005", generatedBy: "grok-imagine-image" });
    const lib = loadLib(dir); expect(lib.assets.length).toBe(1); expect(lib.assets[0].approved).toBe(false);
    setApproval(dir, lib.assets[0].id, true); expect(loadLib(dir).assets[0].approved).toBe(true);
    const p = planImages(dir, { assets: [] }, [{ shot: "S001", needsStart: true }], { model: M("grok-imagine-image"), character: "Mio" });
    expect(p.tasks[0].role).toBe("character_front"); expect(p.total).toBeCloseTo(0.02 * p.tasks.length); expect(p.tasks.at(-1)!.refs.length).toBeGreaterThan(0);
    expect(planImages(dir, { assets: [] }, [], { model: M("flux") }).total).toBeNull();
  });
  it("Japanese commands", () => {
    expect(parseAssetCmd("キャラシート作って")).toEqual({ kind: "make_sheet" });
    expect(parseAssetCmd("S05の開始画を差し替え")).toEqual({ kind: "replace", shot: "S005", role: "start_frame" });
    expect(parseAssetCmd("Ｓ１２の終了画を差し替えて")).toEqual({ kind: "replace", shot: "S012", role: "end_frame" });
    expect(parseAssetCmd("背景を作って")?.kind).toBe("make_bg");
    expect(parseAssetCmd("全部承認")).toEqual({ kind: "approve", all: true });
  });
});

describe("models.yaml integrity", () => {
  it("verified entries have source + date; no invented prices on unverified", () => {
    for (const m of MODELS) { expect(m.source, m.id).toBeTruthy(); if (m.verified) expect(m.verified_at, m.id).toBeTruthy(); }
    for (const id of ["seedance-2.0", "veo-3.1-generate-001", "pixverse/v5", "vidu/q3", "pollo/pollo-v2", "gemini-image", "flux"]) { const m = M(id); expect(m.price_per_sec ?? m.price_per_image ?? null, id).toBeNull(); }
    expect(M("sora-2").deprecated).toBe(true);
  });
});

const PY = ["/tmp/cv4/bin/python", "python3"].find((p) => { try { execFileSync(p, ["-c", "import numpy, PIL"], { stdio: "ignore" }); return true; } catch { return false; } });
const FF = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();
describe.skipIf(!PY || !FF)("clip QA (python)", () => {
  it("flags a flickering clip, passes a clean one", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "qa-"));
    execFileSync(PY!, ["-c", `from PIL import Image;import numpy as np
for i in range(32):
  a=np.zeros((240,320,3),np.uint8)+90; a[60:180,100+i:220+i]=200
  Image.fromarray(a).save('${d}/c%03d.png'%i)
  if i%4==2: a=np.clip(a.astype(int)+90,0,255).astype(np.uint8)
  Image.fromarray(a).save('${d}/f%03d.png'%i)`]);
    for (const k of ["c", "f"]) execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "8", "-i", `${d}/${k}%03d.png`, "-pix_fmt", "yuv420p", `${d}/${k}.mp4`]);
    const run = (f: string) => { try { return JSON.parse(execFileSync(PY!, [path.join(__dirname, "../scripts/clipqa.py"), f, "--json"], { encoding: "utf8" }))[0]; } catch (e: any) { return JSON.parse(e.stdout)[0]; } };
    expect(run(`${d}/c.mp4`).regenerate).toBe(false);
    const f = run(`${d}/f.mp4`); expect(f.regenerate).toBe(true); expect(f.flags[0].type).toBe("flicker");
  }, 30000);
});
