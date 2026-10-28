/** 「図形レイヤー（文字PVの図形・線・粒）」 panel. Writes edits only: data.mographEdit (whole video) and scene.mograph (this scene).
 *  The built-in plan (data.mograph) is never changed: untouched = the same picture as npm run mv; 「元に戻す」 removes the edit. */
import { MO_LIMITS, MO_LOOKS, MO_TRANSITIONS, hasEdit } from "../src/lib/mographEdit";
type Ctx = { data: () => any; current: () => number; change: () => void; preview: () => void };
const el = (tag: string, props: any = {}, ...kids: (Node | string)[]) => { const e: any = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; };
const secAt = (data: any, t: number) => (data.mograph?.sections ?? []).find((s: any) => t >= s.start && t < s.end) ?? data.mograph?.sections?.at(-1);
const COLOR_JA: Record<string, string> = { bg: "背景", fg: "図形", accent: "差し色", sub: "サブ" };
/** set / clear one key of an edit object (undefined or equal-to-default -> removed). */
export function setMo(obj: any, key: string, v: any, dflt?: any): any {
  const o = { ...(obj ?? {}) };
  if (v === undefined || v === "" || (dflt !== undefined && v === dflt)) delete o[key]; else o[key] = v;
  return hasEdit(o) ? o : undefined;
}
export function mographPanel(host: HTMLElement, ctx: Ctx) {
  const sec = el("section", { className: "stagePanel mographPanel" }); host.append(sec);
  const draw = () => {
    const data = ctx.data(); sec.replaceChildren();
    if (!data?.mograph) { sec.hidden = true; return; } sec.hidden = false;
    const i = ctx.current(), s = data.scenes[i], base = secAt(data, s.start);
    const block = (title: string, get: () => any, put: (e: any) => void) => {
      const e = get() ?? {}, box = el("div", { className: "lookControls" });
      const set = (k: string, v: any, d?: any) => { put(setMo(get(), k, v, d)); ctx.change(); ctx.preview(); draw(); };
      const sel = (label: string, k: string, options: Record<string, string>) => { const s2 = el("select"); s2.append(el("option", { value: "", textContent: "元のまま" })); for (const [a, b] of Object.entries(options)) s2.append(el("option", { value: a, textContent: b })); s2.value = e[k] ?? ""; s2.onchange = () => set(k, s2.value || undefined); s2.setAttribute("aria-label", label); return el("label", {}, label + " ", s2); };
      const num = (label: string, k: keyof typeof MO_LIMITS) => { const [lo, hi] = MO_LIMITS[k]; const r = el("input", { type: "range", min: lo, max: hi, step: 0.05, value: e[k] ?? 1 }); r.setAttribute("aria-label", label); const v = el("span", { textContent: `${(e[k] ?? 1).toFixed(2)}倍` }); r.oninput = () => set(k, Number(r.value), 1); return el("label", {}, label + " ", r, v); };
      const on = el("input", { type: "checkbox", checked: !e.off }); on.setAttribute("aria-label", title + "の表示"); on.onchange = () => set("off", on.checked ? undefined : true);
      box.append(el("label", {}, "表示 ", on), sel("図形の種類", "look", MO_LOOKS as any), sel("区切りの転換", "transition", MO_TRANSITIONS as any), num("強さ（濃さ）", "intensity"), num("動きの速さ", "speed"), num("量（数）", "density"));
      for (const k of ["bg", "fg", "accent", "sub"]) { const c = el("input", { type: "color", value: e.colors?.[k] ?? base?.palette?.[k] ?? "#000000" }); c.setAttribute("aria-label", `${COLOR_JA[k]}の色`); c.oninput = () => { const cols = { ...(get()?.colors ?? {}), [k]: c.value }; put(setMo(get(), "colors", cols)); ctx.change(); ctx.preview(); }; box.append(el("label", {}, `${COLOR_JA[k]}の色 `, c)); }
      const reset = el("button", { textContent: "元に戻す", disabled: !hasEdit(get()) }); reset.onclick = () => { put(undefined); ctx.change(); ctx.preview(); draw(); };
      sec.append(el("h3", { textContent: title + (hasEdit(get()) ? " ✎" : "") }), box, el("div", { className: "lineNav" }, reset));
    };
    block("図形レイヤー（動画全体）", () => data.mographEdit, (e) => { if (e) data.mographEdit = e; else delete data.mographEdit; });
    block(`図形レイヤー（このシーン：${s.label ?? i + 1}）`, () => data.scenes[ctx.current()].mograph, (e) => { const sc = data.scenes[ctx.current()]; if (e) sc.mograph = e; else delete sc.mograph; });
    sec.append(el("p", { textContent: `元の設計: ${base ? `${MO_LOOKS[base.look as keyof typeof MO_LOOKS] ?? base.look}・転換=${MO_TRANSITIONS[base.transition as keyof typeof MO_TRANSITIONS] ?? base.transition}` : ""}。シーンの設定は全体の設定より優先されます。プレビューと書き出しは同じ描画です。` }));
  };
  return draw;
}
