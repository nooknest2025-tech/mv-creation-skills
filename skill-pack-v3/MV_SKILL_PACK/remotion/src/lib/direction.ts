// Fit-first lyric direction: every auto choice is scored against the song (genre/mood, BPM, energy, word speed, lyric meaning)
// and the picture behind it; variety happens only inside the fit set. Pro rules encoded here (see docs/PRO_DIRECTION_ja.md):
//  - intensity follows the energy arc (verse < pre < chorus, last chorus = peak), restraint before the drop
//  - one hero (big) move per section, never on consecutive lines
//  - motif/callback: repeated choruses reuse their main style (escalate, don't reinvent)
//  - readability: fast lines get legible styles; slow ballads never get shaky/glitch styles
import { hash, rng } from "./core";
import { CATALOG } from "./catalog";
import { TRAITS, trait } from "./traits";
import type { Section, Song } from "./types";

export interface GenreFit { moods: string[]; lo: number; hi: number; calm?: boolean; ja: string }
export const GENRE_FIT: Record<string, GenreFit> = {
  ballad: { moods: ["ballad"], lo: 0.05, hi: 0.42, calm: true, ja: "バラード" },
  acoustic: { moods: ["acoustic"], lo: 0.02, hi: 0.3, calm: true, ja: "弾き語り" },
  ambient: { moods: ["ambient"], lo: 0.02, hi: 0.3, calm: true, ja: "チル" },
  citypop_jazz: { moods: ["citypop"], lo: 0.12, hi: 0.45, ja: "シティポップ" },
  wa: { moods: ["wa"], lo: 0.12, hi: 0.65, ja: "和風" },
  idol_pop: { moods: ["idol"], lo: 0.3, hi: 0.75, ja: "アイドル" },
  dark: { moods: ["dark"], lo: 0.2, hi: 0.85, ja: "ダーク" },
  hiphop: { moods: ["hiphop"], lo: 0.4, hi: 0.85, ja: "ヒップホップ" },
  rock_edm: { moods: ["rock"], lo: 0.4, hi: 0.95, ja: "ロック" },
};
const GENERIC: GenreFit = { moods: [], lo: 0.1, hi: 0.75, ja: "汎用" };
// section "base" level on the arc before energy is applied
const ARC: Record<string, number> = { intro: 0.15, verse: 0.25, pre_chorus: 0.5, chorus: 0.85, bridge: 0.35, outro: 0.15, other: 0.3 };

export interface LineCtx { genre?: string | null; secType: string; energy: number; cps: number; bpm: number; text: string; isLastChorus?: boolean; vertOk?: boolean }
export interface Scored { style: string; score: number; why: string[] }

export function targetIntensity(c: LineCtx): number {
  const g = (c.genre && GENRE_FIT[c.genre]) || GENERIC;
  const arc = Math.min(1, (ARC[c.secType] ?? 0.3) * 0.6 + c.energy * 0.4 + (c.isLastChorus ? 0.12 : 0));
  return g.lo + (g.hi - g.lo) * arc;
}

/** hard rules -> reason string when a style is NOT allowed here. */
export function banReason(style: string, c: LineCtx): string | null {
  const t = trait(style), g = (c.genre && GENRE_FIT[c.genre]) || GENERIC;
  const slow = g.calm || c.bpm < 90;
  if (slow && t.shaky) return "ゆっくりな曲に揺れ・グリッチは合わない";
  if (slow && t.intensity > 0.55) return "ゆっくりな曲に強すぎる動き";
  if (t.intensity > g.hi + 0.15) return `${g.ja}には強すぎる`;
  if (c.cps > 9 && (t.readable ?? 0.8) < 0.7) return "早口の行は読めなくなる";
  if (t.vertical && c.vertOk === false) return "縦書きの余白がない画角";
  if (style === "circular" || style === "ticker" || style === "ui_window") if (!c.genre || g.calm) return "ギミック系は指名時のみ";
  return null;
}

