// Lip-sync/dance post-sync in Remotion, short-shot advice, auto-merge, and non-destructive restore.
import { describe, expect, it } from "vitest";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { applyLipsync, checkClip, shortShotAdvice, autoMerge, restoreCut, parseRestore, LipsyncError } from "../src/lib/lipsync";
import { buildProps } from "../src/lib/pipeline";
import { applyInstruction } from "../src/lib/nl";
import { estimateMd } from "../src/lib/estimate";
import { cutAudio } from "../scripts/audiotrim";
import { planCut } from "../src/lib/audiocut";
import type { Shot, Song } from "../src/lib/types";

const MODELS = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/models.yaml"), "utf8")).models;
const M = (id: string) => MODELS.find((m: any) => m.id === id);
const sh = (id: string, start: number, end: number, x: Partial<Shot> = {}): Shot => ({ id, start, end, src: "a.jpg", kind: "image", move: "kb_in", ...x });
const vid = { src: "project/gen/S002/t.mp4", kind: "video" as const, clipFrom: 0.5, rate: 1.2, ramp: "punch" };

describe("applyLipsync", () => {
  it("places the clip exactly at shot start, mutes it, resets clipFrom/rate/ramp", () => {
    const r = applyLipsync([sh("S001", 0, 4), sh("S002", 3.95, 8, vid), sh("S003", 8, 12)], { S002: { start: 4, dur: 4, clipSec: 4, wavSec: 4 } });
    const s = r.shots[1];
    expect([s.start, s.end, s.clipFrom, s.rate, s.ramp, s.muted]).toEqual([4, 8, 0, 1, "none", true]);
    expect(r.shots[0].end).toBe(4);
  });
  it("extended into the next shot: next starts at our end; fully absorbed neighbour is dropped", () => {
    const r = applyLipsync([sh("S001", 0, 2, vid), sh("S002", 2, 4), sh("S003", 4, 8)], { S001: { start: 0, dur: 5, clipSec: 5, wavSec: 5 } });
    expect(r.shots.map((s) => s.id)).toEqual(["S001", "S003"]); expect(r.shots[1].start).toBe(5);
    expect(r.notes.join()).toMatch(/吸収/);
  });
  it("shifted earlier (song end): previous shot is trimmed", () => {
    const r = applyLipsync([sh("S001", 0, 26), sh("S002", 26, 30, vid)], { S002: { start: 24, dur: 6, clipSec: 6 } });
    expect(r.shots[0].end).toBe(24); expect(r.shots[1].start).toBe(24);
  });
  it("clip vs wav > 1 frame stops with a Japanese error; <= 1 frame passes", () => {
    expect(() => checkClip("S1", { start: 0, dur: 5, clipSec: 5.1, wavSec: 5 })).toThrow(/ずれています.*止めました/);
    expect(() => checkClip("S1", { start: 0, dur: 5, clipSec: 5.03, wavSec: 5 })).not.toThrow();
    expect(() => checkClip("S1", { start: 0, dur: 5 })).toThrow(LipsyncError);
    expect(() => applyLipsync([sh("S1", 0, 5, vid)], { S1: { start: 0, dur: 5, clipSec: 6 } })).toThrow(/ずれ/);
  });
  it("two lip-sync shots overlapping -> error", () => {
    expect(() => applyLipsync([sh("S1", 0, 2, vid), sh("S2", 2, 6, vid)], { S1: { start: 0, dur: 5, clipSec: 5 }, S2: { start: 2, dur: 4, clipSec: 4 } })).toThrow(/重なります/);
  });
});

const song: Song = { title: "t", duration: 20, fps: 30, bpm: 120, phase: 0, beatsPerBar: 4, energy: [], energyHz: 0, sections: [{ label: "VERSE", type: "verse", start: 0, end: 20 }], lines: [] } as any;
describe("pipeline wiring", () => {
  it("buildProps applies timing.perShot.lipsync; master song is the only audio", () => {
    const base = buildProps(song, { structure: "none", critic: false } as any, [{ src: "a.jpg", kind: "image" }] as any);
    const id = base.shots[1].id, st = base.shots[1].start;
    const cfg = { structure: "none", critic: false, timing: { perShot: { [id]: { src: "project/gen/x.mp4", kind: "video", lipsync: { start: st + 0.05, dur: 3, clipSec: 3, wavSec: 3 } } } } } as any;
    const p = buildProps(song, cfg, [{ src: "a.jpg", kind: "image" }] as any, { audio: "project/audio.mp3" });
    const s = p.shots.find((x) => x.id === id)!;
    expect(s.start).toBeCloseTo(Math.round((st + 0.05) * 30) / 30, 6); expect(s.muted).toBe(true); expect(p.audio).toBe("project/audio.mp3");
    expect(() => buildProps(song, cfg, [] as any, { audio: "assets/audio/S002_lipsync.wav" })).toThrow(/元の曲を1本/);
    const bad = JSON.parse(JSON.stringify(cfg)); bad.timing.perShot[id].lipsync.clipSec = 4;
    expect(() => buildProps(song, bad, [] as any)).toThrow(/ずれています/);
  });
  it("Visuals mutes every OffthreadVideo (generated clip audio never mixed)", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/render/Visuals.tsx"), "utf8");
    const tags = src.match(/<OffthreadVideo[^>]*>/g)!; expect(tags.length).toBeGreaterThan(0); for (const t of tags) expect(t).toMatch(/\bmuted\b/);
  });
});

