import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyInstruction } from "../src/lib/nl";
import { canBreak } from "../src/styles/pro";
import { madeRebuildArgs } from "../scripts/made";
import { findRig, isDemoRig } from "../scripts/parts_lib";

describe("pack bug fixes", () => {
  it("「モーショングラフィックスなし」 turns motion graphics off instead of on", () => {
    const { cfg } = applyInstruction({} as any, "モーショングラフィックスなし");
    expect((cfg as any).mograph?.off).toBe(true);
    expect((cfg as any).combo ?? []).not.toContain("mograph");
  });
  it("「モーショングラフィックスで」 still selects the show mode", () => {
    const { cfg } = applyInstruction({} as any, "モーショングラフィックスで");
    expect((cfg as any).mograph?.off).not.toBe(true);
  });
  it("made rebuilds the imported project (title from manifest), not one named after the song file", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "made-"));
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify({ title: "ミスター・サンプルマン" }));
    expect(madeRebuildArgs("/in", d, true)).toEqual(["--input", "/in", "--title", "ミスター・サンプルマン", "--yes"]);
    const e = fs.mkdtempSync(path.join(os.tmpdir(), "made-"));
    expect(madeRebuildArgs("/in", e, false)).toEqual(["--input", "/in", "--title", path.basename(e)]);
  });
  it("pro lyric layout never breaks inside a katakana or latin word", () => {
    const s = [..."ミスター・サンプルマン！（Hey!）"];
    for (let i = 1; i < 9; i++) expect(canBreak(s, i)).toBe(false); // inside ミスター・サンプルマン
    expect(canBreak(s, 9)).toBe(false); // before ！
    expect(canBreak(s, s.indexOf("e"))).toBe(false); // inside Hey
    expect(canBreak([..."白い仮面に赤い"], 5)).toBe(true);
  });
  it("demo parts rigs are skipped unless named explicitly", () => {
    const inp = fs.mkdtempSync(path.join(os.tmpdir(), "in-")), dir = fs.mkdtempSync(path.join(os.tmpdir(), "pj-"));
    const demo = path.join(inp, "parts", "demo_chara"); fs.mkdirSync(demo, { recursive: true }); fs.writeFileSync(path.join(demo, "rig.json"), "{}");
    expect(isDemoRig(demo)).toBe(true);
    expect(findRig(dir, inp, {} as any)).toBeNull();
    expect(findRig(dir, inp, { parts: { rig: "parts/demo_chara/rig.json" } } as any)).toBe(path.join(demo, "rig.json"));
    const mine = path.join(inp, "parts", "hero"); fs.mkdirSync(mine); fs.writeFileSync(path.join(mine, "rig.json"), "{}");
    expect(findRig(dir, inp, {} as any)).toBe(path.join(mine, "rig.json"));
  });
});
