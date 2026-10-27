import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { TOOLS, report, type Probe } from "../scripts/doctor_lib";

const all = (ok: boolean): Probe => Object.fromEntries(TOOLS.map((t) => [t.id, { ok }]));
describe("doctor", () => {
  it("every tool has need, cost (無料/無料枠あり/有料), purpose, fallback, and a link or install", () => {
    for (const t of TOOLS) { expect(["必須", "推奨", "任意"]).toContain(t.need); expect(["無料", "無料枠あり", "有料"]).toContain(t.cost); expect(t.why && t.without).toBeTruthy(); if (t.cost !== "無料") expect(t.costNote).toMatch(/確認|未確認/); }
  });
  it("missing ffmpeg + python on Windows: explains, offers winget, not blocking", () => {
    const p = all(true); p.ffmpeg = { ok: false }; p.python = { ok: false }; p.whisper = { ok: false };
    const r = report(p, "win");
    expect(r.blocking).toHaveLength(0);
    expect(r.text).toContain("winget install Gyan.FFmpeg");
    expect(r.text).toContain("winget install Python.Python.3.12");
    expect(r.text).toMatch(/Remotion 同梱の簡易版 ffmpeg/);
    expect(r.text).toMatch(/\(先に Python\) pip install faster-whisper/);
    expect(r.text).toMatch(/完全無料ルート/);
  });
  it("missing Node on mac is blocking and suggests brew", () => {
    const p = all(true); p.node = { ok: false };
    const r = report(p, "mac");
    expect(r.blocking.map((l) => l.tool.id)).toEqual(["node"]);
    expect(r.text).toContain("brew install node");
    expect(r.text).toMatch(/必須が 1 件/);
  });
  it("no video MCP -> free route, marked 有料 with verified prices", () => {
    const p = all(true); p.video_mcp = { ok: false };
    const r = report(p, "linux");
    expect(r.text).toMatch(/動画生成 MCP.*任意・有料/);
    expect(r.text).toMatch(/無料ルート/);
  });
  it("real CLI with simulated missing tools (MVPACK_DOCTOR_MISSING)", () => {
    const r = spawnSync("npx", ["tsx", "scripts/doctor.ts", "--json"], { cwd: path.join(__dirname, ".."), encoding: "utf8", env: { ...process.env, MVPACK_DOCTOR_MISSING: "ffmpeg,opencv,node" }, timeout: 60000 });
    const j = JSON.parse(r.stdout);
    expect(j.missing.map((m: any) => m.id)).toEqual(expect.arrayContaining(["ffmpeg", "opencv", "node"]));
    expect(r.status).toBe(1); // node missing = blocking
  }, 70000);
});