describe("short lip-sync shots", () => {
  const H = M("MiniMax-Hailuo-2.3");
  const shots = [{ id: "S1", start: 0, end: 3, performance: "lipsync", singer: "A" }, { id: "S2", start: 3, end: 8.5, performance: "lipsync", singer: "A" }, { id: "S3", start: 8.5, end: 9, performance: "none" }];
  it("warns in Japanese with 3 options when stretched > 1s", () => {
    const a = shortShotAdvice(shots, () => H, MODELS);
    expect(a.map((x) => x.shot)).toEqual(["S1"]); expect(a[0].stretch).toBeGreaterThan(1);
    expect(a[0].msg).toMatch(/伸びます/); expect(a[0].options.join()).toMatch(/S2/); expect(a[0].options.join()).toMatch(/1秒刻み/); expect(a[0].options.join()).toMatch(/Remotion/);
    expect(a[0].merge).toEqual(["S1", "S2"]);
  });
  it("no warning within 1s; different singer is not offered for merge", () => {
    expect(shortShotAdvice([{ id: "S1", start: 0, end: 5.5, performance: "dance" }], () => H)).toEqual([]);
    const a = shortShotAdvice([{ ...shots[0] }, { ...shots[1], singer: "B" }], () => H); expect(a[0].merge).toBeUndefined(); expect(a[0].options[0]).toMatch(/できません/);
  });
  it("user-locked cuts are never auto-changed; auto shots merge", () => {
    const locked = shots.map((s) => ({ ...s, locked: s.id === "S1" }));
    const al = shortShotAdvice(locked, () => H); expect(al[0].merge).toBeUndefined(); expect(al[0].msg).toMatch(/自動では変えません/);
    expect(autoMerge(locked, al).shots.length).toBe(3);
    const am = autoMerge(shots, shortShotAdvice(shots, () => H));
    expect(am.shots.map((s) => [s.id, s.start, s.end])).toEqual([["S1", 0, 8.5], ["S3", 8.5, 9]]);
    expect(autoMerge(shots, shortShotAdvice(shots, () => H), ["S1"]).shots.length).toBe(3); // restored shots stay
  });
  it("estimate markdown lists the warning", () => {
    const md = estimateMd({ lines: [], images: [], usdTotal: 0, unknown: [], credits: {}, clips: 0, seconds: 0, complete: true, shortShots: shortShotAdvice(shots, () => H, MODELS) } as any);
    expect(md).toMatch(/短い口パク/);
  });
});

describe("restore (non-destructive undo)", () => {
  const cfg = { timing: { perShot: { S005: { src: "x.mp4", kind: "video", lipsync: { start: 4, dur: 6, origStart: 4, origEnd: 7, clipSec: 6 } }, S006: { src: "y.mp4", lipsync: { start: 8, dur: 2, origStart: 8, origEnd: 9 } } } } };
  it("restore one shot keeps history, pins it, leaves others", () => {
    const r = restoreCut(cfg, ["S05"]);
    expect(r.cfg.timing.perShot.S005.lipsync).toBeUndefined(); expect(r.cfg.timing.perShot.S005.lipsyncHistory[0].origEnd).toBe(7);
    expect(r.cfg.timing.perShot.S005.src).toBe("x.mp4"); expect(r.cfg.timing.perShot.S006.lipsync).toBeDefined();
    expect(r.cfg.gen.keepCut).toContain("S005"); expect(r.changes[0]).toMatch(/元の長さに戻しました.*消していません/);
    expect(cfg.timing.perShot.S005.lipsync).toBeDefined(); // input not mutated
  });
  it("restore all + Japanese phrases", () => {
    expect(parseRestore("S05を元の長さに戻して")).toEqual(["S005"]); expect(parseRestore("全部元の長さに戻して")).toBe("all"); expect(parseRestore("S05を明るく")).toBeNull();
    const r = restoreCut(cfg, "all"); expect(Object.values(r.cfg.timing.perShot).every((v: any) => !v.lipsync)).toBe(true);
    const n = applyInstruction(cfg as any, "S06を元の長さに戻して"); expect((n.cfg as any).timing.perShot.S006.lipsync).toBeUndefined(); expect(n.changes.join()).toMatch(/S006/);
  });
  it("after restore the render goes back to the original cut and neighbours", () => {
    const shots = [sh("S1", 0, 2, vid), sh("S2", 2, 4), sh("S3", 4, 8)];
    const c = { timing: { perShot: { S1: { lipsync: { start: 0, dur: 5, clipSec: 5 } } } } };
    expect(applyLipsync(shots, { S1: c.timing.perShot.S1.lipsync }).shots.length).toBe(2);
    const r = restoreCut(c, ["S1"]); expect(applyLipsync(shots, { S1: r.cfg.timing.perShot.S1.lipsync }).shots.map((s) => [s.id, s.start, s.end])).toEqual([["S1", 0, 2], ["S2", 2, 4], ["S3", 4, 8]]);
  });
  const FF = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();
  it.skipIf(!FF)("re-trimming keeps the previous wav as a version", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "ls-")), songF = path.join(d, "song.wav");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=12", songF]);
    const c = planCut({ id: "S001", start: 1, end: 5 }, M("wan2.6-i2v"), 12);
    cutAudio(songF, c, path.join(d, "a")); cutAudio(songF, { ...c, start: 2 }, path.join(d, "a"));
    expect(fs.readdirSync(path.join(d, "a")).sort()).toEqual(["S001_lipsync.v1.wav", "S001_lipsync.wav"]);
  });
});
