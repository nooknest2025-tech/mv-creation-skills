// Pre-generation cost estimate: API pay-as-you-go vs subscription credits, per shot + totals, unverified handling.
import { priceAt, snapDuration } from "./videoModels";

export interface PlanDef { ja: string; monthly_usd: number | null; credits: number; rollover: boolean; verified: boolean; note?: string }
export interface CreditCost { model: string; res: string; audio?: boolean; per_sec?: number; per_clip?: Record<string, number>; verified?: boolean }
export interface Provider { ja: string; models: string[]; plans: Record<string, PlanDef>; overage: { usd_per_credit: number | null; note?: string }; credit_costs: CreditCost[]; note?: string; verified_at?: string; source: string }
export type PlansFile = { providers: Record<string, Provider> };
/** user setting: gen.plans.<provider> = "pro" | "api" | { plan: "pro", remaining: 1200 } */
export type UserPlans = Record<string, string | { plan: string; remaining?: number }>;
export interface ShotIn { shot: string; model: string; seconds: number; res: string; takes: number; audio?: boolean; adjustJa?: string }
export interface Line { shot: string; model: string; provider: string | null; mode: "api" | "plan"; sec: number; snapped: boolean; res: string; takes: number; usd: number | null; credits: number | null; verified: boolean; why?: string; adjustJa?: string }
export interface ImageIn { count: number; model: string; usd_each: number | null }
export interface Estimate {
  lines: Line[]; images: { count: number; model: string; usd: number | null }[];
  usdTotal: number; // confirmed (verified) API money total incl. images
  unknown: { shot: string; why: string }[];
  credits: Record<string, { plan: string; ja: string; used: number; included: number; remaining: number; after: number; overCredits: number; overUsd: number | null; verified: boolean; source: string }>;
  clips: number; seconds: number; complete: boolean;
}

export const providerOf = (pf: PlansFile, modelId: string) => Object.entries(pf.providers).find(([, p]) => p.models.includes(modelId))?.[0] ?? null;
const planOf = (u: UserPlans, prov: string | null) => { const v = prov ? u[prov] : undefined; if (!v) return null; const o = typeof v === "string" ? { plan: v } : v; return o.plan === "api" ? null : o; };

export function creditsFor(p: Provider, model: string, res: string, sec: number, audio = false): { credits: number | null; verified: boolean } {
  const cs = p.credit_costs.filter((c) => c.model === model && (c.res === res || c.res === "any" || (res === "720p" && c.res === "768p")) && (c.audio === undefined || c.audio === audio));
  const c = cs[0]; if (!c) return { credits: null, verified: false };
  if (c.per_sec != null) return { credits: Math.ceil(sec) * c.per_sec, verified: c.verified !== false };
  const k = Object.keys(c.per_clip ?? {}).map(Number).sort((a, b) => a - b).find((d) => d >= sec);
  return k == null ? { credits: null, verified: false } : { credits: c.per_clip![k], verified: c.verified !== false };
}