export function scoreStyle(style: string, c: LineCtx): Scored {
  const t = trait(style), g = (c.genre && GENRE_FIT[c.genre]) || GENERIC, why: string[] = [];
  const ban = banReason(style, c);
  if (ban) return { style, score: -Infinity, why: [ban] };
  let s = 0;
  const m = t.moods.filter((x) => g.moods.includes(x)).length;
  if (g.moods.length) { s += m ? 2 + 0.3 * m : -1.5; if (m) why.push(`${g.ja}向き`); }
  const tgt = targetIntensity(c), d = Math.abs(t.intensity - tgt);
  s -= d * 4; if (d < 0.15) why.push(`曲の勢い(${Math.round(tgt * 100)})に合う強さ`);
  if (c.cps > 6.5) { s += t.wordUnit ? 0.8 : 0; s += ((t.readable ?? 0.8) - 0.8) * 3; if (t.wordUnit) why.push("言葉数が多い→語単位"); }
  if (c.cps < 3 && (t.readable ?? 0.8) >= 0.9) { s += 0.4; why.push("ゆっくり読ませる"); }
  if (c.genre === "wa" && t.vertical) { s += 0.6; why.push("和→縦書き"); }
  return { style, score: s, why };
}

export function fitSet(c: LineCtx, k = 8): Scored[] {
  return Object.keys(TRAITS).filter((s) => s in CATALOG).map((s) => scoreStyle(s, c)).filter((x) => x.score > -Infinity).sort((a, b) => b.score - a.score).slice(0, k);
}

export interface LyricPlanOpts { genre?: string | null; seed?: number; variety?: number /* 0 統一感 .. 1 変化多め */; vertOk?: boolean; accent?: Record<string, string> }
export interface PlannedLine { style: string; why: string; hero: boolean }
export interface SectionNote { label: string; type: string; styles: string[]; why: string }

const isAccent = (text: string) => { const core = text.replace(/[\s、。!?！？「」]/g, ""); if ([...core].length <= 4) return true; const p = text.normalize("NFKC").split(/[\s　]+/).filter(Boolean); return p.length >= 2 && new Set(p).size === 1; };

