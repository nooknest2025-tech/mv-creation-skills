// 「ライブDVD風」 captions: names, defaults and small pure helpers (no React; used by the catalog, the editor, server parity tests).
// The drawing is in src/styles/custom/dvd.tsx.
export const DVD_STYLES_INFO: Record<string, { short: string; ja: string }> = {
  dvd_sub: { short: "ライブDVD・字幕", ja: "ライブDVDの字幕のように、画面下の中央に白い文字が静かに出る（下だけ少し暗く）" },
  dvd_card: { short: "ライブDVD・会場カード", ja: "左上に赤い線と会場名（本文）・日付など（サブ）を出すライブ映像のカード" },
  dvd_title: { short: "ライブDVD・タイトル", ja: "中央に上の小見出し→タイトル→赤い線→サブ行が拍ごとに順に出るオープニング" },
  dvd_cam: { short: "ライブDVD・カメラ表示", ja: "ビデオカメラの画面表示（四隅の枠・REC・進むタイムコード）。本文=左上の表示、サブ=開始時刻" },
  dvd_dim: { short: "ライブDVD・暗転", ja: "画面全体を少し暗くする（タイトルやクレジットの下敷き）" },
  dvd_roll: { short: "ライブDVD・クレジット", ja: "エンドクレジット。#=大見出し、-=赤い線、>=小さい注記、役割|名前=2列" },
};
export const DVD_KINDS = Object.keys(DVD_STYLES_INFO);
/** dvd_* other than the subtitle carry free text (venue, title, credits) instead of lyric text. */
export const DVD_FREE_TEXT = DVD_KINDS.filter((k) => k !== "dvd_sub");
export const isDvdMotion = (m: unknown): boolean => typeof m === "string" && DVD_KINDS.includes(m);

export interface DvdSpec {
  motion: string; text: string; start: number; end: number;
  sub?: string; pre?: string;
  enter?: number; exit?: number; // seconds (fade/slide in, fade out)
  scale?: number; accent?: string; fill?: string; glow?: string; font?: string;
  beat?: number; fps?: number; dim?: number;
}
export const DVD_DEFAULTS = { enter: 0.8, exit: 0.6, accent: "#e0182b", fill: "#ffffff", beat: 0.8, fps: 30, dim: 0.6, clock: "00:00:00", camFoot: "CAM A · ▶ STBY" };
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
/** "HH:MM:SS" (or "MM:SS") -> seconds; anything else -> 0 */
export function clockSeconds(s: unknown): number {
  const p = String(s ?? "").trim().split(":").map(Number);
  if (p.length < 2 || p.length > 3 || p.some((v) => !Number.isFinite(v) || v < 0)) return 0;
  const [h, m, sec] = p.length === 3 ? p : [0, p[0], p[1]];
  return h * 3600 + m * 60 + sec;
}
/** camcorder timecode HH:MM:SS:FF at `elapsed` seconds after `clock`. */
export function dvdTimecode(clock: unknown, elapsed: number, fps = 30): string {
  const e = Math.max(0, elapsed), el = clockSeconds(clock) + e, f = Math.floor(e * fps + 1e-6) % Math.max(1, Math.round(fps));
  return [Math.floor(el / 3600) % 24, Math.floor(el / 60) % 60, Math.floor(el) % 60, f].map((v) => String(v).padStart(2, "0")).join(":");
}
/** seconds between the title reveals: the line's own value, else two beats of the song, else 0.8 s. */
export const dvdBeat = (own: unknown, bpm?: number) => num(own, bpm && bpm > 0 ? Math.min(2, Math.max(0.3, 120 / bpm)) : DVD_DEFAULTS.beat);

/** an added caption line (not part of the song's lyrics). Mirror of server.py is_caption. `originalIds` = ids of the source lyric lines (L001…). */
export const isCaption = (l: any, originalIds?: Set<string>): boolean =>
  l?.extra === true || (typeof l?.motion === "string" && l.motion.startsWith("dvd_") && !("sourceParts" in (l ?? {})) && !!originalIds && !originalIds.has(l.id));
let seq = 0;
/** a new caption line for the editor (「ライブDVD風テロップを追加」). Neutral sample texts; the user types the real ones. */
export function newCaption(kind: string, at: number, duration: number, ids: Set<string>, bpm?: number): any {
  const len: Record<string, number> = { dvd_title: 6, dvd_roll: 10, dvd_cam: 8, dvd_dim: 6, dvd_card: 5, dvd_sub: 4 };
  const start = Math.max(0, Math.min(at, duration - 1.5)), end = Math.min(duration, start + (len[kind] ?? 5));
  let id; do id = `DVD-${++seq}`; while (ids.has(id));
  const text: Record<string, string> = { dvd_sub: "字幕のテキスト", dvd_card: "会場名", dvd_title: "タイトル", dvd_cam: "CAM 1", dvd_dim: "（暗転）", dvd_roll: "#タイトル\n-\n歌|名前\n映像|名前\n>Thank you" };
  const l: any = { id, extra: true, text: text[kind] ?? "テロップ", start: +start.toFixed(2), end: +end.toFixed(2), motion: DVD_KINDS.includes(kind) ? kind : "dvd_card", scale: 1, y: 0.5, motionDuration: DVD_DEFAULTS.enter };
  if (kind === "dvd_card") l.sub = "VENUE · DATE";
  if (kind === "dvd_title") { l.pre = "LIVE"; l.sub = "SUBTITLE"; l.beat = +dvdBeat(undefined, bpm).toFixed(3); }
  if (kind === "dvd_cam") l.sub = DVD_DEFAULTS.clock;
  if (kind === "dvd_dim") l.params = { dim: DVD_DEFAULTS.dim };
  return l;
}
