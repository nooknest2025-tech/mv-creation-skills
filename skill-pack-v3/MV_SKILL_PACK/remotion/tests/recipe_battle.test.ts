// アニメバトルMVレシピ: テンプレートが検証を通り、BPMに合わせて秒に直り、素材が役割名で割り当たる。
import { describe, expect, it } from "vitest";
import fs from "fs"; import path from "path";
import { applyRecipe } from "../scripts/recipe_battle";
const tpl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/recipes/anime_battle_mv_template.json"), "utf8"));
describe("anime battle recipe", () => {
  it("applies to a project: beats -> seconds, slots -> assets, valid comp, stills ≤0.65s", () => {
    const assets = [...Array.from({ length: 6 }, (_, i) => ({ src: `assets/video-${i}.mp4`, kind: "video", label: i === 2 ? "my top_angle clip" : `clip${i}` })), ...Array.from({ length: 3 }, (_, i) => ({ src: `assets/ill${i}.jpg`, kind: "image" }))];
    const { data, pick } = applyRecipe({ fps: 24, bpm: 120, duration: 40, assets, scenes: [], lyrics: [] }, tpl, { ill_backdrop: 8 });
    expect(pick.top_angle).toBe(2); expect(pick.ill_backdrop).toBe(8);
    expect(data.scenes[1].start).toBeCloseTo(tpl.scenes[1].beat * 0.5, 3);
    expect(data.comp.backdrop.asset).toBe(8);
    for (const [i, s] of data.scenes.entries()) {
      const len = (data.scenes[i + 1]?.start ?? data.duration) - s.start;
      for (const p of s.comp.panels) if (assets[p.asset].kind === "image" && s !== data.scenes.at(-1)) expect(Math.min(len, p.until ?? len) - (p.appear ?? 0)).toBeLessThanOrEqual(0.66 * (60 / 120) / (60 / tpl.sourceBpm) + 0.01);
    }
  });
});