export function estimate(shots: ShotIn[], models: any[], pf: PlansFile, user: UserPlans = {}, images: ImageIn[] = []): Estimate {
  const lines: Line[] = [], unknown: Estimate["unknown"] = [], credits: Estimate["credits"] = {};
  let usd = 0;
  for (const s of shots) {
    const m = models.find((x) => x.id === s.model); if (!m) { unknown.push({ shot: s.shot, why: `指定された動画AIが登録されていません（npm run models で一覧を確認）` }); continue; }
    const sec = snapDuration(s.seconds, m), snapped = sec !== s.seconds;
    const prov = providerOf(pf, m.id), pl = planOf(user, prov);
    if (pl && prov) {
      const P = pf.providers[prov], def = P.plans[pl.plan];
      if (!def) { unknown.push({ shot: s.shot, why: `${P.ja} に「${pl.plan}」プランがありません（${Object.keys(P.plans).join(" / ")}）` }); continue; }
      const c = creditsFor(P, m.id, s.res, sec, s.audio);
      const tot = c.credits == null ? null : c.credits * s.takes;
      lines.push({ adjustJa: s.adjustJa, shot: s.shot, model: m.id, provider: prov, mode: "plan", sec, snapped, res: s.res, takes: s.takes, usd: null, credits: tot, verified: c.verified && def.verified });
      if (tot == null) unknown.push({ shot: s.shot, why: `${P.ja} のこの画質（${s.res}）で使うクレジット数がまだ確認できていません` });
      const k = credits[prov] ??= { plan: pl.plan, ja: `${P.ja} ${def.ja}`, used: 0, included: def.credits, remaining: pl.remaining ?? def.credits, after: 0, overCredits: 0, overUsd: 0, verified: def.verified, source: P.source };
      k.used += tot ?? 0; k.verified &&= c.verified;
      continue;
    }
    const p = m.verified ? priceAt(m, s.res) : null;
    const u = p == null ? null : +(p * sec * s.takes).toFixed(3);
    if (u == null) unknown.push({ shot: s.shot, why: m.deprecated ? "選んだ動画AIは提供が終了しています" : `選んだ動画AIの料金がまだ確認できていません` });
    else usd += u;
    lines.push({ adjustJa: s.adjustJa, shot: s.shot, model: m.id, provider: prov, mode: "api", sec, snapped, res: s.res, takes: s.takes, usd: u, credits: null, verified: u != null });
  }
  for (const k of Object.keys(credits)) {
    const c = credits[k], P = pf.providers[k];
    c.after = c.remaining - c.used; c.overCredits = Math.max(0, -c.after);
    c.overUsd = c.overCredits === 0 ? 0 : P.overage.usd_per_credit == null ? null : +(c.overCredits * P.overage.usd_per_credit).toFixed(2);
    if (c.overUsd) usd += c.overUsd;
    if (c.overCredits && c.overUsd == null) unknown.push({ shot: "-", why: `${c.ja}: ${c.overCredits} クレジット不足（追加購入の単価は未確認）` });
  }
  const imgs = images.filter((i) => i.count > 0).map((i) => ({ count: i.count, model: i.model, usd: i.usd_each == null ? null : +(i.count * i.usd_each).toFixed(3) }));
  for (const i of imgs) { if (i.usd == null) unknown.push({ shot: "画像", why: `${i.model} の画像単価が未確認` }); else usd += i.usd; }
  return { lines, images: imgs, usdTotal: +usd.toFixed(3), unknown, credits, clips: lines.reduce((a, l) => a + l.takes, 0), seconds: lines.reduce((a, l) => a + l.sec * l.takes, 0), complete: unknown.length === 0 };
}

/** S005 -> シーン5 (internal ids are not shown to users). */
export const shotJa = (id: string) => String(id ?? "").replace(/^S0*(\d+)(b?)$/i, (_, n, b) => `シーン${n}${b ? "の後半" : ""}`);
const resJa = (r: string) => (r === "720p" ? "標準(720p)" : r === "1080p" ? "高画質(1080p)" : r === "480p" ? "軽量(480p)" : r);
export function estimateMd(e: Estimate): string {
  const L: string[] = ["# 💰 生成前の見積もり", "",
    `カット数 ${e.lines.length} / クリップ ${e.clips} 本（テイク込み）/ 合計 ${e.seconds} 秒`, "",
    "| シーン | 支払い方法 | 秒 | 画質 | 作る回数 | 金額 | クレジット |", "|---|---|---|---|---|---|---|",
    ...e.lines.map((l) => `| ${shotJa(l.shot)} | ${l.mode === "plan" ? "月額プラン" : "使った分だけ"} | ${l.sec}${l.snapped ? "（対応できる長さに調整）" : ""} | ${resJa(l.res)} | ${l.takes} | ${l.mode === "plan" ? "—" : l.usd == null ? "未確認" : "$" + l.usd} | ${l.mode === "plan" ? (l.credits ?? "未確認") + (l.verified ? "" : "（未確認）") : "—"} |`)];
  const adj = e.lines.filter((l) => l.adjustJa); if (adj.length) L.push("", "## 尺の調整（口パク/ダンス）", ...adj.map((l) => `- ${shotJa(l.shot)}: ${l.adjustJa}`));
  if (e.images.length) L.push("", "## 参照・開始画の画像", ...e.images.map((i) => `- 画像AI × ${i.count} 枚: ${i.usd == null ? "未確認" : "$" + i.usd}`));
  for (const c of Object.values(e.credits)) L.push("", `## ${c.ja}（月額プラン）`, `- 使用 ${c.used} クレジット / 残り ${c.remaining} → **実行後 ${c.after}**${c.after < 0 ? `（${c.overCredits} 不足: 追加 ${c.overUsd == null ? "単価未確認" : "$" + c.overUsd}）` : ""}${c.verified ? "" : " ※未確認の値を含む"}`, `- 出典: ${c.source}`);
  const sh = (e as any).shortShots as import("./lipsync").ShortAdvice[] | undefined;
  if (sh?.length) L.push("", "## ⚠ 短い口パク/ダンスショット", ...sh.flatMap((a) => [`- ${a.msg}`, ...a.options.map((x) => `  - 案: ${x}`)]), ...(((e as any).merged ?? []).length ? [`- 🔧 自動で結合: ${(e as any).merged.join("、")}`] : []));
  L.push("", `## 合計（確認済みの金額）: **$${e.usdTotal}**`);
  if (e.unknown.length) L.push("", "⚠️ 次の項目は未確認のため合計に入っていません（推測しません）:", ...e.unknown.map((u) => `- ${shotJa(u.shot)}: ${u.why}`));
  return L.join("\n");
}

