// Hybrid MV structures: genres of MV mixed per section (e.g. story in the verses, singing close-ups in the chorus).
// A template = per section type, a ratio mix of shot ROLES. Roles decide camera move, which image fits (face or not),
// mouth flap, grade and the generation prompt. Auto-chosen by fit (genre, faces available, energy); selectable in Japanese.
import type { Shot } from "./types";

export interface Role { ja: string; moves: string[]; wantsFace?: boolean | null; mouth?: boolean; transition?: string; prompt: string; desat?: boolean; lyricHero?: boolean }
export const ROLES: Record<string, Role> = {
  lipsync: { ja: "歌唱（リップシンク）", moves: ["face_push", "slow_push", "kb_in"], wantsFace: true, mouth: true, prompt: "close-up of the singer singing to camera, mouth clearly visible, shallow depth of field" },
  story: { ja: "ストーリー", moves: ["kb_in", "drift_l", "parallax", "kb_out", "drift_r"], wantsFace: null, prompt: "cinematic story scene, wide shot, the protagonist in the setting, natural action" },
  dance: { ja: "ダンス", moves: ["zoom_punch", "whip_l", "push", "whip_r"], wantsFace: null, prompt: "full-body dance shot, dynamic pose on the beat, motion blur on hands" },
  lyric: { ja: "リリック（文字主役）", moves: ["slow_push", "drift_r"], wantsFace: false, lyricHero: true, prompt: "minimal background with empty negative space for typography, soft texture" },
  live: { ja: "ライブ", moves: ["shake", "crane_up", "push"], wantsFace: null, prompt: "live performance on stage, backlight haze, crowd silhouettes, handheld feel" },
  flashback: { ja: "回想", moves: ["kb_out", "drift_l"], wantsFace: null, desat: true, transition: "fade", prompt: "faded memory flashback, warm desaturated film look, soft focus" },
  performance: { ja: "演奏・歌唱（固定）", moves: ["slow_push", "static"], wantsFace: true, mouth: true, prompt: "locked-off medium shot of the performer with microphone, plain backdrop, studio light" },
  cutaway: { ja: "カットアウェイ（情景）", moves: ["drift_r", "kb_in"], wantsFace: false, prompt: "atmospheric cutaway: hands, objects, sky, city details related to the lyric" },
  narrative: { ja: "ドラマパート", moves: ["parallax", "kb_in", "drift_l"], wantsFace: null, prompt: "dramatic narrative moment, two characters, motivated lighting" },
  oneshot: { ja: "ワンカット", moves: ["slow_push"], wantsFace: null, prompt: "single continuous take, slow dolly forward, the singer walks and sings" },
  insert: { ja: "インサート", moves: ["push", "drift_l"], wantsFace: false, prompt: "quick insert detail shot (object / texture) that echoes the lyric" },
  concept: { ja: "コンセプト映像", moves: ["parallax", "kb_out"], wantsFace: false, prompt: "abstract concept visual, symbolic imagery, strong graphic composition" },
};
type Mix = Partial<Record<string, number>>;
export interface Hybrid { ja: string; words: RegExp; sections: Partial<Record<string, Mix>>; other: Mix; genres: string[]; needsFaces?: boolean; why: string }
const H = (ja: string, words: RegExp, genres: string[], other: Mix, sections: Hybrid["sections"], why: string, needsFaces = false): Hybrid => ({ ja, words, genres, other, sections, why, needsFaces });
export const HYBRIDS: Record<string, Hybrid> = {
  story_lipsync: H("ストーリー＋リップシンク", /ストーリー.?[＋+と].?リップ|リップ.?[＋+と].?ストーリー/, ["ballad", "citypop_jazz", "dark", "idol_pop"], { story: 1 },
    { verse: { story: 1 }, pre_chorus: { story: 0.7, lipsync: 0.3 }, chorus: { lipsync: 0.7, story: 0.3 }, bridge: { story: 1 } }, "Aメロで物語を見せ、サビは歌う顔に寄って感情を受け止める", true),
  chorus_sing: H("サビだけ歌うシーン", /サビだけ歌|サビ.?だけ.?リップ|サビで歌う/, ["ballad", "acoustic", "dark", "citypop_jazz"], { story: 1 },
    { chorus: { lipsync: 1 } }, "歌唱はサビまで温存→サビの解放感が強くなる", true),
  story_dance: H("ストーリー＋ダンス", /ストーリー.?[＋+と].?ダンス|ダンス.?[＋+と].?ストーリー/, ["idol_pop", "rock_edm", "hiphop"], { story: 1 },
    { chorus: { dance: 0.7, story: 0.3 }, pre_chorus: { story: 0.6, dance: 0.4 } }, "物語はAメロ、サビはダンスで爆発させる"),
  lipsync_lyric: H("リップシンク＋リリックPV", /リップ.?[＋+と].?(リリック|文字)|(リリック|文字).?[＋+と].?リップ/, ["idol_pop", "dark", "citypop_jazz"], { lyric: 0.6, lipsync: 0.4 },
    { verse: { lyric: 0.6, lipsync: 0.4 }, chorus: { lipsync: 0.5, lyric: 0.5 } }, "文字で言葉を届け、要所で歌う顔を挟む", true),
  live_flashback: H("ライブ＋回想", /ライブ.?[＋+と].?(回想|ストーリー)|回想/, ["rock_edm", "ballad", "hiphop"], { live: 0.7, flashback: 0.3 },
    { verse: { live: 0.6, flashback: 0.4 }, chorus: { live: 0.8, flashback: 0.2 }, bridge: { flashback: 1 } }, "ライブの熱量に回想を差し込み、ブリッジで過去へ潜る"),
  firsttake_cutaway: H("一発撮り＋情景カット", /(一発撮り|first\s*take|ファーストテイク).?[＋+と]|情景(カット|を挟)/i, ["acoustic", "ballad", "ambient"], { performance: 1 },
    { verse: { performance: 0.85, cutaway: 0.15 }, chorus: { performance: 0.7, cutaway: 0.3 }, bridge: { cutaway: 0.6, performance: 0.4 } }, "歌い手を固定で見せ、言葉に合う情景だけを短く挟む", true),
  dance_typo: H("ダンス＋タイポグラフィ", /ダンス.?[＋+と].?(タイポ|文字|リリック)/, ["hiphop", "idol_pop", "rock_edm"], { dance: 0.5, lyric: 0.5 },
    { verse: { lyric: 0.5, dance: 0.5 }, chorus: { dance: 0.7, lyric: 0.3 } }, "体の動きと文字の動きを交互に見せてリズムを作る"),
  perf_narrative: H("演奏×ドラマのインターカット", /(演奏|パフォーマンス).?[×x＋+と].?(ドラマ|物語|ストーリー)|インターカット/, ["rock_edm", "hiphop", "dark", "ballad"], { performance: 0.5, narrative: 0.5 },
    { verse: { narrative: 0.6, performance: 0.4 }, chorus: { performance: 0.7, narrative: 0.3 }, bridge: { narrative: 1 } }, "演奏と物語を行き来させ、サビは演奏で畳みかける", true),
  oneshot_inserts: H("ワンカット＋インサート", /ワンカット|長回し/, ["acoustic", "ambient", "ballad"], { oneshot: 0.85, insert: 0.15 },
    { chorus: { oneshot: 0.8, insert: 0.2 } }, "長回しの緊張感を保ち、言葉の要所だけ一瞬差し込む"),
  lyric_story: H("リリックPV＋ストーリー", /(リリック|文字).?[＋+と].?ストーリー|ストーリー.?[＋+と].?(リリック|文字)/, ["ballad", "citypop_jazz", "wa", "ambient", "dark"], { lyric: 0.7, story: 0.3 },
    { verse: { lyric: 0.7, story: 0.3 }, chorus: { story: 0.5, lyric: 0.5 } }, "文字主体で読ませ、サビで物語の画を開く"),
  concept_performance: H("コンセプト映像＋歌唱", /コンセプト.?[＋+と]|アート.?[＋+と].?歌/, ["dark", "ambient", "rock_edm", "wa"], { concept: 0.6, performance: 0.4 },
    { verse: { concept: 0.7, performance: 0.3 }, chorus: { performance: 0.6, concept: 0.4 } }, "象徴的なイメージで世界観を作り、サビは歌い手で締める", true),
  dance_lipsync: H("リップシンク＋サビダンス", /サビ.?(で|は).?ダンス|リップ.?[＋+と].?ダンス/, ["idol_pop", "hiphop"], { lipsync: 1 },
    { verse: { lipsync: 0.7, story: 0.3 }, chorus: { dance: 0.8, lipsync: 0.2 } }, "Aメロは歌で引きつけ、サビは全身のダンスで見せる", true),
};
export const HYBRID_IDS = Object.keys(HYBRIDS);
export const hybridFromText = (t: string) => HYBRID_IDS.find((k) => HYBRIDS[k].words.test(t) || t.includes(HYBRIDS[k].ja));

