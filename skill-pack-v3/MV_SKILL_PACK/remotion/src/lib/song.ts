// Song intake: the lyric-sync JSON (schemaVersion 1.0), SRT and LRC -> Song.
import type { LyricLine, Section, SectionType, Song, Char, Word } from "./types";

const SECTION_WORDS: [RegExp, SectionType][] = [
  [/^(ラスサビ|サビ|chorus|chors|hook|コーラス)/i, "chorus"],
  [/^(pre[-_ ]?cho|プレサビ|bメロ|b-?melo)/i, "pre_chorus"],
  [/^(aメロ|verse|vers|a-?melo)/i, "verse"],
  [/^(cメロ|bridge|間奏|ブリッジ|interlude|inst)/i, "bridge"],
  [/^(intro|イントロ)/i, "intro"],
  [/^(outro|outlo|アウトロ|ending|エンディング)/i, "outro"],
];
export function sectionTypeOf(label: string, hint?: string): SectionType {
  const types: SectionType[] = ["intro", "verse", "pre_chorus", "chorus", "bridge", "outro", "other"];
  if (hint && (types as string[]).includes(hint)) return hint as SectionType;
  const l = String(label ?? "").normalize("NFKC").replace(/[【】\[\]]/g, "").trim();
  for (const [re, t] of SECTION_WORDS) if (re.test(l)) return t;
  return "other";
}

const strip = (s: string) => s.replace(/\s+/g, "");

/** Per-character onset/offset. Uses word timings when the words spell the line, else maps proportionally. */
export function charTimes(text: string, start: number, end: number, words?: { text: string; start: number; end: number }[]): { chars: Char[]; words: Word[] } {
  const idx: number[] = [];
  [...text].forEach((c, i) => { if (!/\s/.test(c)) idx.push(i); });
  const glyphs = [...text];
  const n = idx.length;
  const chars: Char[] = [];
  const outWords: Word[] = [];
  const ws = (words ?? []).filter((w) => w.text && w.end >= w.start);
  if (ws.length && strip(ws.map((w) => w.text).join("")) === strip(text)) {
    let k = 0;
    for (const w of ws) {
      const m = [...strip(w.text)].length;
      const d = Math.max(0, w.end - w.start);
      const i0 = chars.length;
      for (let j = 0; j < m && k < n; j++, k++) {
        const t0 = w.start + (d * j) / m;
        chars.push({ ch: glyphs[idx[k]], idx: idx[k], t0, t1: Math.max(t0 + 0.05, w.start + (d * (j + 1)) / m) });
      }
      if (chars.length > i0) outWords.push({ i0, i1: chars.length, t: chars[i0].t0 });
    }
  } else {
    // proportional: when words exist (e.g. readings differ), use their overall time span weighting
    const tl: [number, number][] = ws.length ? ws.map((w) => [w.start, w.end]) : [[start, end]];
    const tot = tl.reduce((a, [s, e]) => a + Math.max(0.01, e - s), 0);
    const at = (f: number) => {
      let acc = 0;
      for (const [s, e] of tl) {
        const d = Math.max(0.01, e - s);
        if (acc + d >= f * tot) return s + (f * tot - acc);
        acc += d;
      }
      return tl[tl.length - 1][1];
    };
    for (let k = 0; k < n; k++) {
      const t0 = at(k / n), t1 = at((k + 1) / n);
      chars.push({ ch: glyphs[idx[k]], idx: idx[k], t0, t1: Math.max(t1, t0 + 0.05) });
    }
  }
  for (let k = 1; k < chars.length; k++) chars[k].t0 = Math.max(chars[k].t0, chars[k - 1].t0);
  if (!outWords.length) outWords.push(...autoWords(text, chars));
  return { chars, words: outWords };
}

/** words from spaces, else chunks of <=4 chars broken at script changes (kanji/kana/latin). */
export function autoWords(text: string, chars: Char[]): Word[] {
  const out: Word[] = [];
  const script = (c: string) => (/[\u4e00-\u9fff々]/.test(c) ? "k" : /[\u3040-\u309f]/.test(c) ? "h" : /[\u30a0-\u30ff]/.test(c) ? "K" : "l");
  let i0 = 0;
  for (let i = 1; i <= chars.length; i++) {
    const spaceBreak = i < chars.length && /\s/.test(text.slice(chars[i - 1].idx + 1, chars[i].idx));
    const len = i - i0;
    const scriptBreak = i < chars.length && script(chars[i].ch) === "k" && script(chars[i - 1].ch) !== "k" && len >= 2;
    if (i === chars.length || spaceBreak || len >= 4 || scriptBreak) {
      out.push({ i0, i1: i, t: chars[i0].t0 });
      i0 = i;
    }
  }
  return out;
}

function mkLine(text: string, start: number, end: number, words?: { text: string; start: number; end: number }[]): LyricLine | null {
  text = String(text ?? "").replace(/【.*?】/g, "").trim();
  if (!text) return null;
  const { chars, words: w } = charTimes(text, start, end, words);
  if (!chars.length) return null;
  return { text, start, end, chars, words: w };
}

export function parseSrt(src: string): LyricLine[] {
  const out: LyricLine[] = [];
  const ts = (s: string) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +`0.${m[4]}` : 0; };
  for (const block of src.replace(/\r/g, "").split(/\n\s*\n/)) {
    const ls = block.split("\n").filter(Boolean);
    const ti = ls.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = ls[ti].split("-->");
    const L = mkLine(ls.slice(ti + 1).join(" "), ts(a), ts(b));
    if (L) out.push(L);
  }
  return out;
}

