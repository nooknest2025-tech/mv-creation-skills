// Per-line lyric style resolution: line > shot > section > preset/project default, "auto" by section + energy.
import { AUTO_ACCENT, AUTO_POOLS, CATALOG, DEFAULT_KEYWORDS, KEYWORD_EFFECTS, canonicalStyle } from "./catalog";
import type { LyricStyleConfig, ResolvedLine, Section, Shot, Song, StyleSpec } from "./types";
import { sectionAt, sectionEnergyRanks, sectionTypeOf } from "./song";
import { GENRES, type GenreRecipe } from "./genres";
import { resolveFont } from "./fonts";
import { readableFill } from "./visual";
import { planLyrics, type SectionNote } from "./direction";
const NOTES = new WeakMap<object, SectionNote[]>();
export const notesOf = (lines: ResolvedLine[]) => NOTES.get(lines) ?? [];

const N = (s: unknown) => String(s ?? "").normalize("NFKC").trim();

export function normalizeSpec(spec: StyleSpec | undefined | null): [string, Record<string, unknown>] | null {
  if (spec == null || spec === "") return null;
  if (typeof spec === "string") return [canonicalStyle(spec), {}];
  const { style, ...rest } = spec as any;
  if (!style) throw new Error(`文字スタイル指定に style がありません: ${JSON.stringify(spec)}`);
  return [canonicalStyle(style), rest];
}

export function isAccentLine(text: string): boolean {
  const core = text.replace(/[\s、。!?！？「」]/g, "");
  if ([...core].length <= 4) return true;
  const parts = N(text).split(/[\s　]+/).filter(Boolean);
  return parts.length >= 2 && new Set(parts).size === 1;
}

export function autoPick(secType: string, energyRank: number, instance: number, text: string, g?: GenreRecipe): [string, string] {
  let lt = secType in AUTO_POOLS ? secType : "other";
  if (energyRank >= 0.8 && lt !== "chorus") lt = ["pre_chorus", "bridge", "verse"].includes(lt) ? "chorus" : lt;
  else if (energyRank <= 0.15 && lt === "chorus") lt = "pre_chorus";
  if (isAccentLine(text)) return [g ? g.accent[lt] ?? g.accent.other : AUTO_ACCENT[lt] ?? "scale_pop", `auto:${lt}:accent`];
  const pool = g ? g.pools[lt] ?? g.pools.other : AUTO_POOLS[lt];
  return [pool[instance % pool.length], `auto:${lt}#${instance}`];
}

/** table key match: exact label > label prefix (longest) > generic type word (サビ / chorus). */
export function matchSection(table: Record<string, StyleSpec> | undefined, sec: Section, instance = 0, isLast = false): StyleSpec | undefined {
  if (!table) return undefined;
  // "verse#2" = 2番のAメロ, "chorus#last" = ラスサビ
  if (isLast && table[`${sec.type}#last`] !== undefined) return table[`${sec.type}#last`];
  if (table[`${sec.type}#${instance + 1}`] !== undefined) return table[`${sec.type}#${instance + 1}`];
  const lab = N(sec.label).toUpperCase();
  const entries = Object.entries(table).map(([k, v]) => [N(k).toUpperCase(), v] as const);
  const exact = entries.find(([k]) => k === lab);
  if (exact) return exact[1];
  const pre = entries.filter(([k]) => k && lab.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0];
  if (pre) return pre[1];
  const generic = entries.find(([k]) => !/\d/.test(k) && sectionTypeOf(k) === sec.type && sectionTypeOf(k) !== "other");
  return generic?.[1];
}

export function findKeywords(text: string, kw: Record<string, string>): { a: number; b: number; effect: string; word: string }[] {
  const taken = new Array(text.length).fill(false);
  const hits: { a: number; b: number; effect: string; word: string }[] = [];
  for (const w of Object.keys(kw).sort((x, y) => y.length - x.length)) {
    if (!w || !kw[w]) continue;
    let from = 0, i: number;
    while ((i = text.indexOf(w, from)) >= 0) {
      const b = i + w.length;
      if (!taken.slice(i, b).some(Boolean)) {
        hits.push({ a: i, b, effect: kw[w], word: w });
        for (let j = i; j < b; j++) taken[j] = true;
      }
      from = i + 1;
    }
  }
  return hits.sort((x, y) => x.a - y.a);
}