/** fit score of a hybrid for this song + media. */
export function pickHybrid(genre: string | null | undefined, faceRatio: number, nMedia: number): { id: string; why: string } {
  const sc = HYBRID_IDS.map((id) => {
    const h = HYBRIDS[id]; let s = 0; const w: string[] = [];
    if (genre && h.genres.includes(genre)) { s += 2 - h.genres.indexOf(genre) * 0.2; w.push("ジャンルに合う"); }
    if (h.needsFaces) { if (faceRatio < 0.15) s -= 5; else { s += faceRatio; w.push("顔のある画像がある"); } }
    else if (faceRatio < 0.15) { s += 0.6; w.push("顔なし素材でも成立"); }
    if (nMedia < 4 && /oneshot|firsttake/.test(id)) { s += 0.5; w.push("素材が少なくても成立"); }
    return { id, s, w };
  }).sort((a, b) => b.s - a.s);
  const b = sc[0];
  return { id: b.id, why: `${HYBRIDS[b.id].ja}: ${HYBRIDS[b.id].why}（${b.w.join("・") || "汎用"}）` };
}

/** largest-remainder interleave: n shots, mix {a:.7,b:.3} -> evenly intercut role list (deterministic). */
export function distribute(n: number, mix: Mix): string[] {
  const ent = Object.entries(mix).filter(([, v]) => (v ?? 0) > 0) as [string, number][];
  const tot = ent.reduce((a, [, v]) => a + v, 0) || 1;
  const acc = Object.fromEntries(ent.map(([k]) => [k, 0]));
  const out: string[] = [];
  for (let i = 0; i < n; i++) { for (const [k, v] of ent) acc[k] += v / tot; const k = Object.keys(acc).sort((a, b) => acc[b] - acc[a])[0]; acc[k] -= 1; out.push(k); }
  return out;
}