export function parseLrc(src: string, duration = 0): LyricLine[] {
  const rows: { t: number; text: string }[] = [];
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, "").replace(/<\d+:\d+(?:\.\d+)?>/g, "").trim();
    for (const m of tags) rows.push({ t: +m[1] * 60 + +m[2], text });
  }
  rows.sort((a, b) => a.t - b.t);
  const out: LyricLine[] = [];
  rows.forEach((r, i) => {
    const nxt = rows[i + 1]?.t ?? (duration || r.t + 4);
    const L = mkLine(r.text, r.t, Math.min(nxt - 0.05, r.t + 6));
    if (L) out.push(L);
  });
  return out;
}

/** downsample + normalise energy to 0..1 at `hz`. */
function normEnergy(e: number[], srcHz: number, hz = 20): number[] {
  if (!e?.length) return [];
  const step = Math.max(1, Math.round(srcHz / hz));
  const out: number[] = [];
  for (let i = 0; i < e.length; i += step) {
    let s = 0, c = 0;
    for (let j = i; j < Math.min(e.length, i + step); j++) { s += Math.abs(e[j]); c++; }
    out.push(s / c);
  }
  const sorted = [...out].sort((a, b) => a - b);
  const hi = sorted[Math.floor(sorted.length * 0.98)] || 1;
  return out.map((v) => Math.min(1, v / hi));
}

export function parseLyricJson(d: any, fallbackTitle = "song"): Song {
  if (!d || !Array.isArray(d.lyrics)) throw new Error("歌詞JSONに lyrics 配列がありません。歌詞同期ツールの書き出し（schemaVersion 1.0）か SRT / LRC を使ってください。");
  const duration = Number(d.audio?.duration ?? 0) || Math.max(...d.lyrics.map((l: any) => +l.end || 0)) + 2;
  const lines = d.lyrics
    .map((l: any) => mkLine(l.text, +l.start, +l.end, (l.words ?? []).map((w: any) => ({ text: w.text, start: +(w.startSeconds ?? w.start), end: +(w.endSeconds ?? w.end) }))))
    .filter(Boolean) as LyricLine[];
  lines.sort((a, b) => a.start - b.start);
  const a = d.analysis ?? {};
  const secs: Section[] = (d.sections ?? a.sections ?? []).map((s: any) => ({
    label: String(s.label ?? s.originalLabel ?? ""), type: sectionTypeOf(s.label ?? "", s.normalizedType), start: +s.start, end: +s.end,
  }));
  const energyRaw: number[] = a.energy ?? [];
  const srcHz = energyRaw.length && duration ? energyRaw.length / duration : 20;
  const markers: any[] = a.markers ?? [];
  const downbeats = markers.filter((m) => m.type === "downbeat").map((m) => +m.time);
  const bpm = Number(a.bpm ?? d.bpm ?? d.audio?.bpm) || 120;
  return {
    title: String(d.projectName ?? fallbackTitle), duration, fps: Number(d.fps) || 30, bpm,
    phase: downbeats[0] ?? 0, beatsPerBar: Number(a.beatsPerBar) || 4,
    sections: secs.length ? secs : defaultSections(duration), energy: normEnergy(energyRaw, srcHz), energyHz: energyRaw.length ? 20 : 0,
    lines, downbeats,
  };
}

export function defaultSections(duration: number): Section[] {
  return [{ label: "全体", type: "other", start: 0, end: duration }];
}

/** Any supported lyric file -> Song. */
export function parseLyricsFile(name: string, content: string, opts: { duration?: number; bpm?: number } = {}): Song {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) {
    let d: any;
    try { d = JSON.parse(content.replace(/^\uFEFF/, "")); } catch (e) { throw new Error(`歌詞JSON「${name}」が壊れています（JSONとして読めません）: ${(e as Error).message}`); }
    const s = parseLyricJson(d, name.replace(/\.[^.]+$/, ""));
    if (opts.bpm) s.bpm = opts.bpm;
    return s;
  }
  const lines = lower.endsWith(".lrc") ? parseLrc(content, opts.duration) : parseSrt(content);
  if (!lines.length) throw new Error(`歌詞ファイル「${name}」から歌詞を1行も読めませんでした。SRT(00:00:01,000 --> ...) か LRC([00:01.00]歌詞) 形式か確認してください。`);
  const duration = opts.duration || lines[lines.length - 1].end + 3;
  return { title: name.replace(/\.[^.]+$/, ""), duration, fps: 30, bpm: opts.bpm || 120, phase: 0, beatsPerBar: 4, sections: defaultSections(duration), energy: [], energyHz: 0, lines };
}

export function energyAt(song: Song, t: number): number {
  if (!song.energy.length || !song.energyHz) return 0.5;
  return song.energy[Math.max(0, Math.min(song.energy.length - 1, Math.floor(t * song.energyHz)))];
}
export function sectionAt(sections: Section[], t: number): Section {
  for (const s of sections) if (t >= s.start - 1e-6 && t < s.end) return s;
  return sections.length && t >= sections[sections.length - 1].end ? sections[sections.length - 1] : { label: "", type: "other", start: 0, end: 0 };
}
/** mean energy per section -> rank 0..1 (0 = quietest). */
export function sectionEnergyRanks(song: Song): number[] {
  const S = song.sections;
  if (!S.length) return [];
  if (!song.energy.length) return S.map(() => 0.5);
  const means = S.map((s) => {
    const a = Math.floor(s.start * song.energyHz), b = Math.max(a + 1, Math.floor(s.end * song.energyHz));
    const seg = song.energy.slice(a, b);
    return seg.length ? seg.reduce((x, y) => x + y, 0) / seg.length : 0;
  });
  const order = means.map((_, i) => i).sort((i, j) => means[i] - means[j]);
  const ranks = new Array(S.length).fill(0);
  order.forEach((i, r) => (ranks[i] = r / Math.max(1, S.length - 1)));
  return ranks;
}
