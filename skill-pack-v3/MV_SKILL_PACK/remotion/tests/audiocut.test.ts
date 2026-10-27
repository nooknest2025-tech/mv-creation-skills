// Lip-sync/dance audio auto-trim: exact length, snapping adjusts in/out, mismatch blocks, original untouched.
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { planCut, checkSync } from "../src/lib/audiocut";
import { cutAudio, validateCut, md5, probeDur } from "../scripts/audiotrim";
import { adapt } from "../src/lib/videoModels";
import { buildSpecs } from "../src/lib/shotprompt";

const MODELS = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/models.yaml"), "utf8")).models;
const M = (id: string) => MODELS.find((m: any) => m.id === id);
import { ffmpegMissing, skipNote, FF_FIX } from "./_caps";
const FFR = ffmpegMissing(), FF = !FFR; if (FFR) skipNote("ffmpeg で音声を切り出すテスト", FFR, FF_FIX);

describe("planCut (pure)", () => {
  it("snapping 7s -> 6s trims the shot and says so", () => {
    const c = planCut({ id: "S005", start: 4, end: 11 }, M("MiniMax-Hailuo-2.3"), 30);
    expect(c.dur).toBe(6); expect(c.adjust).toBe("trim"); expect(c.newEnd).toBe(10); expect(c.adjustJa).toMatch(/詰める/); expect(c.attach).toBe(false); expect(c.note).toMatch(/Remotion/);
  });
  it("extend into the next shot; shift near song end", () => {
    expect(planCut({ id: "S1", start: 2, end: 6 }, M("MiniMax-Hailuo-2.3"), 30).adjust).toBe("extend");
    const c = planCut({ id: "S1", start: 27, end: 31 }, M("MiniMax-Hailuo-2.3"), 30); expect(c.adjust).toBe("shift"); expect(c.newEnd).toBeLessThanOrEqual(30);
  });
  it("Wan attaches wav (audio input 3-30s)", () => { const c = planCut({ id: "S1", start: 0, end: 10 }, M("wan2.6-i2v"), 30); expect(c.attach).toBe(true); expect(c.format).toBe("wav"); });
  it("1-frame tolerance", () => { expect(checkSync(10.02, 10, 30).ok).toBe(true); expect(checkSync(10.05, 10, 30).ok).toBe(false); expect(checkSync(9, 10).msg).toMatch(/止めました/); });
});

describe.skipIf(!FF)("ffmpeg cut", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ac-")), song = path.join(d, "song.mp3");
  let h0 = "";
  beforeAll(() => { execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=30", "-c:a", "libmp3lame", song]); h0 = md5(song); });
  it("10s shot from a 30s song -> 10.000s audio + 10s request", () => {
    const m = M("wan2.6-i2v"), c = planCut({ id: "S010", start: 12.345, end: 22.345 }, m, 30);
    const f = cutAudio(song, c, path.join(d, "out"));
    expect(probeDur(f)).toBeCloseTo(10.0, 3);
    const sp = buildSpecs([{ id: "S010", start: 12.345, end: 22.345, src: "", kind: "image", move: "face_push", role: "lipsync", sectionType: "chorus" }])[0];
    sp.beatSec = c.dur; expect(adapt(sp, m).seconds).toBe(10);
    expect(validateCut(f, 10).ok).toBe(true);
  });
  it("7s -> 6s snapped cut is 6.000s", () => { const c = planCut({ id: "S011", start: 3, end: 10 }, M("MiniMax-Hailuo-2.3"), 30); expect(probeDur(cutAudio(song, c, path.join(d, "out")))).toBeCloseTo(6, 3); });
  it("mismatch blocks", () => { const c = planCut({ id: "S012", start: 0, end: 10 }, M("wan2.6-i2v"), 30); const f = cutAudio(song, c, path.join(d, "out")); const v = validateCut(f, 6); expect(v.ok).toBe(false); expect(v.msg).toMatch(/ずれ/); });
  it("original song is never modified", () => expect(md5(song)).toBe(h0));
});
