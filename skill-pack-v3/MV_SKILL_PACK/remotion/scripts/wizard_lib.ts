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
    const f = (n: number) => `約$${(n * 5 * per).toFixed(2)}・${m.id} 720p・${n}本×5秒・1テイク（API従量の目安。正確には npm run gen -- plan）`;
    return { chorus: f(nCh), all: f(nAll) };
  } catch { return {}; }
}
