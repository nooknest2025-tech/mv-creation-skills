/** 「合成（分割・コマ割り・ワイプ・効果）」 panel. Writes scene.comp (this scene) and data.comp (whole video: colours, grade).
 *  A scene without comp keeps its normal picture; 「合成をやめる」 deletes scene.comp so it renders exactly as before. */
import { COMP_BORDERS, COMP_DIRS, COMP_ENTER, COMP_FX, COMP_LAYOUTS, COMP_LOOKS, COMP_SLIDES, COMP_TITLE, compColors } from "../src/lib/compose";
type Ctx = { data: () => any; current: () => number; change: () => void; preview: () => void };
const el = (tag: string, props: any = {}, ...kids: (Node | string)[]) => { const e: any = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; };
const label = (text: string, input: HTMLElement) => { input.setAttribute("aria-label", text); return el("label", {}, text + " ", input); };
export function composePanel(host: HTMLElement, ctx: Ctx) {
  const sec = el("section", { className: "stagePanel composePanel" }); host.append(sec);
  const draw = () => {
    const data = ctx.data(); sec.replaceChildren(); if (!data) return;
    const i = ctx.current(), s = data.scenes[i], len = (data.scenes[i + 1]?.start ?? data.duration) - s.start;
    let after = () => {};
    const done = () => { after(); ctx.change(); ctx.preview(); draw(); };
    const live = () => { after(); ctx.change(); ctx.preview(); };
    const sel = (text: string, obj: any, key: string, opts: Record<string, string>, dflt: string, redraw = false) => { const e = el("select"); for (const [a, b] of Object.entries(opts)) e.append(el("option", { value: a, textContent: b })); e.value = obj[key] ?? dflt; e.onchange = () => { if (e.value === dflt) delete obj[key]; else obj[key] = e.value; redraw ? done() : live(); }; return label(text, e); };
    const num = (text: string, obj: any, key: string, min: number, max: number, step: number, dflt?: number) => { const e = el("input", { type: "number", min, max, step, value: obj[key] ?? dflt ?? "" }); e.oninput = () => { if (e.value === "") { delete obj[key]; live(); return; } const v = Number(e.value); if (!Number.isFinite(v)) return; obj[key] = Math.max(min, Math.min(max, v)); live(); }; return label(text, e); };
    const chk = (text: string, obj: any, key: string, redraw = false) => { const e = el("input", { type: "checkbox", checked: !!obj[key] }); e.onchange = () => { if (e.checked) obj[key] = true; else delete obj[key]; redraw ? done() : live(); }; return label(text, e); };
    const txt = (text: string, obj: any, key: string, max: number) => { const e = el("input", { type: "text", maxLength: max, value: obj[key] ?? "" }); e.oninput = () => { obj[key] = e.value; live(); }; return label(text, e); };
    const color = (text: string, obj: any, key: string, dflt: string) => { const e = el("input", { type: "color", value: obj[key] ?? dflt }); e.oninput = () => { obj[key] = e.value; live(); }; return label(text, e); };
    const assetSel = (p: any) => { const e = el("select"); data.assets.forEach((a: any, n: number) => e.append(el("option", { value: String(n), textContent: a?.label ?? (typeof a === "string" ? a : a?.src) ?? `素材${n + 1}` }))); e.value = String(p.asset); e.onchange = () => { p.asset = Number(e.value); live(); }; return label("素材", e); };

    sec.append(el("h3", { textContent: `合成（このシーン）${s.comp ? " ✎" : ""}` }));
    if (!s.comp) {
      const on = el("button", { textContent: "このシーンを合成にする（分割・コマ割り・効果）" });
      on.onclick = () => { s.comp = { layout: { type: "full" }, panels: [{ asset: s.asset, from: s.clipFrom ?? 0 }] }; done(); };
      sec.append(on, el("p", { textContent: "合成にしない場合は、これまでどおりの1枚の画です。" }));
    } else {
      const c = s.comp; c.layout ??= { type: "custom" };
      const lay = el("div", { className: "lookControls" });
      lay.append(sel("型", c.layout, "type", COMP_LAYOUTS as any, "custom", true));
      if (["split", "mirror"].includes(c.layout.type)) lay.append(sel("向き", c.layout, "dir", COMP_DIRS as any, "v"), num("比率（0.1〜0.9）", c.layout, "ratio", 0.1, 0.9, 0.01, 0.5), num("角度（度）", c.layout, "angle", -45, 45, 1, 0));
      if (c.layout.type === "panels") lay.append(num("コマ数（1〜4）", c.layout, "count", 1, 4, 1, 2), num("比率", c.layout, "ratio", 0.1, 0.9, 0.01, 0.5), chk("拍ごとにコマが増える", c.layout, "grow"), num("増える間隔（拍）", c.layout, "step", 0.25, 8, 0.25, 1));
      if (c.layout.type === "pip") lay.append(chk("小窓は最初から（増えない）", { get grow() { return c.layout.grow === false; }, set grow(v: boolean) { if (v) c.layout.grow = false; else delete c.layout.grow; } } as any, "grow"));
      sec.append(el("h4", { textContent: "画面の分け方" }), lay);
      c.panels.forEach((p: any, n: number) => {
        const box = el("div", { className: "lookControls" });
        box.append(assetSel(p), num("開始位置（秒）", p, "from", 0, 3600, 0.05, 0), num("速さ（倍）", p, "rate", 0.1, 4, 0.05, 1), chk("止める（フリーズ）", p, "freeze"),
          num("中心 横%", p, "cx", 0, 100, 1, 50), num("中心 縦%", p, "cy", 0, 100, 1, 50), num("拡大 始め", p, "z", 0.5, 5, 0.05, 1), num("拡大 終わり", p, "z1", 0.5, 5, 0.05),
          num("傾き 始め", p, "rot", -180, 180, 1, 0), num("傾き 終わり", p, "rot1", -180, 180, 1), num("横移動 始め%", p, "dx", -50, 50, 1, 0), num("横移動 終わり%", p, "dx1", -50, 50, 1),
          chk("左右反転", p, "flipX"), chk("上下反転", p, "flipY"), num("出る秒（シーン内）", p, "appear", 0, len, 0.01), num("消える秒", p, "until", 0, len, 0.01), sel("入り方", p, "slide", COMP_SLIDES as any, "none"));
        const rm = el("button", { textContent: "このパネルを消す", disabled: c.panels.length < 2 }); rm.onclick = () => { c.panels.splice(n, 1); done(); };
        sec.append(el("h4", { textContent: `パネル${n + 1}${p.box || p.clip ? "（独自の枠）" : ""}` }), box, rm);
      });
      const add = el("button", { textContent: "パネルを追加", disabled: c.panels.length >= 6 }); add.onclick = () => { const last = c.panels.at(-1); c.panels.push({ asset: last?.asset ?? s.asset, from: 0 }); done(); };
      const fxb = el("div", { className: "lookControls" });
      fxb.append(num("揺れ", c, "shake", 0, 60, 1, 0), num("ズームパンチ（0〜1）", c, "punch", 0, 1, 0.01, 0), num("パンチ時の傾き（度）", c, "tilt", -45, 45, 1, 0), sel("入り方", c, "enter", COMP_ENTER as any, "none"), sel("線", c, "border", COMP_BORDERS as any, "none"));
      sec.append(add, el("h4", { textContent: "動き・線" }), fxb, el("h4", { textContent: "インパクト（白・ネガ・色収差）" }));
      (c.fx ??= []).forEach((x: any, n: number) => { const row = el("div", { className: "lookControls" }); const rm2 = el("button", { textContent: "消す" }); rm2.onclick = () => { c.fx.splice(n, 1); if (!c.fx.length) delete c.fx; done(); }; row.append(sel("種類", x, "type", COMP_FX as any, "__"), num("秒（シーン内）", x, "t", 0, len, 0.01), num("長さ（秒）", x, "d", 0.01, 2, 0.01), rm2); sec.append(row); });
      if (!c.fx.length) delete c.fx;
      const addFx = el("button", { textContent: "インパクトを追加" }); addFx.onclick = () => { (c.fx ??= []).push({ t: 0, d: 2 / (data.fps ?? 30), type: "white" }); done(); };
      const cardOn = el("input", { type: "checkbox", checked: !!c.card }); cardOn.onchange = () => { if (cardOn.checked) c.card = { name: "名前", side: "left" }; else delete c.card; done(); };
      sec.append(addFx, el("h4", { textContent: "フリーズ＋名前カード" }), label("名前カードを出す", cardOn));
      if (c.card) { const b = el("div", { className: "lookControls" }); b.append(txt("名前", c.card, "name", 40), txt("小さい文字", c.card, "sub", 60), color("帯の色", c.card, "color", compColors(data).red), sel("位置", c.card, "side", { left: "左", right: "右" }, "left")); sec.append(b); }
      const titleOn = el("input", { type: "checkbox", checked: !!c.title }); titleOn.onchange = () => { if (titleOn.checked) c.title = { text: data.title ?? "TITLE" }; else delete c.title; done(); };
      sec.append(el("h4", { textContent: "タイトル文字" }), label("タイトルを出す", titleOn));
      if (c.title) { const b = el("div", { className: "lookControls" }); b.append(txt("文字", c.title, "text", 40), num("出る秒（シーン内）", c.title, "at", 0, len, 0.01, 0), sel("見せ方", c.title, "style", COMP_TITLE as any, "slam")); sec.append(b); }
      const off = el("button", { textContent: "合成をやめる（元の1枚の画に戻す）" }); off.onclick = () => { delete s.comp; done(); };
      sec.append(off);
    }
    // whole video
    const g = data.comp ?? {}; const gb = el("div", { className: "lookControls" });
    const put = () => { const keep = Object.keys(g).filter((k) => !(k === 'colors' && !Object.keys(g.colors ?? {}).length) && !(k === 'grade' && g.grade?.look === 'none' && Object.keys(g.grade).length === 1)); if (keep.length) data.comp = Object.fromEntries(keep.map((k) => [k, g[k]])); else delete data.comp; };
    after = put;
    const gc = (g.colors ??= {}); const grade = (g.grade ??= { look: "none" });
    const gcol = (t: string, k: "red" | "teal") => { const e = el("input", { type: "color", value: gc[k] ?? compColors(data)[k] }); e.oninput = () => { gc[k] = e.value; put(); live(); }; return label(t, e); };
    const lookSel = el("select"); for (const [a, b] of Object.entries(COMP_LOOKS)) lookSel.append(el("option", { value: a, textContent: b })); lookSel.value = grade.look; lookSel.onchange = () => { grade.look = lookSel.value; put(); done(); };
    gb.append(label("色調（ルック）", lookSel));
    if (grade.look === "cube") gb.append(txt("LUTファイル（プロジェクト内 .cube）", grade, "lut", 120));
    if (grade.look === "ink") gb.append(num("他の色の残り（0〜1）", grade, "base", 0, 1, 0.01, 0.1));
    gb.append(gcol("赤ネガ・アクセント色", "red"), gcol("青緑ネガ・アクセント色", "teal"), num("網点（0〜1）", g, "halftone", 0, 1, 0.01, 0), num("周辺の暗さ（0〜1）", g, "vignette", 0, 1, 0.01, 0), chk("光の粒を出す", g, "particles"), chk("最後に暗くする", g, "endFade"), chk("歌詞の下を暗くする", g, "shade"));
    if (!Object.keys(gc).length) delete g.colors; if (grade.look === "none" && Object.keys(grade).length === 1) delete g.grade;
    sec.append(el("h3", { textContent: "合成（動画全体）" + (data.comp ? " ✎" : "") }), gb, el("p", { textContent: "色調は素材を書き換えません。プレビューは近似、MP4書き出しで正確なLUTを当てます。全体設定は合成シーンがある動画でだけ使われます（光の粒・最後の暗転・歌詞の下の影は、全体設定があると既定でオフ）。" }));
  };
  return draw;
}
