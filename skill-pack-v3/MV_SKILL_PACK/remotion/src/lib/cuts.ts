// Beat-synced shot planning (1 bar / 2 / 1 / 1/2 / 1/4 beat or a single long take) with direction recipes.
import { beatLen, rng } from "./core";
import type { Preset, Beats } from "./presets";
import type { Section, Shot, Song } from "./types";
import { sectionEnergyRanks } from "./song";

export interface MediaItem { src: string; kind: "image" | "video"; duration?: number; scenes?: { start: number; end: number; score: number }[]; focus?: [number, number]; size?: [number, number]; face?: import("./types").FaceRig; vis?: import("./visual").VisFeat }
export interface PlanOpts { start?: number; end?: number; cutOverride?: Partial<Record<string, number>>; seed?: number }

/** snap t to the nearest grid point of `div` beats. */
export function snapToBeat(song: Song, t: number, div = 0.25): number {
  const B = beatLen(song) * div;
  return song.phase + Math.round((t - song.phase) / B) * B;
}

export function cutTimes(song: Song, a: number, b: number, beats: number): number[] {
  if (beats <= 0) return [a];
  const B = beatLen(song) * beats;
  const out = [a];
  let t = snapToBeat(song, a, Math.min(1, beats)) + B;
  while (t < b - B * 0.5) { if (t > a + 0.05) out.push(t); t += B; }
  return out;
}

export function sectionBeats(preset: Preset, sec: Section, instance: number, rank: number, override?: Partial<Record<string, number>>, isLast = false): number {
  const ov = override?.[sec.label] ?? (isLast ? override?.[`${sec.type}#last`] : undefined) ?? override?.[`${sec.type}#${instance + 1}`] ?? override?.[sec.type];
  if (ov !== undefined) return ov as Beats;
  let b: number = preset.cuts[sec.type] ?? 2;
  if (b > 0 && preset.recipes.chorusEscalation && sec.type === "chorus" && instance >= 1) b = Math.max(0.25, b / 2);
  if (b >= 1 && rank >= 0.9 && preset.id !== "firsttake") b = b / 2;
  if (b > 0 && preset.recipes.breathing && rank <= 0.1 && sec.type !== "chorus") b = Math.min(8, b * 2);
  return b as Beats;
}

