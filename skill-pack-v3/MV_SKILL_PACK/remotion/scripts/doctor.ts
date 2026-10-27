// npm run doctor (= npm run setup): 必要なアプリを調べ、足りない物を日本語で説明。--fix で1つずつ確認しながらインストール。
// 擬似テスト: MVPACK_DOCTOR_MISSING=ffmpeg,python npm run doctor
import { spawnSync } from "node:child_process";
import os from "node:os";
import readline from "node:readline/promises";
import { REMOTION_DIR, fs, log, path, run as runCmd } from "./common";
import { TOOLS, report, type OS, type Probe } from "./doctor_lib";

const WIN = process.platform === "win32";
const run = (c: string, a: string[] = ["--version"]) => { const r = runCmd(c, a, { encoding: "utf8", timeout: 20000 }); return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n")[0] }; };
export function probeAll(): Probe {
  const P: Probe = {};
  const major = Number(process.versions.node.split(".")[0]);
  P.node = { ok: major >= 18, detail: process.versions.node };
  const n = run("npm"); P.npm = { ok: n.ok, detail: n.out };
  P.deps = { ok: fs.existsSync(path.join(REMOTION_DIR, "node_modules", "remotion")) };
  const cache = [path.join(REMOTION_DIR, "node_modules", ".remotion"), path.join(os.homedir(), ".cache", "remotion")];
  P.browser = { ok: cache.some((d) => fs.existsSync(d)), detail: "（無ければ初回書き出しで自動取得）" };
  const f = run("ffmpeg", ["-version"]); P.ffmpeg = { ok: f.ok, detail: f.ok ? f.out.slice(0, 40) : "（Remotion 同梱版で代用中）" };
  const g = run("git"); P.git = { ok: g.ok, detail: g.out };
  const py = process.env.MVPACK_PYTHON ?? ["python3", "python", "py"].find((c) => run(c).ok);
  P.python = { ok: !!py, detail: py ? run(py).out : undefined };
  const imp = (m: string) => !!py && spawnSync(py, ["-c", `import ${m}`], { shell: false }).status === 0;
  P.pillow = { ok: imp("PIL") && imp("numpy") };
  P.psd_tools = { ok: imp("psd_tools") };
  P.rembg = { ok: imp("rembg") };
  P.opencv = { ok: !!py && spawnSync(py, ["-c", "import cv2,sys; sys.exit(0 if hasattr(cv2,'CascadeClassifier') else 1)"], { shell: false }).status === 0 };
  P.whisper = { ok: imp("faster_whisper") };
  let free = Infinity; try { const s = (fs as any).statfsSync(REMOTION_DIR); free = (s.bavail * s.bsize) / 1e9; } catch { /* old node */ }
  P.disk = { ok: free >= 5, detail: Number.isFinite(free) ? `空き ${free.toFixed(1)}GB` : "" };
  const nv = run("nvidia-smi", ["-L"]); P.gpu = { ok: nv.ok, detail: nv.ok ? nv.out : "（なし: CPU で動作）" };
  const cx = run("codex"); P.codex = { ok: cx.ok, detail: cx.ok ? cx.out : "（VS Code 拡張/アプリ版なら検出できなくても OK）" };
  P.studio = { ok: P.deps.ok };
  const dv = WIN ? fs.existsSync("C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\Resolve.exe") : process.platform === "darwin" ? fs.existsSync("/Applications/DaVinci Resolve/DaVinci Resolve.app") : fs.existsSync("/opt/resolve/bin/resolve");
  P.davinci = { ok: dv };
  const cfg = path.join(os.homedir(), ".codex", "config.toml");
  const mcp = fs.existsSync(cfg) ? (fs.readFileSync(cfg, "utf8").match(/^\[mcp_servers\.([^\]]+)\]/gm) ?? []).map((x) => x.slice(13, -1)) : [];
  P.video_mcp = { ok: mcp.length > 0, detail: mcp.length ? `Codex に登録済み: ${mcp.join(", ")}` : "（未登録: 無料ルートで作ります）" };
  // simulated missing tools (tests / demos)
  for (const id of (process.env.MVPACK_DOCTOR_MISSING ?? "").split(",").filter(Boolean)) P[id] = { ok: false, detail: "（擬似的に未インストール）" };
  return P;
}
export const osOf = (): OS => (WIN ? "win" : process.platform === "darwin" ? "mac" : "linux");

async function main() {
  const args = process.argv.slice(2);
  const P = probeAll(), r = report(P, osOf());
  if (args.includes("--json")) { console.log(JSON.stringify({ os: osOf(), probe: P, missing: r.lines.filter((l) => !l.ok).map((l) => ({ id: l.tool.id, need: l.tool.need, cost: l.tool.cost, fix: l.fix })) }, null, 1)); if (r.blocking.length) process.exitCode = 1; return; }
  log(r.text);
  if (args.includes("--fix") && r.fixes.length) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    for (const l of r.fixes) {
      if (l.tool.need === "任意" && !args.includes("--all")) continue;
      const a = (await rl.question(`\n▶ ${l.tool.ja} を入れますか？（${l.tool.cost}） 実行するコマンド: ${l.fix}  [y/N] `)).trim().toLowerCase();
      if (!a.startsWith("y")) { log("  スキップしました"); continue; }
      const res = spawnSync(l.fix!, { shell: true, stdio: "inherit", cwd: REMOTION_DIR });
      log(res.status === 0 ? "  ✅ 完了（新しいターミナルを開くと反映される場合があります）" : `  ❌ 失敗しました。公式サイトから入れてください: ${l.tool.link}`);
    }
    rl.close();
    log("\nもう一度 npm run doctor で確認してください。");
  }
  if (r.blocking.length) process.exitCode = 1;
}
if (process.argv[1] && /doctor\.ts$/.test(process.argv[1])) main();
export { TOOLS };