/** assign roles to shots, pick fitting media (face / no face), moves and prompts. User-locked shots keep their edits. */
export function applyHybrid(shots: Shot[], id: string, opts: { keepMouth?: boolean; pool?: { src: string; kind: string; face?: any; size?: any; focus?: any; vis?: any }[] } = {}): Shot[] {
  const h = HYBRIDS[id]; if (!h) return shots;
  const bySec = new Map<string, Shot[]>();
  shots.forEach((s) => { const k = `${s.section}|${s.sectionType}`; if (!bySec.has(k)) bySec.set(k, []); bySec.get(k)!.push(s); });
  const moveIdx: Record<string, number> = {};
  for (const list of bySec.values()) {
    const live = list.filter((s) => s.src);
    const roles = distribute(live.length, h.sections[live[0]?.sectionType ?? "other"] ?? h.other);
    live.forEach((s, i) => {
      const role = ROLES[roles[i]];
      s.role = roles[i];
      if (s.locked) return;
      const prev = shots[shots.indexOf(s) - 1];
      let mi = (moveIdx[roles[i]] = (moveIdx[roles[i]] ?? -1) + 1);
      let mv = role.moves[mi % role.moves.length];
      if (prev && prev.move === mv && role.moves.length > 1) mv = role.moves[++mi % role.moves.length], (moveIdx[roles[i]] = mi);
      s.move = mv;
      if (role.transition && (i === 0 || roles[i - 1] !== roles[i])) s.transition = role.transition;
      if (role.desat) s.grade = { ...(s.grade ?? { name: "none", filter: "none", vignette: 0.3, grain: 0 }), name: "flashback", filter: "saturate(0.45) sepia(0.25) brightness(1.03)", grain: 0.25 };
      s.prompt = `${role.prompt}${s.prompt ? ` — ${s.prompt}` : ""}`;
      if (s.puppet && !opts.keepMouth) s.puppet = { ...s.puppet, mouth: role.mouth ? Math.max(s.puppet.mouth, 1) : 0 };
      // media fit: lip-sync wants an image with a detected face, lyric/cutaway want one without
      const hasFace = !!s.face?.eyes?.length;
      if (role.wantsFace != null && hasFace !== role.wantsFace && opts.pool?.length) {
        const ok = opts.pool.filter((m) => !!m.face?.eyes?.length === role.wantsFace && m.kind === "image");
        const alt = ok.find((m) => m.src !== prev?.src) ?? ok[0];
        if (alt) Object.assign(s, { src: alt.src, kind: "image", face: alt.face, size: alt.size, focus: alt.focus, vis: alt.vis, clipFrom: undefined });
      }
    });
  }
  return shots;
}
