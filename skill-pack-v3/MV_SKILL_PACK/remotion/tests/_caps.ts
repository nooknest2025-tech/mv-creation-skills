// Capability probes for optional tools. Tests that need them skip with a clear message instead of failing
// (e.g. Windows "essentials" ffmpeg builds, missing ffprobe, or Python without numpy/Pillow).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const ok = (cmd: string, args: string[]) => { try { return spawnSync(cmd, args, { stdio: "pipe", windowsHide: true, timeout: 20000 }).status === 0; } catch { return false; } };
let ffCache: string | null | undefined;
/** null = full ffmpeg available; otherwise the reason (Japanese). */
export function ffmpegMissing(): string | null {
  if (ffCache !== undefined) return ffCache;
  if (!ok("ffmpeg", ["-version"])) return (ffCache = "ffmpeg が見つかりません");
  if (!ok("ffprobe", ["-version"])) return (ffCache = "ffprobe が見つかりません（ffmpeg と同じフォルダに必要）");
  const enc = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true }).stdout ?? "";
  for (const e of ["libmp3lame", "libx264", "aac"]) if (!enc.includes(e)) return (ffCache = `ffmpeg に ${e} がありません（フル版の ffmpeg が必要）`);
  if (!ok("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", "-f", "null", "-"])) return (ffCache = "ffmpeg のテスト用音源（lavfi）が使えません（フル版の ffmpeg が必要）");
  return (ffCache = null);
}
/** first python that can import all modules, or null. */
export function pythonWith(mods: string[]): string | null {
  const venv = path.resolve(__dirname, "../../.python-deps/venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  for (const p of [process.env.MVPACK_PYTHON, fs.existsSync(venv) ? venv : "", "python3", "python", "py"].filter(Boolean) as string[]) if (ok(p, ["-c", `import ${mods.join(", ")}`])) return p;
  return null;
}
export function skipNote(what: string, reason: string, fix: string) {
  console.warn(`⏭ スキップ: ${what} — ${reason}。\n   有効にするには: ${fix}（詳しくは docs/EDITOR_ja.md「テストに必要な追加ツール」）`);
}
export const FF_FIX = "Mac: brew install ffmpeg / Windows: winget install Gyan.FFmpeg（full 版）/ Ubuntu: sudo apt install ffmpeg";
export const PY_FIX = "python -m pip install -r requirements_optional.txt（numpy と Pillow）";
