// helpers for the 半自動 wizard: approximate cut counts and video-generation cost hints (from gen/models.yaml prices).
import { estimateCuts } from "../src/lib/mograph";
import { autoGenre } from "../src/lib/genres";
import type { Song } from "../src/lib/types";
import { fs, path, PACK_DIR } from "./common";
import YAML from "yaml";

export function estimateCutsFor(song: Song, nImages: number): Record<string, number> {
  const g = (() => { try { return autoGenre(song).id; } catch { return null; } })();
  return Object.fromEntries((["slow", "normal", "fast"] as const).map((d) => [d, estimateCuts(song, g, d, nImages || 10)]));
}
/** 「サビなど一部」=サビ区間の最初の1カット×5秒, 「全部」=各セクション1カット×5秒（npm run gen -- plan の既定と同じ考え方）. */
export function videoCostHint(song: Song): Record<string, string> {
  try {
    const models = YAML.parse(fs.readFileSync(path.join(PACK_DIR, "gen", "models.yaml"), "utf8")).models as any[];
    const m = models.find((x) => x.kind === "video" && x.verified && x.price_per_sec?.["720p"]);
    if (!m) return {};
    const nCh = song.sections.filter((s) => s.type === "chorus").length || 1, nAll = song.sections.length || 1, per = m.price_per_sec["720p"];
    const f = (n: number) => `約$${(n * 5 * per).toFixed(2)}（動画AIで${n}本×5秒・標準画質・1回ずつ作る場合の目安。正確な金額は npm run gen -- plan で確認できます）`;
    return { chorus: f(nCh), all: f(nAll) };
  } catch { return {}; }
}
/** 「画像を動画にする」 estimates: clip counts (サビの見せ場 = 1 per chorus section, 全部 = every cut) and the API price per 5 s clip. */
export function animEstimate(song: Song, nImages: number): { n: { chorus: number; all: number }; perClip?: string; cost: { chorus?: string; all?: string } } {
  const nCh = song.sections.filter((s) => s.type === "chorus").length || 1, nAll = Math.max(nCh, estimateCutsFor(song, nImages).normal ?? nImages);
  try {
    const models = YAML.parse(fs.readFileSync(path.join(PACK_DIR, "gen", "models.yaml"), "utf8")).models as any[];
    const m = models.find((x) => x.kind === "video" && x.verified && x.price_per_sec?.["720p"]);
    if (!m) return { n: { chorus: nCh, all: nAll }, cost: {} };
    const per = m.price_per_sec["720p"] * 5, f = (k: number) => `約$${(k * per).toFixed(2)}`;
    return { n: { chorus: nCh, all: nAll }, perClip: `5秒 約$${per.toFixed(2)}`, cost: { chorus: f(nCh), all: f(nAll) } };
  } catch { return { n: { chorus: nCh, all: nAll }, cost: {} }; }
}
