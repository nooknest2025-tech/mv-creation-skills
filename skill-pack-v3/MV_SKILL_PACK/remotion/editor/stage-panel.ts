/** v6.6 「ステージ（キャラ・ゲスト・テロップ）」 panel: generic editor controls for custom stages.
 *  Writes patches only (scene.stage per cut, data.stage project-wide); the stage definition itself is never changed,
 *  so untouched = built-in look, and 「元に戻す」 simply removes the patch. */
import { setPatch, arrayPatch, getAt, prune, firstWith, stageFor } from "../src/lib/stagePatch";
type Ctx = { data: () => any; current: () => number; change: () => void; now: () => number };
const DIRS: Record<string, string> = { l: "左から", r: "右から", t: "上から（逆さ）", b: "下から", tl: "左上の角", tr: "右上の角", bl: "左下の角", br: "右下の角" };
const el = (tag: string, props: any = {}, ...kids: (Node | string)[]) => { const e: any = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; };
function field(label: string, value: any, type: "num" | "text" | "check" | "color" | "select", onset: (v: any) => void, opt: any = {}) {
  let inp: any;
  if (type === "select") { inp = el("select"); for (const [k, v] of Object.entries(opt.options as Record<string, string>)) inp.append(el("option", { value: k, textContent: v })); inp.value = value ?? ""; inp.onchange = () => onset(inp.value); }
  else if (type === "check") { inp = el("input", { type: "checkbox", checked: !!value }); inp.onchange = () => onset(inp.checked); }
  else { inp = el("input", { type: type === "num" ? "number" : type === "color" ? "color" : "text", value: value ?? "" }); if (type === "num") Object.assign(inp, { step: opt.step ?? 0.01, min: opt.min ?? "", max: opt.max ?? "" });
    inp.oninput = () => { if (type === "num") { if (inp.value === "" || !Number.isFinite(Number(inp.value))) return; onset(Number(inp.value)); } else onset(inp.value); }; }
  inp.setAttribute("aria-label", label); return el("label", { className: opt.wide ? "wide" : "" }, label + " ", inp);
}
export function stagePanel(host: HTMLElement, ctx: Ctx) {
  const sec = el("section", { className: "stagePanel" }); host.append(sec);
  const draw = () => {
    const data = ctx.data(), i = ctx.current(), s = data.scenes[i], a = data.assets[s?.asset];
    sec.replaceChildren();
    const base = a?.stage; if (!base) { sec.hidden = true; return; } sec.hidden = false;
    const edit = (fn: () => void) => { fn(); prune(data.stage ?? {}); if (data.stage && !Object.keys(data.stage).length) delete data.stage; if (s.stage && !Object.keys(prune(s.stage)).length) delete s.stage; ctx.change(); draw(); };
    const P = (path: any[], v: any, dflt?: any) => edit(() => { s.stage = setPatch(s.stage, base, path, v, dflt); });
    sec.append(el("h3", { textContent: "キャラの位置・大きさ（このカット）" + (s.stage ? " ✎" : "") }));
    const cur = stageFor(data, i, base);
    for (const c of base.chars ?? []) { const cc = (cur.chars ?? []).find((x: any) => x.id === c.id) ?? c;
      sec.append(el("div", { className: "lookControls" }, el("strong", { textContent: c.id }),
        field("横にずらす", cc.dx ?? 0, "num", (v) => P(["chars", c.id, "dx"], v, 0), { min: -0.6, max: 0.6 }),
        field("縦にずらす", cc.dy ?? 0, "num", (v) => P(["chars", c.id, "dy"], v, 0), { min: -0.6, max: 0.6 }),
        field("大きさ（倍）", cc.k ?? 1, "num", (v) => P(["chars", c.id, "k"], v, 1), { min: 0.2, max: 3, step: 0.05 }),
        field("左右反転", cc.flip ?? false, "check", (v) => P(["chars", c.id, "flip"], v, false)),
        field("隠す", cc.hide ?? false, "check", (v) => P(["chars", c.id, "hide"], v, false)))); }
    sec.append(el("div", { className: "lineNav" },
      el("button", { textContent: "このカットの設定を全シーンへ", onclick: () => edit(() => { for (const x of data.scenes) if (x !== s && s.stage?.chars) x.stage = { ...(x.stage ?? {}), chars: structuredClone(s.stage.chars) }; }) }),
      el("button", { textContent: "元に戻す（このカット）", onclick: () => edit(() => { delete s.stage; }) })));
    // ---- project-wide: guests / name tags / interlude telop ----
    const proj = (key: string) => firstWith(data, key);
    const Q = (path: any[], v: any, dflt?: any) => edit(() => { data.stage = setPatch(data.stage, proj(String(path[0])), path, v, dflt); });
    const pv = (path: any[]) => getAt(stageFor({ stage: data.stage, scenes: [] }, 0, proj(String(path[0]))), path);
    const gs = proj("guests");
    if (gs) { const G = stageFor({ stage: data.stage, scenes: [] }, 0, gs).guests, ids = Object.keys(G.items ?? {}), names = Object.fromEntries(ids.map((k) => [k, G.items[k].name ?? k]));
      sec.append(el("h3", { textContent: "ゲスト（全体）" + (data.stage?.guests ? " ✎" : "") }));
      sec.append(el("div", { className: "lookControls" },
        field("ゲストを出す", !G.off, "check", (v) => Q(["guests", "off"], !v, false)),
        field("のぞき込みを出す", !G.peeksOff, "check", (v) => Q(["guests", "peeksOff"], !v, false)),
        field("アップ・分割のカットでも出す", !!G.peeksAnyCut, "check", (v) => Q(["guests", "peeksAnyCut"], v, false)),
        field("最後の集合写真", !G.groupOff, "check", (v) => Q(["guests", "groupOff"], !v, false))));
      for (const id of ids) sec.append(el("div", { className: "lookControls" }, el("strong", { textContent: id }),
        field("名前", G.items[id].name ?? "", "text", (v) => Q(["guests", "items", id, "name"], v)),
        field("出す", !G.items[id].off, "check", (v) => Q(["guests", "items", id, "off"], !v, false)),
        field("大きさ（倍）", G.items[id].scale ?? 1, "num", (v) => Q(["guests", "items", id, "scale"], v, 1), { min: 0.2, max: 3, step: 0.05 })));
      sec.append(el("h3", { textContent: "名前タグ（GUEST）" }));
      sec.append(el("div", { className: "lookControls" },
        field("タグを出す", !G.tagsOff, "check", (v) => Q(["guests", "tagsOff"], !v, false)),
        field("タグの文字", G.tag ?? "GUEST", "text", (v) => Q(["guests", "tag"], v, "GUEST")),
        field("タグの色", G.tagColor ?? "#ffd400", "color", (v) => Q(["guests", "tagColor"], v, "#ffd400")),
        field("大きさ（倍）", G.tagSize ?? 1, "num", (v) => Q(["guests", "tagSize"], v, 1), { min: 0.3, max: 3, step: 0.05 })));
      if (G.dalmeiTelop) sec.append(el("div", { className: "lookControls" }, el("strong", { textContent: "登場テロップ（" + (names.dalmei ?? "dalmei") + "）" }),
        field("出す", !G.dalmeiTelop.off, "check", (v) => Q(["guests", "dalmeiTelop", "off"], !v, false)),
        field("開始秒", G.dalmeiTelop.start, "num", (v) => Q(["guests", "dalmeiTelop", "start"], v), { step: 0.05 }),
        field("終了秒", G.dalmeiTelop.end, "num", (v) => Q(["guests", "dalmeiTelop", "end"], v), { step: 0.05 }),
        field("横位置", G.dalmeiTelop.x ?? 0.5, "num", (v) => Q(["guests", "dalmeiTelop", "x"], v, 0.5)),
        field("縦位置", G.dalmeiTelop.y ?? 0.9, "num", (v) => Q(["guests", "dalmeiTelop", "y"], v, 0.9))));
      const list = (key: string, title: string, cols: [string, string, string, any][], make: () => any) => {
        const rows = G[key] ?? []; sec.append(el("h3", { textContent: title }));
        rows.forEach((r: any, j: number) => { const set = (k: string, v: any) => edit(() => { data.stage = data.stage ?? {}; const arr = arrayPatch(data.stage, gs, ["guests", key]); arr[j] = { ...arr[j], [k]: v }; });
          sec.append(el("div", { className: "lookControls peekRow" }, ...cols.map(([k, lab, ty, o]) => field(lab, k === "on" ? !r.off : r[k] ?? o?.dflt, ty as any, (v) => k === "on" ? set("off", !v) : set(k, v), o)),
            el("button", { textContent: "削除", onclick: () => edit(() => { data.stage = data.stage ?? {}; arrayPatch(data.stage, gs, ["guests", key]).splice(j, 1); }) }))); });
        sec.append(el("button", { textContent: "＋ 追加（いまの秒）", onclick: () => edit(() => { data.stage = data.stage ?? {}; arrayPatch(data.stage, gs, ["guests", key]).push(make()); }) }));
      };
      list("peeks", "のぞき込み（拍で出入り）", [["on", "出す", "check", {}], ["id", "ゲスト", "select", { options: names }], ["t", "秒", "num", { step: 0.05 }], ["beats", "拍数", "num", { step: 1, min: 1, max: 8, dflt: 2 }], ["dir", "方向", "select", { options: DIRS }], ["pos", "位置", "num", { min: 0, max: 1, dflt: 0.5 }], ["scale", "大きさ", "num", { min: 0.2, max: 3, step: 0.05, dflt: 1 }]], () => ({ id: ids[0], t: Math.round(ctx.now() * 100) / 100, beats: 2, dir: "l", pos: 0.5 }));
      list("group", "最後の集合写真", [["on", "出す", "check", {}], ["id", "ゲスト", "select", { options: names }], ["x", "横位置", "num", { min: 0, max: 1 }], ["y", "足元の高さ", "num", { min: 0.3, max: 1.2, dflt: 0.995 }], ["h", "大きさ（画面比）", "num", { min: 0.05, max: 0.8 }]], () => ({ id: ids[0], x: 0.5, h: 0.25 }));
      list("telops", "名前テロップを追加", [["on", "出す", "check", {}], ["text", "文字", "text", { wide: true }], ["start", "開始秒", "num", { step: 0.05 }], ["end", "終了秒", "num", { step: 0.05 }], ["x", "横位置", "num", { min: 0, max: 1, dflt: 0.5 }], ["y", "縦位置", "num", { min: 0, max: 1, dflt: 0.9 }]], () => ({ text: "ゲスト", start: Math.round(ctx.now() * 100) / 100, end: Math.round(ctx.now() * 100) / 100 + 1.5 }));
    }
    const ps = proj("pause");
    if (ps) { const Pz = stageFor({ stage: data.stage, scenes: [] }, 0, ps).pause;
      sec.append(el("h3", { textContent: "間奏テロップ" + (data.stage?.pause ? " ✎" : "") }));
      sec.append(el("div", { className: "lookControls" },
        field("出す", !Pz.telopOff, "check", (v) => Q(["pause", "telopOff"], !v, false)),
        field("文字", Pz.telop ?? "", "text", (v) => Q(["pause", "telop"], v), { wide: true }),
        field("開始秒", Pz.telopStart ?? Pz.start, "num", (v) => Q(["pause", "telopStart"], v, Pz.start), { step: 0.05 }),
        field("消える秒（空=最後まで）", Pz.telopEnd ?? "", "num", (v) => Q(["pause", "telopEnd"], v), { step: 0.05 }),
        field("縦位置", Pz.telopY ?? 0.17, "num", (v) => Q(["pause", "telopY"], v, 0.17)),
        field("大きさ（倍）", Pz.telopSize ?? 1, "num", (v) => Q(["pause", "telopSize"], v, 1), { min: 0.3, max: 3, step: 0.05 }),
        field("文字色", Pz.telopColor ?? "#ffffff", "color", (v) => Q(["pause", "telopColor"], v, "#ffffff")),
        field("縁の色", Pz.telopStroke ?? ps.palette?.[3] ?? "#111111", "color", (v) => Q(["pause", "telopStroke"], v, ps.palette?.[3])),
        field("帯を出す", !Pz.bandOff, "check", (v) => Q(["pause", "bandOff"], !v, false)),
        field("帯の色", Pz.bandColor ?? "#111111", "color", (v) => Q(["pause", "bandColor"], v, "#111111")),
        field("帯の線の色", Pz.lineColor ?? ps.palette?.[2] ?? "#ffffff", "color", (v) => Q(["pause", "lineColor"], v, ps.palette?.[2]))));
      sec.append(el("h3", { textContent: "ゲスト紹介（間奏）" }));
      (Pz.intro ?? []).forEach((g: any, j: number) => { const set = (k: string, v: any) => edit(() => { data.stage = data.stage ?? {}; const arr = arrayPatch(data.stage, ps, ["pause", "intro"]); arr[j] = { ...arr[j], [k]: v }; });
        sec.append(el("div", { className: "lookControls peekRow" }, el("strong", { textContent: g.id }),
          field("出す", !g.off, "check", (v) => set("off", !v)), field("登場秒", g.t, "num", (v) => set("t", v), { step: 0.05 }),
          field("横位置", g.x, "num", (v) => set("x", v)), field("足元の高さ", g.y ?? 0.8, "num", (v) => set("y", v)), field("大きさ（倍）", g.scale ?? 1, "num", (v) => set("scale", v), { step: 0.05 }))); });
    }
    if (gs || ps) sec.append(el("button", { textContent: "ゲスト・テロップを元に戻す（全体）", onclick: () => edit(() => { delete data.stage; }) }));
  };
  return draw;
}
