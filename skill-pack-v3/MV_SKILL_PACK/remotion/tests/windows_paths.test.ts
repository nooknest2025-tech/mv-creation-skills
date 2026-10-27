import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { shellOpts, winArg } from "../scripts/common";
import { plansPaths } from "../scripts/plans_sync";
import { prepareProject } from "../scripts/editor";

const ROOT = path.join(__dirname, "..");
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.name === "node_modules" || e.name.startsWith(".") ? [] :
    e.isDirectory() ? sources(path.join(dir, e.name)) : /\.(ts|tsx|mjs|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

describe("Windows-safe paths and process launch", () => {
  it("no module path is built from URL.pathname (breaks as C:\\C:\\... on Windows)", () => {
    for (const f of [...sources(path.join(ROOT, "scripts")), ...sources(path.join(ROOT, "src")), ...sources(path.join(ROOT, "editor"))])
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/URL\(\s*import\.meta\.url\s*\)\.pathname/);
  });
  it("plans_sync resolves gen/plans.yaml on disk", () => { expect(fs.existsSync(plansPaths.src)).toBe(true); });
  it("quotes args only when a Windows .cmd shim needs a shell", () => {
    const p = "C:\\Users\\a b\\Documents\\MV創作\\曲.wav";
    expect(shellOpts("npx", ["remotion", "render", p], "win32")).toEqual({ shell: true, args: ["remotion", "render", `"${p}"`] });
    expect(shellOpts("python", [p], "win32")).toEqual({ shell: false, args: [p] });
    expect(shellOpts("npx", [p], "linux")).toEqual({ shell: false, args: [p] });
    expect(winArg('say "hi"')).toBe('"say ""hi"""');
    expect(winArg("plain")).toBe("plain");
  });
  it("editor prepares a project whose path has spaces and Japanese", () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mv ed ")), "MV創作 プロジェクト");
    const r = prepareProject({ demo: true, project: dir });
    expect(fs.existsSync(path.join(r.runtime, "editor-state.json"))).toBe(true);
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });
});

describe("Windows-safe dynamic imports", () => {
  it("dynamic import() only takes relative specifiers or pathToFileURL(...).href", () => {
    const files = [...sources(path.join(ROOT, "scripts")), ...sources(path.join(ROOT, "src")), ...sources(path.join(ROOT, "editor")), ...sources(path.join(ROOT, "tests"))];
    for (const f of files.filter((x) => !x.endsWith("windows_paths.test.ts"))) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bimport\(\s*([^)]*)\)/g)) {
      const arg = m[1].trim();
      if (!arg) continue;
      expect(/^["'`](\.{1,2}\/|node:|[a-z@])/.test(arg) || /pathToFileURL\(/.test(arg), `${f}: import(${arg})`).toBe(true);
    }
  });
});
