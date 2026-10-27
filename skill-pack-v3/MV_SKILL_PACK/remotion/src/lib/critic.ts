// Pro QA critic: reviews the plan against a checklist of amateur red flags, fixes what was auto-chosen,
// and only SUGGESTS for anything the user locked (manual edits are never silently overridden).
import { beatLen } from "./core";
import { CATALOG } from "./catalog";
import { minOnScreen } from "./direction";
import { trait } from "./traits";
import { faceOverlap } from "./visual";
import type { ResolvedLine, Shot } from "./types";

export interface Issue { rule: string; fixed: boolean; msg: string; at?: string }
export interface Review { issues: Issue[]; note: string; score: number }
export interface CriticIn { shots: Shot[]; lines: ResolvedLine[]; beat: { bpm: number; phase: number }; genre?: string | null; calm?: boolean; textY: number; movesAlt?: string[] }

const SEC_JA: Record<string, string> = { intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", bridge: "Cメロ", outro: "アウトロ", other: "間奏" };
const MOVE_JA: Record<string, string> = { kb_in: "ゆっくり寄り", kb_out: "ゆっくり引き", push: "プッシュイン", face_push: "顔に寄る", slow_push: "じわ寄り", zoom_punch: "ズームパンチ", whip_l: "ホイップ", whip_r: "ホイップ", shake: "手持ち揺れ", drift_l: "横移動", drift_r: "横移動", parallax: "パララックス", crane_up: "クレーン", static: "フィックス" };
const ALT = ["kb_in", "drift_l", "kb_out", "parallax", "slow_push", "drift_r", "static"];

export function review(p: CriticIn): Review {
  const I: Issue[] = [];
  const S = p.shots.filter((s) => s.src), B = beatLen(p.beat as any);
  // 1) same camera move 3+ times in a row
  for (let i = 2; i < S.length; i++) {
    if (S[i].move === S[i - 1].move && S[i].move === S[i - 2].move) {
      const s = S[i];
      if (!s.locked) { const alt = (p.movesAlt ?? ALT).find((m) => m !== s.move && m !== S[i + 1]?.move) ?? "static"; I.push({ rule: "same_move", fixed: true, at: s.id, msg: `${s.id}: 「${MOVE_JA[s.move] ?? s.move}」が3回続くので「${MOVE_JA[alt] ?? alt}」に変更` }); s.move = alt; }
      else I.push({ rule: "same_move", fixed: false, at: s.id, msg: `${s.id}: 同じ動き（${MOVE_JA[s.move] ?? s.move}）が3回続きます。1カットだけフィックスか引きにすると次が活きます` });
    }
  }
  // 2) restraint: one hero move per section; big effects not everywhere
  const bySec = new Map<string, ResolvedLine[]>();
  p.lines.forEach((L) => { const k = L.section; if (!bySec.has(k)) bySec.set(k, []); bySec.get(k)!.push(L); });
  for (const [sec, ls] of bySec) {
    const heroes = ls.filter((L) => trait(L.style).hero);
    if (heroes.length > 1) {
      const calmest = ls.filter((L) => !trait(L.style).hero).map((L) => L.style)[0];
      heroes.slice(1).forEach((L) => {
        if (!L.locked && calmest) { I.push({ rule: "restraint", fixed: true, at: `L${L.li}`, msg: `${sec}: 大技が重なるので${L.li}行目を「${CATALOG[calmest]?.short}」に（見せ場は1回）` }); L.style = calmest; L.params = { ...CATALOG[calmest].defaults, ...L.params }; }
        else if (L.locked) I.push({ rule: "restraint", fixed: false, at: `L${L.li}`, msg: `${sec}: 大きな動きが${heroes.length}回あります。1回に絞ると見せ場が際立ちます（${L.li}行目はご指定どおり）` });
      });
    }
  }
  // 3) same lyric style 3+ lines in a row (auto only)
  for (let i = 2; i < p.lines.length; i++) {
    const a = p.lines[i], b = p.lines[i - 1], c = p.lines[i - 2];
    if (a.style === b.style && b.style === c.style && a.section !== c.section) I.push({ rule: "same_style", fixed: false, at: `L${a.li}`, msg: `${a.li}行目: セクションをまたいで同じ文字の動きが続きます。境目で変えると構成が伝わります` });
  }
  // 4) readability: minimum on-screen time; calm songs with shaky styles; text on faces; contrast
  p.lines.forEach((L, k) => {
    const need = minOnScreen(L.text), have = L.tOff - L.tOn;
    if (have < need) {
      const nxt = p.lines[k + 1]; const room = nxt ? nxt.tOn - L.exit * 0.6 : Infinity;
      if (room > L.tOn + need) { L.tOff = L.tOn + need; L.tEnd = L.tOff + L.exit; I.push({ rule: "readability", fixed: true, at: `L${L.li}`, msg: `${L.li}行目: 表示が短い→${need.toFixed(1)}秒まで延長` }); }
      else I.push({ rule: "readability", fixed: false, at: `L${L.li}`, msg: `${L.li}行目「${L.text.slice(0, 12)}」は${have.toFixed(1)}秒しか出ません（読むには${need.toFixed(1)}秒）。行を分けるか文字を減らすと読めます` });
    }
    if (p.calm && trait(L.style).shaky) I.push({ rule: "fit", fixed: false, at: `L${L.li}`, msg: `${L.li}行目: しっとりした曲に揺れ系（${CATALOG[L.style]?.short}）。ご指定どおりにしていますが、ふわっと/ピント系の方が曲に合います` });
    const shot = p.shots.find((s) => L.tOn >= s.start - 1e-6 && L.tOn < s.end);
    const y = Number(L.params.textY ?? p.textY);
    if (shot?.face && faceOverlap(shot.face, y) > 0.25 && L.style !== "tategaki") I.push({ rule: "face", fixed: false, at: `L${L.li}`, msg: `${L.li}行目: 文字が顔にかかります。位置を上へ（「歌詞を上に」）か縦書きにすると表情が見えます` });
  });
  // 5) cuts off the phrase/beat grid (only auto shots are snapped)
  S.forEach((s, i) => {
    if (i === 0) return;
    const off = Math.abs(((s.start - p.beat.phase) / (B / 2)) - Math.round((s.start - p.beat.phase) / (B / 2))) * (B / 2);
    const onLine = p.lines.some((L) => Math.abs(L.chars[0].t0 - s.start) < 0.12);
    if (off > 0.09 && !onLine) I.push({ rule: "off_beat", fixed: false, at: s.id, msg: `${s.id}: カット点が拍からずれています（${off.toFixed(2)}秒）。拍か歌い出しに合わせると気持ちよく切れます` });
  });
  // 6) arc: chorus must out-rank the verse (intensity + cut rate); hook & ending payoff
  const avg = (t: string) => { const ls = p.lines.filter((L) => L.sectionType === t); return ls.length ? ls.reduce((a, L) => a + trait(L.style).intensity, 0) / ls.length : NaN; };
  const cutLen = (t: string) => { const ss = S.filter((s) => s.sectionType === t); return ss.length ? ss.reduce((a, s) => a + (s.end - s.start), 0) / ss.length : NaN; };
  if (avg("chorus") <= avg("verse")) I.push({ rule: "arc", fixed: false, msg: "サビの文字がAメロより強くありません。サビで1段上げると盛り上がりの山が見えます" });
  if (cutLen("chorus") > cutLen("verse") * 1.05 && !p.calm) I.push({ rule: "arc", fixed: false, msg: "サビのカットがAメロより長いです。サビだけ細かく割るとエネルギーが伝わります" });
  const ch = [...new Set(p.lines.filter((L) => L.sectionType === "chorus").map((L) => L.section))];
  if (ch.length >= 2) { const iv = (sec: string) => { const x = p.lines.filter((L) => L.section === sec); return x.reduce((a, L) => a + trait(L.style).intensity, 0) / x.length; };
    if (iv(ch[ch.length - 1]) + 0.02 < iv(ch[0])) I.push({ rule: "arc", fixed: false, msg: `ラスサビ（${ch[ch.length - 1]}）が最初のサビより弱いです。最後のサビで1段上げるか、落ちサビで一度引いてから上げると山ができます` }); }
  if (!p.calm) S.forEach((s) => { if (s.end - s.start > 4.2 && (s.move === "static" || !s.move) && s.kind === "image") I.push({ rule: "hold", fixed: false, at: s.id, msg: `${s.id}: 動きのない静止画が${(s.end - s.start).toFixed(1)}秒続きます。2秒ごとに画か動きを変えると間延びしません` }); });
  const firstChorus = p.lines.find((L) => L.sectionType === "chorus");
  if (firstChorus && !p.lines.some((L) => L.sectionType === "chorus" && trait(L.style).hero) && !p.calm) I.push({ rule: "hook", fixed: false, msg: "サビに見せ場の文字がありません。サビ頭の1行だけ大きく出すとフックになります" });
  const last = S[S.length - 1];
  if (last && last.end - last.start < B * 2) I.push({ rule: "ending", fixed: false, msg: "最後のカットが短く、余韻がありません。最後は2拍以上ためると締まります" });
  // 7) rhythm variation: a long run of identical shot lengths
  const lens = S.map((s) => +(s.end - s.start).toFixed(2));
  let run = 1; for (let i = 1; i < lens.length; i++) { run = Math.abs(lens[i] - lens[i - 1]) < 0.05 ? run + 1 : 1; if (run === 10) I.push({ rule: "rhythm", fixed: false, at: S[i].id, msg: `${S[i].id}付近: 同じ長さのカットが10回続きます。感情の山で1カット長く「ため」ると単調さが消えます` }); }
  const bad = I.filter((x) => !x.fixed).length, fixed = I.filter((x) => x.fixed).length;
  const score = Math.max(0, 100 - bad * 6 - fixed * 1);
  return { issues: I, note: directorNote(p, I), score };
}

function directorNote(p: CriticIn, I: Issue[]): string {
  const secs = [...new Set(p.lines.map((L) => L.sectionType))];
  const arc = secs.map((t) => { const ls = p.lines.filter((L) => L.sectionType === t); const v = ls.reduce((a, L) => a + trait(L.style).intensity, 0) / ls.length; return `${SEC_JA[t] ?? t} ${"▮".repeat(1 + Math.round(v * 5))}`; }).join("  ");
  const fixed = I.filter((x) => x.fixed), sug = I.filter((x) => !x.fixed);
  const roles = [...new Set(p.shots.map((s) => s.role).filter(Boolean))];
  return [
    "## 演出メモ（ディレクター・チェック）",
    `- 盛り上がりの設計: ${arc}`,
    roles.length ? `- 構成: ${roles.join(" / ")} をセクションごとに配分` : "",
    fixed.length ? `- 自動で直した所（${fixed.length}）:\n${fixed.slice(0, 8).map((x) => `  - ${x.msg}`).join("\n")}` : "- 自動修正: なし",
    sug.length ? `- 提案（ご指定箇所は変えていません）（${sug.length}）:\n${sug.slice(0, 10).map((x) => `  - ${x.msg}`).join("\n")}` : "- 提案: なし（チェック項目すべてクリア）",
  ].filter(Boolean).join("\n");
}
