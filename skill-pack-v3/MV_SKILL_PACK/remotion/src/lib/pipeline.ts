import { resolveCamFx } from "./camfx";
// Pure pipeline: Song + config + media -> RenderProps (runs in Node scripts AND in Remotion Studio).
import { ASPECTS, type MVConfig } from "./config";
import { planShots, type MediaItem } from "./cuts";
import { PRESETS, autoPreset } from "./presets";
import { notesOf, resolveLines } from "./resolve";
import { HYBRIDS, HYBRID_IDS, applyHybrid, pickHybrid } from "./hybrids";
import { placeText } from "./visual";
import { review, type Review } from "./critic";
import type { RenderProps, Song } from "./types";
import { applyLipsync } from "./lipsync";

export function applyTiming(song: Song, cfg: MVConfig): Song {
  const T = cfg.timing ?? {};
  const s: Song = JSON.parse(JSON.stringify(song));
  if (T.bpm) s.bpm = T.bpm;
  if (T.beatShift) s.phase += T.beatShift;
  if (T.beatShiftBeats) s.phase += T.beatShiftBeats * (60 / s.bpm);
  if (T.sections?.length) s.sections = T.sections;
  s.lines = s.lines.map((L, i) => {
    const sec = s.sections.find((x) => L.start >= x.start && L.start < x.end);
    const inst = sec ? s.sections.filter((x) => x.type === sec.type).indexOf(sec) + 1 : 0;
    const ps = (sec && (T.perSection?.[sec.label] ?? T.perSection?.[`${sec.type}#${inst}`] ?? T.perSection?.[sec.type])) || {};
    const pl = T.perLine?.[String(i)] ?? {};
    const dIn = (T.lyricIn ?? 0) + (ps.lyricIn ?? 0), dOut = (T.lyricOut ?? 0) + (ps.lyricOut ?? 0);
    const shift = pl.start !== undefined ? pl.start - L.start : dIn;
    const n = { ...L, start: L.start + shift, end: (pl.end ?? L.end + dOut + (pl.start !== undefined ? 0 : 0)), chars: L.chars.map((c) => ({ ...c, t0: c.t0 + shift, t1: c.t1 + shift })), words: L.words.map((w) => ({ ...w, t: w.t + shift })) };
    if (pl.end === undefined && pl.start !== undefined) n.end = L.end + shift;
    return n;
  });
  return s;
}

export function analysisSummary(song: Song) {
  const e = song.energy;
  const mean = e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0.5;
  const secMeans = song.sections.map((s) => { const seg = e.slice(Math.floor(s.start * song.energyHz), Math.floor(s.end * song.energyHz)); return seg.length ? seg.reduce((a, b) => a + b, 0) / seg.length : mean; });
  return { bpm: song.bpm, energyMean: mean, energyContrast: secMeans.length ? Math.max(...secMeans) - Math.min(...secMeans) : 0, linesPerMin: song.lines.length / Math.max(1, song.duration / 60) };
}

export function pickPreset(song: Song, cfg: MVConfig, hasVideo: boolean) {
  if (cfg.preset && cfg.preset !== "auto" && PRESETS[cfg.preset]) return { preset: PRESETS[cfg.preset], why: "指定" };
  const g = cfg.genre && GENRES[cfg.genre];
  if (g && g.preset && PRESETS[g.preset]) return { preset: PRESETS[g.preset], why: `ジャンル「${g.ja}」から` };
  const a = autoPreset({ ...analysisSummary(song), hasVideo });
  return { preset: PRESETS[a.id], why: a.why };
}