/** choose styles for every line. Returns per-line picks + Japanese per-section notes. */
export function planLyrics(song: Song, ranks: number[], o: LyricPlanOpts = {}): { lines: (PlannedLine | null)[]; notes: SectionNote[] } {
  const variety = Math.max(0, Math.min(1, o.variety ?? 0.5)), seed = o.seed ?? 1;
  const perSec = 1 + Math.round(variety * 2.4); // 1..3 styles per section
  const secs: Section[] = song.sections.length ? song.sections : [{ label: "全体", type: "other", start: 0, end: song.duration }];
  const memo: Record<string, string[]> = {}; // callback: same section type reuses its styles
  const notes: SectionNote[] = [];
  const lines: (PlannedLine | null)[] = song.lines.map(() => null);
  let prevStyles: string[] = [];
  let lastStyle = "";
  secs.forEach((sec, si) => {
    const idx = song.lines.map((L, i) => ({ L, i })).filter(({ L }) => L.start >= sec.start - 1e-6 && L.start < sec.end);
    if (!idx.length) return;
    const isLastChorus = sec.type === "chorus" && !secs.slice(si + 1).some((x) => x.type === "chorus");
    const dur = idx.reduce((a, { L }) => a + Math.max(0.2, L.end - L.start), 0);
    const cps = idx.reduce((a, { L }) => a + [...L.text.replace(/\s/g, "")].length, 0) / dur;
    const ctx: LineCtx = { genre: o.genre, secType: sec.type, energy: ranks[si] ?? 0.5, cps, bpm: song.bpm, text: "", isLastChorus, vertOk: o.vertOk };
    const fit = fitSet(ctx, 4 + Math.round(variety * 6));
    if (!fit.length) return;
    const r = rng("lyr", seed, si, song.title);
    let chosen: string[];
    const key = sec.type;
    if (memo[key] && variety < 0.75) {
      chosen = memo[key].filter((s) => fit.some((f) => f.style === s));
      if (!chosen.length) chosen = [fit[0].style];
    } else {
      // weighted draw without replacement from the fit set; contrast with the previous section (avoid its styles)
      const pool = fit.filter((f) => !prevStyles.includes(f.style));
      const src = pool.length >= perSec ? pool : fit;
      chosen = [];
      const w = src.map((f, k) => Math.exp(-k * (1.2 - variety)));
      while (chosen.length < Math.min(perSec, src.length)) {
        let x = r.next() * w.reduce((a, b, k) => a + (chosen.includes(src[k].style) ? 0 : b), 0);
        for (let k = 0; k < src.length; k++) { if (chosen.includes(src[k].style)) continue; x -= w[k]; if (x <= 0) { chosen.push(src[k].style); break; } }
        if (x > 0) chosen.push(src.find((f) => !chosen.includes(f.style))!.style);
      }
      memo[key] ??= chosen;
    }
    // hero move: at most one per section (chorus / pre-chorus peak only)
    const heroCand = sec.type === "chorus" || (sec.type === "pre_chorus" && (ranks[si] ?? 0) > 0.6) ? fit.find((f) => trait(f.style).hero) : undefined;
    let heroUsed = false;
    const base = chosen.filter((s) => !trait(s).hero);
    if (!base.length) { const nh = fitSet(ctx, 30).find((f) => !trait(f.style).hero); if (nh) base.push(nh.style); }
    if (perSec >= 2 && base.length < 2) { const nh = fitSet(ctx, 30).find((f) => !trait(f.style).hero && !base.includes(f.style)); if (nh) base.push(nh.style); }
    const rot = base.length ? base : chosen;
    let k = 0;
    idx.forEach(({ L, i }, n) => {
      let st = rot[k % rot.length]; k++;
      let hero = false;
      if (heroCand && !heroUsed && (n === 0 || isAccent(L.text))) { st = heroCand.style; hero = true; heroUsed = true; }
      else if (isAccent(L.text) && o.accent) { const a = o.accent[sec.type] ?? o.accent.other; if (a && fit.some((f) => f.style === a)) st = a; }
      if (st === lastStyle && rot.length > 1) { st = rot.find((x) => x !== lastStyle)!; hero = false; }
      // fast line -> most legible of the chosen set
      const lcps = [...L.text.replace(/\s/g, "")].length / Math.max(0.2, L.end - L.start);
      if (lcps > 10 && (trait(st).readable ?? 0.8) < 0.75) st = [...rot].sort((a, b) => (trait(b).readable ?? 0.8) - (trait(a).readable ?? 0.8))[0];
      const f = fit.find((x) => x.style === st) ?? fitSet(ctx, 30).find((x) => x.style === st);
      lines[i] = { style: st, hero, why: `${hero ? "見せ場" : sec.type}:${(f?.why ?? []).join("・") || "適合"}` };
      lastStyle = st;
    });
    const f0 = fit.find((f) => f.style === chosen[0]);
    notes.push({ label: sec.label, type: sec.type, styles: [...new Set(idx.map(({ i }) => lines[i]!.style))],
      why: `${sec.label}: 勢い${Math.round(targetIntensity(ctx) * 100)}/100・${cps.toFixed(1)}字/秒 → ${chosen.map((s) => CATALOG[s]?.short ?? s).join("・")}${heroCand ? `（見せ場は${CATALOG[heroCand.style]?.short}を1回だけ）` : ""}｜${(f0?.why ?? []).join("・")}${memo[key] === chosen && notes.some((n) => n.type === key) ? "｜前の同じセクションを踏襲（モチーフ）" : ""}` });
    prevStyles = chosen;
  });
  return { lines, notes };
}

/** minimum on-screen time for a line. Subtitle practice (Netflix timed-text guides): never under 5/6 s, Japanese reading speed
 *  7 chars/s for SDH (4 for translated subs - lyrics are also heard, so we use 7) + 0.3 s settle, capped at 3.5 s. */
export const minOnScreen = (text: string) => Math.min(3.5, Math.max(5 / 6, [...text.replace(/\s/g, "")].length / 7 + 0.3));
export const seedFrom = (s: string | number) => (typeof s === "number" ? s : hash(s));