export function mergeKeywords(user?: Record<string, string>): Record<string, string> {
  const kw = { ...DEFAULT_KEYWORDS, ...(user ?? {}) };
  for (const [k, v] of Object.entries(kw)) if (v && !(v in KEYWORD_EFFECTS)) throw new Error(`語エフェクト「${k}: ${v}」は未知です。使えるもの: ${Object.keys(KEYWORD_EFFECTS).join(", ")}（"" で無効）`);
  return kw;
}

export function resolveLines(song: Song, cfg: LyricStyleConfig = {}, shots: Shot[] = []): ResolvedLine[] {
  let def = normalizeSpec(cfg.default ?? "auto")!;
  let secTab = cfg.sections, lineTab = Object.fromEntries(Object.entries(cfg.lines ?? {}).map(([k, v]) => [N(k), v]));
  if (cfg.force) { def = normalizeSpec(cfg.force)!; secTab = {}; lineTab = {}; shots = []; }
  const ranks = sectionEnergyRanks(song);
  const instCount: Record<string, number> = {};
  const secInst = song.sections.map((s) => { const k = instCount[s.type] ?? 0; instCount[s.type] = k + 1; return k; });
  const g = cfg.genre ? GENRES[cfg.genre] : undefined;
  const kw = cfg.keywordEffects === false ? {} : mergeKeywords({ ...(g?.keywords ?? {}), ...(cfg.keywords ?? {}) });
  const F = (x: string | undefined) => { if (!x) return undefined; const id = resolveFont(x); if (!id) throw new Error(`書体「${x}」が見つかりません（npm run fonts で一覧、npm run fonts:add で追加）`); return id; };
  const plan = planLyrics(song, ranks, { genre: cfg.genre ?? null, seed: cfg.seed, variety: cfg.variety, vertOk: cfg.vertOk, accent: g?.accent });
  const fontLines = Object.fromEntries(Object.entries(cfg.fontLines ?? {}).map(([k, v]) => [N(k), v]));
  const out: ResolvedLine[] = song.lines.map((L, li) => {
    const sec = sectionAt(song.sections, L.start);
    const si = song.sections.indexOf(sec);
    const shot = shots.find((s) => L.start >= s.start - 1e-6 && L.start < s.end);
    let spec: StyleSpec | undefined, src = "project";
    for (const key of [String(li), N(L.text)]) if (key in lineTab) { spec = lineTab[key]; src = `line:${key}`; break; }
    if (spec === undefined) {
      const sub = Object.keys(lineTab).filter((k) => k && !/^\d+$/.test(k) && N(L.text).includes(k)).sort((a, b) => b.length - a.length)[0];
      if (sub) { spec = lineTab[sub]; src = `line~:${sub}`; }
    }
    if (spec === undefined && shot?.lyricStyle) { spec = shot.lyricStyle; src = `shot:${shot.id}`; }
    if (spec === undefined) { const isLast = si >= 0 && !song.sections.slice(si + 1).some((x) => x.type === sec.type);
      const v = matchSection(secTab, sec, si >= 0 ? secInst[si] : 0, isLast); if (v !== undefined) { spec = v; src = `section:${sec.label}`; } }
    let [name, params] = spec !== undefined ? normalizeSpec(spec)! : def;
    const locked = name !== "auto";
    let hero = false;
    if (name === "auto") {
      const pl = plan.lines[li];
      if (pl) { name = pl.style; hero = pl.hero; src = `${src}→fit:${pl.why}`; }
      else { const [n2, why] = autoPick(sec.type, si >= 0 ? ranks[si] : 0.5, si >= 0 ? secInst[si] : 0, L.text, g); name = n2; src = `${src}→${why}`; }
    }
    const P: Record<string, any> = { ...CATALOG[name].defaults, ...(cfg.params?.[name] ?? {}), ...params };
    // font: line spec > fontLines > fontSections > genre recipe > song font (none = the style's own typeface)
    {
      const lk = [String(li), N(L.text)].find((k) => k in fontLines) ?? Object.keys(fontLines).filter((k) => k && !/^\d+$/.test(k) && N(L.text).includes(k)).sort((a, b) => b.length - a.length)[0];
      const isLast = si >= 0 && !song.sections.slice(si + 1).some((x) => x.type === sec.type);
      const secF = matchSection(cfg.fontSections as any, sec, si >= 0 ? secInst[si] : 0, isLast) as string | undefined;
      const gF = g ? (isAccentLine(L.text) && g.fonts.accent ? g.fonts.accent : sec.type === "chorus" ? g.fonts.chorus : g.fonts.base) : undefined;
      const fid = F(P.font as string) ?? F(lk ? fontLines[lk] : undefined) ?? F(secF) ?? (gF ? resolveFont(gF) ?? resolveFont(g!.fonts.base) : undefined) ?? F(cfg.font);
      if (fid) P.font = fid; else delete P.font;
      const pal = { ...(g ? (sec.type === "chorus" && g.chorusPalette ? g.chorusPalette : g.palette) : {}), ...(cfg.palette ?? {}), ...((P.palette as any) ?? {}) };
      if (shot?.vis && cfg.fitVisual !== false) {
        const band = shot.vis.bands[shot.textY === undefined || shot.textY > 0.7 ? "bottom" : shot.textY < 0.3 ? "top" : "mid"];
        const rf = readableFill(band, (pal as any).fill ?? "#ffffff");
        if (rf.changed && !(cfg.palette?.fill)) { (pal as any).fill = rf.fill; (pal as any).stroke = rf.stroke; P.contrastWhy = `背景と文字のコントラスト不足→${rf.fill === "#ffffff" ? "白" : "黒"}文字（${rf.ratio.toFixed(1)}:1）`; }
      }
      if (shot?.textY !== undefined && P.textY === undefined) P.textY = shot.textY;
      if (Object.keys(pal).length) P.palette = pal;
    }
    const pos = new Map(L.chars.map((c, k) => [c.idx, k]));
    const hits = findKeywords(L.text, kw).map((h) => {
      const ks = [...Array(h.b - h.a).keys()].map((j) => pos.get(h.a + j)).filter((x) => x !== undefined) as number[];
      return ks.length ? { i0: ks[0], i1: ks[ks.length - 1] + 1, effect: h.effect, word: h.word } : null;
    }).filter(Boolean) as ResolvedLine["kw"];
    for (const [w, f] of Object.entries(cfg.fontKeywords ?? {})) {
      const fid = F(f); let from = 0, i: number;
      while ((i = L.text.indexOf(w, from)) >= 0) { const ks = [...Array(w.length).keys()].map((j) => pos.get(i + j)).filter((x) => x !== undefined) as number[];
        if (ks.length) hits.push({ i0: ks[0], i1: ks[ks.length - 1] + 1, effect: `font:${fid}`, word: w }); from = i + 1; }
    }
    return {
      ...L, li, style: name, params: P, source: src, section: sec.label, sectionType: sec.type, seed: li * 7919 + 13, kw: hits, hero, locked,
      lead: Number(P.lead ?? 0.12), exit: Number(P.exit ?? 0.3), tOn: 0, tOff: 0, tEnd: 0,
    };
  });
  // visibility window: appear `lead` before the first char, leave before the next line starts
  out.forEach((L, k) => {
    L.tOn = L.chars[0].t0 - L.lead;
    const nxt = out[k + 1] ? out[k + 1].chars[0].t0 - out[k + 1].lead : Infinity;
    const hold = Number(L.params.hold ?? 0.32);
    L.tOff = Math.max(Math.min(L.end + hold, nxt - L.exit * 0.6), L.chars[L.chars.length - 1].t0 + 0.15);
    L.tEnd = L.tOff + L.exit;
  });
  NOTES.set(out, plan.notes);
  return out;
}

export function styleSummary(lines: ResolvedLine[]): string {
  const c: Record<string, number> = {};
  lines.forEach((l) => (c[l.style] = (c[l.style] ?? 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(", ");
}