import { resolvePuppet } from "./puppet";
import { GENRES, autoGenre } from "./genres";
/** genre recipe: explicit cfg.genre, or auto-detected when both genre and preset are left on auto. */
export function pickGenre(song: Song, cfg: MVConfig): { id: string | null; why: string; explicit: boolean } {
  const sel = cfg.lyrics?.genre ?? cfg.genre ?? "auto";
  if (sel === "none") return { id: null, why: "なし", explicit: true };
  if (sel !== "auto") { if (!GENRES[sel]) throw new Error(`ジャンル「${sel}」は未知です: ${Object.keys(GENRES).join(", ")}`); return { id: sel, why: "指定", explicit: true }; }
  if (cfg.preset && cfg.preset !== "auto") return { id: null, why: "プリセット指定のため自動ジャンルなし", explicit: false };
  return { ...autoGenre(song), explicit: false };
}
import { letterboxPx } from "./finish";
import { directPro, moodOf, proposeCombo } from "./mograph";
import { autoPartsPreset } from "./rig";
export function buildProps(song0: Song, cfg: MVConfig, media: MediaItem[], o: { overlayOnly?: boolean; audio?: string; aspect?: string } = {}): RenderProps & { presetWhy: string; genre?: string; genreWhy?: string; structure?: string; structureWhy?: string; sectionNotes?: string[]; review?: Review } {
  if (o.audio && /_lipsync\.(wav|mp3)$/i.test(o.audio)) throw new Error("口パク用に切り出した音声は最終ミックスに使えません（元の曲を1本だけ使います）");
  const song = applyTiming(song0, cfg);
  const { preset, why } = pickPreset(song, cfg, media.some((m) => m.kind === "video"));
  const asp = ASPECTS[(o.aspect ?? cfg.aspect ?? "16:9") as keyof typeof ASPECTS] ?? ASPECTS["16:9"];
  const sc = cfg.scale && (o.aspect ?? cfg.aspect ?? "16:9") === "16:9" ? cfg.scale : 1;
  const fps = cfg.fps ?? 30;
  const start = Math.max(0, cfg.range?.start ?? 0), end = Math.min(song.duration, cfg.range?.end ?? song.duration);
  // pro auto director (mood x section -> look / palette / transition / accents / cut length / lyric styles)
  const genre0 = pickGenre(song, cfg);
  const faceRatio0 = media.length ? media.filter((m) => m.face?.eyes?.length).length / media.length : 0;
  const proOn = cfg.pro !== false;
  const autoStruct = !cfg.structure || cfg.structure === "auto";
  const comboModes = cfg.combo?.length ? cfg.combo : proOn && autoStruct && !cfg.preset?.match(/^(story|dance|lipsync|live|firsttake|vocaloid)$/) ? proposeCombo(moodOf(genre0.id, song.bpm), faceRatio0, media.length) : null;
  const mog = proOn && !cfg.mograph?.off ? directPro(song, { genre: genre0.id, combo: comboModes, nMedia: media.length, faceRatio: faceRatio0, density: cfg.density, look: cfg.mograph?.look, palette: cfg.mograph?.palette, transition: cfg.mograph?.transition, seed: cfg.lyrics?.seed, accents: cfg.mograph?.accents }) : undefined;
  const cutOverride = cfg.cutBeats ?? (mog ? Object.fromEntries(mog.sections.map((s) => [s.label, s.cutBeats])) : undefined);
  let shots = planShots(song, preset, media, { start, end, cutOverride });
  // timing: cut lead (global / per section) + per-shot manual edits
  const T = cfg.timing ?? {};
  shots = shots.map((s, i) => {
    const ps = T.perSection?.[s.section ?? ""] ?? T.perSection?.[s.sectionType ?? ""] ?? {};
    const lead = (T.cutLead ?? 0.05) + (ps.cutLead ?? 0); // default: cut ~1.5 frames before the beat (reads as "on the beat")
    const m = T.perShot?.[s.id] ?? {};
    return { ...s, start: i === 0 ? s.start : Math.max(start, (m.start ?? s.start) - lead), end: (m.end ?? s.end) - (i === shots.length - 1 ? 0 : lead), ...(m.src ? { src: m.src, focus: undefined, kind: m.kind ?? (/\.(mp4|mov|webm)$/i.test(m.src) ? "video" : "image"), clipFrom: m.clipFrom ?? 0 } : {}), ...(m.move ? { move: m.move } : {}), ...(m.transition ? { transition: m.transition } : {}),
      ...(m.ramp ?? cfg.ramps?.[s.sectionType ?? ""] ?? cfg.ramps?.[s.section ?? ""] ?? cfg.ramps?.all ? { ramp: m.ramp ?? cfg.ramps?.[s.sectionType ?? ""] ?? cfg.ramps?.[s.section ?? ""] ?? cfg.ramps?.all } : {}),
      puppet: s.kind === "image" ? resolvePuppet(preset.puppet, cfg.puppet, cfg.puppetSections?.[s.sectionType ?? ""], cfg.puppetSections?.[s.section ?? ""], m.puppet) : undefined };
  });
  // hybrid structure (section -> shot role mix), chosen by fit unless the user named one
  const genre = pickGenre(song, cfg);
  const sel = cfg.structure ?? "auto";
  const faceRatio = media.length ? media.filter((m) => m.face?.eyes?.length).length / media.length : 0;
  const st = sel === "none" ? null : comboModes && (cfg.combo?.length || sel === "auto") && mog?.combo ? { id: mog.combo.id, why: `${HYBRIDS[mog.combo.id].ja}${cfg.combo?.length ? "（指定）" : "（自動提案）"}: ${mog.combo.notes.join("｜")}` } : sel === "auto" ? pickHybrid(genre.id, faceRatio, media.length) : HYBRIDS[sel] ? { id: sel, why: `${HYBRIDS[sel].ja}（指定）: ${HYBRIDS[sel].why}` } : (() => { throw new Error(`構成「${sel}」は未知です: ${HYBRID_IDS.join(", ")}`); })();
  shots.forEach((s) => { if (T.perShot?.[s.id]) s.locked = true; });
  if (st) shots = applyHybrid(shots, st.id, { keepMouth: cfg.puppet?.mouth !== undefined, pool: media.filter((m) => m.kind === "image").map((m) => ({ ...m })) });
  // lip-sync / dance takes: fixed on their audio window (respects extended/shifted in/out from the gen plan)
  const ls = Object.fromEntries(Object.entries(T.perShot ?? {}).filter(([, v]) => v?.lipsync).map(([k, v]) => [k, v!.lipsync]));
  let lipsyncNotes: string[] = [];
  if (Object.keys(ls).length) { const r = applyLipsync(shots, ls, fps); shots = r.shots; lipsyncNotes = r.notes; }
  // camera strength / beat sync / effects per shot (auto per section + mode; config and per-shot edits win)
  shots = shots.map((s) => { const m: any = T.perShot?.[s.id] ?? {}; const c = resolveCamFx((cfg as any).camfx, s, { ...(m.camStrength ? { camStrength: m.camStrength } : {}), ...(m.camSync ? { camSync: m.camSync } : {}), ...(m.fx ? { fx: m.fx } : {}) }); return { ...s, ...(c.move && !m.move ? { move: c.move } : {}), camStrength: c.camStrength, camSync: c.camSync, fx: c.fx }; });
  const lyricCfg = { ...(preset.lyric ?? {}), ...(cfg.lyrics ?? {}), sections: { ...(preset.lyric.sections ?? {}), ...(cfg.lyrics?.sections ?? {}), ...(cfg.sectionStyles ?? {}) } };
  if (cfg.lyrics?.default === undefined && preset.lyric.default !== undefined) lyricCfg.default = preset.lyric.default;
  if (genre.id) { // genre recipe drives auto styles: drop the preset's lyric table (user tables stay)
    (lyricCfg as any).genre = genre.id;
    lyricCfg.sections = { ...(cfg.lyrics?.sections ?? {}), ...(cfg.sectionStyles ?? {}) };
    if (cfg.lyrics?.default === undefined) lyricCfg.default = "auto";
  }
  if (mog) { // lyric styles follow the director (user tables / explicit styles still win)
    if ((lyricCfg as any).pro === undefined) (lyricCfg as any).pro = true;
    const tm = mog.combo?.textMode ?? {};
    (lyricCfg as any).prefer = { ...Object.fromEntries(mog.sections.map((s) => [s.label, tm[s.type] === "typo" ? ["pro_crop", "pro_smash", ...s.lyricPrefer] : s.lyricPrefer])), ...((lyricCfg as any).prefer ?? {}) };
  }
  const userY = (lyricCfg as any).textY !== undefined || (lyricCfg as any).textYShift !== undefined || lyricCfg.position !== undefined;
  const defY = Math.max(0.1, Math.min(1 - asp.safeBottom, (lyricCfg as any).textY ?? ((preset.id === "vocaloid" && asp.h > asp.w ? 0.55 : preset.id === "vocaloid" ? preset.textY : Math.min(asp.textY, preset.textY + (asp.textY - 0.84))) + ((lyricCfg as any).textYShift ?? 0))));
  const lbFrac = letterboxPx({ ...preset.finish, ...(cfg.finish ?? {}) }, asp.w, asp.h) / asp.h;
  if (!userY) for (const s of shots) if (s.vis || s.face) { const pl = placeText(s.vis, s.face, defY); if (pl.band !== "bottom") { s.textY = pl.band === "top" ? Math.max(pl.textY, lbFrac + 0.08) : pl.textY; s.textWhy = pl.why; } }
  const allLines = resolveLines(song, lyricCfg, shots);
  const lines = allLines.filter((L) => L.tEnd > start && L.tOn < end);
  if (mog && !cfg.lyrics?.palette) for (const L of lines) { // section palette: full on solid (graphics) shots, accent only over pictures
    const ms = mog.sections.find((s) => L.start >= s.start && L.start < s.end); if (!ms) continue;
    const sh = shots.find((s) => L.start >= s.start && L.start < s.end);
    const solid = mog.solo || ["typo", "mograph"].includes(sh?.role ?? "");
    if (solid && sh?.role === "typo" && /^pro_/.test(L.style) && L.params.size === undefined) L.params.size = 1.7; // full-screen typography: text is the picture
    L.params.palette = solid ? { fill: ms.palette.fg, stroke: ms.palette.bg, accent: ms.palette.accent } : { ...(L.params.palette ?? {}), accent: ms.palette.accent };
  }
  // loop ending recipe: keep the last second clean (lyrics finish their exit 1 s before the end)
  if (preset.recipes.loopEnding && end >= song.duration - 0.05) for (const L of lines) if (L.tEnd > end - 1) { L.tOff = Math.max(L.tOn + 0.2, end - 1 - L.exit); L.tEnd = L.tOff + L.exit; }
  const props: RenderProps & { presetWhy: string; genre?: string; genreWhy?: string; structure?: string; structureWhy?: string; sectionNotes?: string[]; review?: Review } = {
    width: asp.w * sc, height: asp.h * sc, fps, durationInFrames: Math.max(1, Math.round((end - start) * fps)), startAt: start,
    audio: o.audio, lines, shots, beat: { bpm: song.bpm, phase: song.phase, beatsPerBar: song.beatsPerBar },
    grade: preset.grades.verse, shake: cfg.shake ?? preset.shake, leaks: cfg.leaks ?? preset.leaks, particles: cfg.particles ?? preset.particles,
    overlayOnly: !!o.overlayOnly, textSize: lyricCfg.size ?? preset.textSize ?? 1, textY: defY,
    safeBottom: asp.safeBottom, preset: preset.id, presetWhy: why, genre: genre.id ?? undefined, genreWhy: genre.why,
    energy: downsample(song.energy, song.energyHz, 10), energyHz: song.energy.length ? 10 : 0,
    effectRanges: (cfg as any).camfx?.ranges, accents: (cfg as any).mograph?.accents?.length && typeof (cfg as any).mograph.accents[0] === "number" ? (cfg as any).mograph.accents : undefined,
    visuals: { ...preset.visuals, ...(cfg.visuals ?? {}) }, ...(mog ? { mograph: mog } : {}), finish: { ...preset.finish, ...(cfg.finish ?? {}) },
  };
  const lb = letterboxPx(props.finish, props.width, props.height);
  if (lb > 0 && (lyricCfg as any).textY === undefined) props.textY = 1 - (lb / props.height) * 0.42; // subtitles live in the lower bar
  props.structure = st?.id; props.structureWhy = st?.why ?? "構成なし（素材を順に使う）";
  props.sectionNotes = notesOf(allLines).map((n) => n.why);
  if (cfg.parts?.rigData && !cfg.parts.off) { // parts animation: preset per section (おまかせ = by section type + energy)
    const ranks = song.sections.map((s) => { const a = Math.floor(s.start * song.energyHz), b = Math.max(a + 1, Math.floor(s.end * song.energyHz)); const v = song.energy.slice(a, b); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0.5; });
    const pr = cfg.parts.preset;
    props.parts = { rig: cfg.parts.rigData, x: cfg.parts.x, h: cfg.parts.h, segments: (song.sections.length ? song.sections : [{ label: "全体", type: "other" as const, start: 0, end: song.duration }]).map((s, i) => {
      const want = typeof pr === "string" ? pr : pr?.[s.label] ?? pr?.[s.type] ?? "auto";
      return { start: s.start, end: s.end, type: s.type, energy: ranks[i] ?? 0.5, preset: want === "auto" ? autoPartsPreset(s.type, ranks[i] ?? 0.5) : want }; }) };
  }
  if (props.parts) { const right = (props.parts.x ?? 0.5) < 0.5; for (const L of lines) if (L.params.anchor === undefined && /^pro_/.test(L.style)) L.params.anchor = (right ? [2, 5, 8] : [0, 3, 6])[L.li % 3]; } // keep lyrics off the character
  if (mog) (props as any).mographNotes = mog.sections.map((s) => s.why);
  (props as any).lipsyncNotes = lipsyncNotes;
  if (cfg.critic !== false) {
    const calm = !!genre.id && ["ballad", "acoustic", "ambient"].includes(genre.id) || song.bpm < 90;
    const rv = review({ shots, lines, beat: props.beat, genre: genre.id, calm, textY: props.textY, movesAlt: [...new Set(Object.values(preset.moves).flat())] });
    if (st && shots.some((s) => s.role === "lipsync" || s.role === "performance") && faceRatio === 0) rv.issues.push({ rule: "faces", fixed: false, msg: "歌唱カットがありますが、顔が見つかった画像がありません。npm run faces で目と口を指定するか、顔のアップの画像を足すと口パクが入ります" });
    rv.note = rv.note.replace(/- 提案: なし（チェック項目すべてクリア）/, rv.issues.some((x) => !x.fixed) ? "" : "$&");
    if (rv.issues.some((x) => x.rule === "faces")) rv.note += "\n  - 歌唱カットがありますが、顔が見つかった画像がありません。npm run faces で目と口を指定すると口パクが入ります";
    props.review = rv;
  }
  return props;

}

function downsample(e: number[], hz: number, to: number): number[] {
  if (!e.length || !hz) return [];
  const k = Math.max(1, Math.round(hz / to)), out: number[] = [];
  for (let i = 0; i < e.length; i += k) { let m = 0; for (let j = i; j < Math.min(e.length, i + k); j++) m = Math.max(m, e[j]); out.push(+m.toFixed(3)); }
  return out;
}
