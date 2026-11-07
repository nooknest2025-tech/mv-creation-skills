import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAudio, autoSections } from "../scripts/common";

describe("audio section boundaries", () => {
  it("covers a short remainder after the final eight-bar block", () => {
    const duration = 16.4;
    const sections = autoSections({ bpm: 120, phase: 0, duration, energy: Array(Math.ceil(duration * 20)).fill(1) });
    expect(sections[0].start).toBe(0);
    expect(sections.at(-1)?.end).toBe(duration);
  });
  it("locates a consistent click grid across a long recording", () => {
    const rate = 10000, duration = 90, samples = rate * duration;
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
    for (let t = 0.2; t < duration; t += 0.5) {
      const start = Math.round(t * rate);
      for (let i = 0; i < 100; i++) wav.writeInt16LE(i % 2 ? 24000 : -24000, 44 + (start + i) * 2);
    }
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mv-audio-")), "clicks.wav");
    try {
      fs.writeFileSync(file, wav);
      const result = analyzeAudio(file);
      expect(result.bpm).toBeCloseTo(120, 0);
      expect(result.phase).toBeGreaterThanOrEqual(0.18);
      expect(result.phase).toBeLessThanOrEqual(0.22);
      expect(result.duration).toBeCloseTo(duration, 2);
    } finally { fs.rmSync(path.dirname(file), { recursive: true, force: true }); }
  });
});
