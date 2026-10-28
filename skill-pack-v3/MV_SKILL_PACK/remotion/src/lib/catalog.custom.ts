// Catalogue entries for styles made with `npm run style:new` (kept separate so the core 32 stay untouched).
import type { StyleInfo } from "./catalog";
export const CUSTOM_CATALOG: Record<string, StyleInfo> = {
  sakura_fall: { short: "桜吹雪", ja: "花びらのように揺れながら舞い落ちて着地し、最後は風に吹かれて散る", energy: "mid", defaults: { fall: 0.55, drop: 0.22, sway: 0.6, petals: 16 } },
  spotlight: { short: "スポットライト", ja: "暗い文字の上を光の輪が歌に合わせて移動し、歌った所だけ照らされる", energy: "low", defaults: { dim: 0.28, light_color: "#ffe9b0" } },
  join_left_right: { short: "左右から合流", ja: "文字列の前半と後半が左右から寄って一つになる", energy: "mid", defaults: { enter: 0.25 } },
  join_top_bottom: { short: "上下から合流", ja: "文字列の前半と後半が上下から寄って一つになる", energy: "mid", defaults: { enter: 0.25 } },
  leave_left_right: { short: "左右へ分かれる", ja: "文字列が読める状態から左右へ離れて消える", energy: "mid", defaults: { enter: 0.25 } },
  leave_top_bottom: { short: "上下へ分かれる", ja: "文字列が読める状態から上下へ離れて消える", energy: "mid", defaults: { enter: 0.25 } },
  // @style:new catalog (do not remove this line)
};
import { MOOD_STYLES } from "./moods";
for (const [k, m] of Object.entries(MOOD_STYLES))
  CUSTOM_CATALOG[k] = { short: m.short, ja: m.ja, energy: m.intensity >= 0.55 ? "high" : m.intensity >= 0.3 ? "mid" : "low", defaults: m.defaults ?? {} };
