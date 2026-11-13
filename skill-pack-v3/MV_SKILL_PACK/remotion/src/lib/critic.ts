// Mechanical checks and direction prompts. Aesthetic heuristics never rewrite the plan.
// Auto readability fixes preserve user locks; the score is not an aesthetic or sync rating.
import { beatLen } from "./core";
import { CATALOG } from "./catalog";
import { minOnScreen } from "./direction";
import { trait } from "./traits";
import { faceOverlap } from "./visual";
import type { ResolvedLine, Shot } from "./types";

export interface Issue { rule: string; fixed: boolean; msg: string; at?: string }
export interface Review { issues: Issue[]; note: string; score: number /* display checks only */ }
export interface CriticIn { shots: Shot[]; lines: ResolvedLine[]; beat: { bpm: number; phase: number }; genre?: string | null; calm?: boolean; textY: number; movesAlt?: string[] }

const SEC_JA: Record<string, string> = { intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", bridge: "Cメロ", outro: "アウトロ", other: "間奏" };

export function review(p: CriticIn): Review {
  const I: Issue[] = [];
  const S = p.shots.filter((s) => s.src), B = beatLen(p.beat as any);
  const nm = (s: Shot) => { const i = p.shots.indexOf(s); return `シーン${i + 1}（${s.sectionType ? (SEC_JA[s.sectionType] ?? "") + " " : ""}${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}〜）`; };
  // 1) same camera move 3+ times in a row
  for (let i = 2; i < S.length; i++) {
    if (S[i].move === S[i - 1].move && S[i].move === S[i - 2].move) {
      const s = S[i];
      I.push({ rule: "same_move", fixed: false, at: s.id, msg: `${nm(s)}: 同じ動きが3回続きます。反復で何を見せるか音付きで確認し、単調なら視点や間を比較してください（自動変更なし）` });
    }
  }
  // 2) restraint: one hero move per section; big effects not everywhere
  const bySec = new Map<string, ResolvedLine[]>();
  p.lines.forEach((L) => { const k = L.section; if (!bySec.has(k)) bySec.set(k, []); bySec.get(k)!.push(L); });
  for (const [sec, ls] of bySec) {
    const heroes = ls.filter((L) => trait(L.style).hero);
    if (heroes.length > 1) {
      heroes.slice(1).forEach((L) => {
        I.push({ rule: "restraint", fixed: false, at: `L${L.li}`, msg: `${sec}: 大きな動きが${heroes.length}回あります。連続する強調が展開を作るか、主役を奪い合うか比較してください（自動変更なし）` });
      });
    }
  }
  // 3) same lyric style 3+ lines in a row (auto only)
  for (let i = 2; i < p.lines.length; i++) {
    const a = p.lines[i], b = p.lines[i - 1], c = p.lines[i - 2];
    if (a.style === b.style && b.style === c.style && a.section !== c.section) I.push({ rule: "same_style", fixed: false, at: `L${a.li}`, msg: `${a.li}行目: セクションをまたいで同じ文字の動きが続きます。統一された表現として機能するか、区間の変化が伝わるか確認してください` });
  }
  // 4) readability: minimum on-screen time; calm songs with shaky styles; text on faces; contrast
  p.lines.forEach((L, k) => {
    const need = minOnScreen(L.text), have = L.tOff - L.tOn;
    if (have < need) {
      const nxt = p.lines[k + 1]; const room = nxt ? nxt.tOn - L.exit * 0.6 : Infinity;
      if (!L.locked && room > L.tOn + need) { L.tOff = L.tOn + need; L.tEnd = L.tOff + L.exit; I.push({ rule: "readability", fixed: true, at: `L${L.li}`, msg: `${L.li}行目: 表示が短い→${need.toFixed(1)}秒まで延長` }); }
      else I.push({ rule: "readability", fixed: false, at: `L${L.li}`, msg: `${L.li}行目「${L.text.slice(0, 12)}」は${have.toFixed(1)}秒しか出ません（読むには${need.toFixed(1)}秒）。行を分けるか文字を減らすと読めます` });
    }
    if (p.calm && trait(L.style).shaky) I.push({ rule: "fit", fixed: false, at: `L${L.li}`, msg: `${L.li}行目: 静かな曲調に揺れ系（${CATALOG[L.style]?.short}）を使っています。不安や対比を表す意図と、実際の歌唱・画との関係を確認してください` });
    const shot = p.shots.find((s) => L.tOn >= s.start - 1e-6 && L.tOn < s.end);
    const y = Number(L.params.textY ?? p.textY);
    if (shot?.face && faceOverlap(shot.face, y) > 0.25 && L.style !== "tategaki") I.push({ rule: "face", fixed: false, at: `L${L.li}`, msg: `${L.li}行目: 文字が顔にかかります。位置を上へ（「歌詞を上に」）か縦書きにすると表情が見えます` });
  });
  // 5) cuts off the phrase/beat grid (only auto shots are snapped)
  S.forEach((s, i) => {
    if (i === 0) return;
    const off = Math.abs(((s.start - p.beat.phase) / (B / 2)) - Math.round((s.start - p.beat.phase) / (B / 2))) * (B / 2);
    const onLine = p.lines.some((L) => L.chars[0] && Math.abs(L.chars[0].t0 - s.start) < 0.12);
    if (off > 0.09 && !onLine) I.push({ rule: "off_beat", fixed: false, at: s.id, msg: `${nm(s)}: カット点が仮の拍グリッドから${off.toFixed(2)}秒離れています。歌唱・動作の区切りや意図した拍外しを音付きで確認してください` });
  });
  // 6) Possible contrasts to inspect; a restrained chorus or a held shot can be intentional.
  const avg = (t: string) => { const ls = p.lines.filter((L) => L.sectionType === t); return ls.length ? ls.reduce((a, L) => a + trait(L.style).intensity, 0) / ls.length : NaN; };
  const cutLen = (t: string) => { const ss = S.filter((s) => s.sectionType === t); return ss.length ? ss.reduce((a, s) => a + (s.end - s.start), 0) / ss.length : NaN; };
  if (avg("chorus") <= avg("verse")) I.push({ rule: "arc", fixed: false, msg: "サビの文字はAメロと同等か控えめです。表情・余白・画角などで狙った展開が伝わるか確認してください" });
  if (cutLen("chorus") > cutLen("verse") * 1.05 && !p.calm) I.push({ rule: "arc", fixed: false, msg: "サビはAメロより長いカットです。歌唱や動きを見せる保持として機能するか確認してください" });
  const ch = [...new Set(p.lines.filter((L) => L.sectionType === "chorus").map((L) => L.section))];
  if (ch.length >= 2) { const iv = (sec: string) => { const x = p.lines.filter((L) => L.section === sec); return x.reduce((a, L) => a + trait(L.style).intensity, 0) / x.length; };
    if (iv(ch[ch.length - 1]) + 0.02 < iv(ch[0])) I.push({ rule: "arc", fixed: false, msg: `ラスサビ（${ch[ch.length - 1]}）の文字は最初のサビより控えめです。余韻や意味の変化として結末に合うか確認してください` }); }
  if (!p.calm) S.forEach((s) => { if (s.end - s.start > 4.2 && (s.move === "static" || !s.move) && s.kind === "image") I.push({ rule: "hold", fixed: false, at: s.id, msg: `${nm(s)}: 静止画を${(s.end - s.start).toFixed(1)}秒保持しています。視線・言葉・音の展開で持続するか確認し、単調なら別案と比較してください` }); });
  const firstChorus = p.lines.find((L) => L.sectionType === "chorus");
  if (firstChorus && !p.lines.some((L) => L.sectionType === "chorus" && trait(L.style).hero) && !p.calm) I.push({ rule: "hook", fixed: false, msg: "サビに大技の文字はありません。人物・画・間など、記憶に残したい主役と瞬間を確認してください" });
  const last = S[S.length - 1];
  if (last && last.end - last.start < B * 2) I.push({ rule: "ending", fixed: false, msg: "最後のカットは2拍未満です。切断感やループ、余韻など狙った終わり方を音付きで確認してください" });
  // 7) rhythm variation: a long run of identical shot lengths
  const lens = S.map((s) => +(s.end - s.start).toFixed(2));
  let run = 1; for (let i = 1; i < lens.length; i++) { run = Math.abs(lens[i] - lens[i - 1]) < 0.05 ? run + 1 : 1; if (run === 10) I.push({ rule: "rhythm", fixed: false, at: S[i].id, msg: `${nm(S[i])}付近: 同じ長さのカットが10回続きます。感情の山で1カット長く「ため」ると単調さが消えます` }); }
  const displayIssues = I.filter((x) => x.rule === "readability" || x.rule === "face");
  const bad = displayIssues.filter((x) => !x.fixed).length, fixed = displayIssues.filter((x) => x.fixed).length;
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
    "- 点数は表示時間・顔との重なりの機械チェックです。演出の良さや音同期は評価していません。反復や抑制は意図を確認し、単調さ・散漫さは音付きの別案比較で判断してください。",
    `- 盛り上がりの設計: ${arc}`,
    roles.length ? `- 構成: ${roles.join(" / ")} をセクションごとに配分` : "",
    fixed.length ? `- 自動で直した所（${fixed.length}）:\n${fixed.slice(0, 8).map((x) => `  - ${x.msg}`).join("\n")}` : "- 自動修正: なし",
    sug.length ? `- 提案（ご指定箇所は変えていません）（${sug.length}）:\n${sug.slice(0, 10).map((x) => `  - ${x.msg}`).join("\n")}` : "- 機械チェックからの提案: なし（演出の確認は別途必要）",
  ].filter(Boolean).join("\n");
}