export function planShots(song: Song, preset: Preset, media: MediaItem[], o: PlanOpts = {}): Shot[] {
  const start = o.start ?? 0, end = Math.min(o.end ?? song.duration, song.duration);
  const ranks = sectionEnergyRanks(song);
  const secs = song.sections.length ? song.sections : [{ label: "全体", type: "other" as const, start: 0, end: song.duration }];
  const inst: Record<string, number> = {};
  const r = rng("plan", o.seed ?? 1, song.title);
  const raw: { t: number; sec: Section; si: number; beats: number; kind?: "black" }[] = [];
  secs.forEach((sec, si) => {
    const k = inst[sec.type] ?? 0; inst[sec.type] = k + 1;
    const a = Math.max(start, sec.start), b = Math.min(end, sec.end);
    if (b - a < 0.05) return;
    const isLast = !secs.slice(si + 1).some((x) => x.type === sec.type);
    const beats = sectionBeats(preset, sec, k, ranks[si] ?? 0.5, o.cutOverride, isLast);
    if (beats === 0 && raw.length && raw[raw.length - 1].beats === 0) return; // long take continues
    let ts = cutTimes(song, a, b, beats);
    if (preset.id === "lipsync" && beats > 0) {
      for (const L of song.lines) if (L.start > a + 0.3 && L.start < b - 0.3) ts.push(snapToBeat(song, L.start, 0.25));
      ts = [...new Set(ts.map((x) => +x.toFixed(3)))].sort((x, y) => x - y).filter((x, i, arr) => i === 0 || x - arr[i - 1] > 0.35);
    }
    ts.forEach((t) => raw.push({ t, sec, si, beats }));
    // pre-chorus break: 1 beat hold to black right before the next chorus
    const nxt = secs[si + 1];
    if (preset.recipes.preChorusBreak && nxt?.type === "chorus" && sec.type !== "chorus" && nxt.start < end && b - a > beatLen(song) * 3) {
      const tb = nxt.start - beatLen(song) * 0.5;
      while (raw.length && raw[raw.length - 1].t >= tb - 0.05 && raw[raw.length - 1].sec === sec && raw.length > 1) raw.pop();
      raw.push({ t: tb, sec, si, beats, kind: "black" });
    }
  });
  if (!raw.length) raw.push({ t: start, sec: secs[0], si: 0, beats: 0 });
  raw[0].t = start;

  // media pool: videos expand into their scenes (best first)
  type Unit = { m: MediaItem; from: number; len: number; score: number };
  const units: Unit[] = [];
  for (const m of media) {
    if (m.kind === "video" && m.scenes?.length) [...m.scenes].sort((x, y) => y.score - x.score).forEach((s) => units.push({ m, from: s.start, len: s.end - s.start, score: s.score }));
    else units.push({ m, from: 0, len: m.duration ?? 9999, score: 0.5 });
  }
  const used = new Map<Unit, number>();
  let last: Unit | null = null;
  const pick = (need: number, sectionType: string, idx: number): Unit | null => {
    if (!units.length) return null;
    const cands = units.filter((u) => u !== last && (u.m.kind === "image" || u.len >= Math.min(need, 1)));
    const pool = cands.length ? cands : units;
    // least-used first, video scenes preferred in high-energy sections, deterministic tie-break
    const scored = pool.map((u) => ({ u, s: (used.get(u) ?? 0) * 10 - u.score * (sectionType === "chorus" ? 2 : 1) + r.next() * 0.5 + (idx === 0 ? 0 : 0) }));
    scored.sort((x, y) => x.s - y.s);
    const u = scored[0].u;
    used.set(u, (used.get(u) ?? 0) + 1);
    last = u;
    return u;
  };
  const hero = units.length ? [...units].sort((x, y) => y.score - x.score)[0] : null;
  const shots: Shot[] = [];
  const moveIdx: Record<string, number> = {};
  raw.forEach((c, i) => {
    const tEnd = raw[i + 1]?.t ?? end;
    if (tEnd - c.t < 0.04) return;
    const isSecStart = i === 0 || raw[i - 1].sec !== c.sec;
    const pool = preset.moves[c.sec.type] ?? ["kb_in"];
    const mi = (moveIdx[c.sec.type] = (moveIdx[c.sec.type] ?? -1) + 1);
    let u = c.kind === "black" ? null : pick(tEnd - c.t, c.sec.type, i);
    if (i === 0 && preset.recipes.coldOpen && hero) u = hero;
    const prev = shots[shots.length - 1];
    const move = c.kind === "black" ? "static" : pool[mi % pool.length];
    const shot: Shot = {
      id: `S${String(shots.length + 1).padStart(3, "0")}`, start: +c.t.toFixed(4), end: +tEnd.toFixed(4),
      src: u?.m.src ?? "", ...(u?.m.focus ? { focus: u.m.focus } : {}), ...(u?.m.size && u.m.kind === "image" ? { size: u.m.size } : {}), ...(u?.m.face && u.m.kind === "image" ? { face: u.m.face } : {}), ...(u?.m.vis ? { vis: u.m.vis } : {}), kind: c.kind === "black" || !u ? "image" : u.m.kind, move, section: c.sec.label, sectionType: c.sec.type,
      transition: c.kind === "black" ? "cut" : isSecStart ? preset.transitions[c.sec.type] ?? "cut" : "cut",
      grade: preset.grades[c.sec.type],
      ...(preset.ramps?.[c.sec.type] && c.kind !== "black" && tEnd - c.t >= 0.4 ? { ramp: preset.ramps[c.sec.type] } : {}),
    };
    if (c.kind === "black") shot.src = "";
    if (u && u.m.kind === "video") {
      const need = tEnd - c.t;
      shot.rate = c.sec.type === "bridge" || c.sec.type === "outro" ? (u.len >= need * 0.75 ? 0.75 : 1) : 1;
      const span = need * (shot.rate ?? 1);
      shot.clipFrom = +(u.from + Math.max(0, (u.len - span) / 2)).toFixed(3); // best moment: centre of the best scene
    }
    if (preset.recipes.matchCut && prev && prev.move === move && move.startsWith("kb_") && !isSecStart) shot.z0 = 1; // chain marker
    shots.push(shot);
  });
  // loop ending: final shot returns to the opening image with a reversed move
  if (preset.recipes.loopEnding && shots.length > 2 && shots[0].src) {
    const L = shots[shots.length - 1];
    L.src = shots[0].src; L.kind = shots[0].kind; L.clipFrom = shots[0].clipFrom; L.size = shots[0].size; L.face = shots[0].face; L.focus = shots[0].focus; L.move = shots[0].move === "kb_in" ? "kb_out" : "kb_in"; L.transition = "fade";
  }
  return shots;
}

/** thumbnail-worthy moments: first downbeat of each chorus (+half beat), else the loudest section start. */
export function thumbnailTimes(song: Song, n = 3): number[] {
  const ch = song.sections.filter((s) => s.type === "chorus").map((s) => s.start + beatLen(song) * 0.5);
  if (ch.length >= n) return ch.slice(0, n);
  const ranks = sectionEnergyRanks(song);
  const extra = song.sections.map((s, i) => ({ t: s.start + (s.end - s.start) * 0.4, r: ranks[i] ?? 0 })).sort((a, b) => b.r - a.r).map((x) => x.t);
  return [...ch, ...extra].slice(0, n);
}
