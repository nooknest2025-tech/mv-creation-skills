import { describe, expect, it } from "vitest";
import { lyricRange, sceneRange, loopStep } from "../editor/loop";

describe("editor range playback", () => {
  it("lyric range is exactly start..end, clamped to the song", () => {
    expect(lyricRange({ start: 2, end: 4.5 }, 20)).toEqual([2, 4.5]);
    expect(lyricRange({ start: 19, end: 25 }, 20)).toEqual([19, 20]);
  });
  it("scene range is start..next scene start (last scene to the end)", () => {
    const s = [{ start: 0 }, { start: 4 }, { start: 9 }];
    expect(sceneRange(s, 0, 12)).toEqual([0, 4]);
    expect(sceneRange(s, 2, 12)).toEqual([9, 12]);
  });
  it("loops or stops exactly at the end, and follows edits live", () => {
    expect(loopStep(3, [2, 4], true)).toBe("play");
    expect(loopStep(4, [2, 4], true)).toBe("restart");
    expect(loopStep(4.01, [2, 4], false)).toBe("stop");
    expect(loopStep(1, [2, 4], true)).toBe("restart"); // start moved later while looping
    expect(loopStep(3.5, [2, 3.2], true)).toBe("restart"); // end moved earlier while looping
  });
});