/** 「KlingはProプラン」「RunwayはAPI」「Klingの残り1200クレジット」 */
const PROV_WORDS: Record<string, RegExp> = { kling: /kling|クリング/i, runway: /runway|ランウェイ/i, minimax: /minimax|hailuo|ハイルオ|海螺|h3/i, luma: /luma|ルマ/i, pollo: /pollo|ポロ/i, xai: /grok|グロック/i };
export function parsePlanTier(text: string, pf: PlansFile): { provider: string; plan?: string; remaining?: number } | null {
  const t = text.normalize("NFKC");
  const prov = Object.keys(PROV_WORDS).find((k) => PROV_WORDS[k].test(t)); if (!prov) return null;
  const rem = t.match(/残り\s*(\d[\d,]*)\s*(クレジット|credits?)/i);
  if (/(API|従量)/i.test(t)) return { provider: prov, plan: "api" };
  const plans = Object.keys(pf.providers[prov]?.plans ?? {});
  const plan = plans.find((p) => new RegExp(`${p}|${(pf.providers[prov].plans[p].ja ?? "").split(/[（(]/)[0]}`, "i").test(t.replace(PROV_WORDS[prov], "")));
  if (!plan && !rem) return null;
  return { provider: prov, plan, remaining: rem ? Number(rem[1].replace(/,/g, "")) : undefined };
}

/** decide whether to run. Cancel = do nothing. Non-interactive needs --confirm <exact usdTotal>. */
export async function confirmRun(e: Estimate, o: { confirm?: number | string; interactive: boolean; ask?: (q: string) => Promise<string>; cap?: number }): Promise<{ go: boolean; reason: string }> {
  const blocking = e.unknown.filter((u) => { const l = e.lines.find((x) => x.shot === u.shot); return !l || l.mode === "api"; });
  if (blocking.length) return { go: false, reason: "未確認の価格を含むため実行できません: " + blocking.map((b) => b.why).join(" / ") };
  if (o.cap != null && e.usdTotal > o.cap) return { go: false, reason: `見積もり $${e.usdTotal} が上限 $${o.cap} を超えています` };
  if (o.confirm != null && o.confirm !== "") return Number(o.confirm) === e.usdTotal ? { go: true, reason: "金額一致（--confirm）" } : { go: false, reason: `--confirm ${o.confirm} が見積もり $${e.usdTotal} と一致しません。何もしませんでした` };
  if (!o.interactive || !o.ask) return { go: false, reason: `確認が必要です。内容を見て --confirm ${e.usdTotal} を付けて実行してください。何もしませんでした` };
  const a = (await o.ask(`この内容で生成しますか？ 合計 $${e.usdTotal}${Object.keys(e.credits).length ? " + サブスクのクレジット" : ""} [y/N] `)).trim().toLowerCase();
  return /^(y|yes|はい)$/.test(a) ? { go: true, reason: "ユーザーが承認" } : { go: false, reason: "キャンセルしました（何も生成していません・課金なし）" };
}
