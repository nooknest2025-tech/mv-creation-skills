/** 「ライブDVD風テロップ」 panel (lyric tab). Adds caption lines (venue card, title, camera display, dim, credits, free subtitle) at the
 *  playhead and edits their texts. Real lyric lines get the look by choosing 「ライブDVD・字幕」 etc. as their motion. */
import { DVD_KINDS, DVD_STYLES_INFO, DVD_DEFAULTS, isCaption, newCaption, isDvdMotion, dvdBeat } from "../src/lib/dvd";
type Ctx = { data: () => any; orig: () => any; selected: () => any; now: () => number; change: () => void; redraw: (id: string) => void; preview: () => void; error: (msg: string) => void };
const el = (tag: string, props: any = {}, ...kids: (Node | string)[]) => { const e: any = document.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; };
export const originalIds = (orig: any) => new Set<string>((orig?.sourceLyrics ?? orig?.lyrics ?? []).map((_: any, i: number) => `L${String(i + 1).padStart(3, "0")}`));
const HINT: Record<string, string> = {
  dvd_sub: "本文＝字幕。歌詞の行なら本文は歌詞のまま。強調色を白以外にすると文字がほんのり光ります。",
  dvd_card: "本文＝大きい行（会場名・街の名前など）、サブ行＝小さい行（会場・日付など）。左上に赤い線と一緒に出ます。線の色は「強調」色。",
  dvd_title: "上の行 → 本文（タイトル）→ 赤い線 → サブ行 の順に「間隔」秒ずつ出ます。間隔を空にすると曲のBPMの2拍分。",
  dvd_cam: "本文＝左上の表示、サブ行＝開始時刻（HH:MM:SS。そこから時間が進みます）、上の行＝左下の表示。",
  dvd_dim: "画面全体を暗くします（タイトルやクレジットの下に重ねる用）。暗さ 0〜1。",
  dvd_roll: "1行ずつ：#見出し＝大きく、-＝赤い線、>注記＝小さく、役割|名前＝2列、空行＝すき間。",
};
export function dvdPanel(host: HTMLElement, ctx: Ctx) {
  const sec = el("section", { className: "dvdControls" }); host.append(sec);
  const draw = () => {
    const data = ctx.data(), l = ctx.selected(); sec.replaceChildren(); if (!data || !l) return;
    const ids = originalIds(ctx.orig()), cap = isCaption(l, ids), dvd = isDvdMotion(l.motion);
    sec.append(el("h3", { textContent: "追加テキスト・テロップ" }));
    const kind = el("select"); kind.setAttribute("aria-label", "追加するテロップの種類");
    for (const k of DVD_KINDS) kind.append(el("option", { value: k, textContent: DVD_STYLES_INFO[k].short }));
    kind.append(el("option", { value: "text_free", textContent: "自由テキスト" }));
    kind.value = "dvd_card";
    const add = el("button", { textContent: "赤い線の位置に追加" });
    add.onclick = () => { const d = ctx.data(), free = kind.value === "text_free", line = newCaption(free ? "dvd_sub" : kind.value, ctx.now(), d.duration, new Set(d.lyrics.map((x: any) => x.id)), d.bpm); if (free) { line.motion = "simple"; line.text = "テキスト"; } d.lyrics.push(line); ctx.error(""); ctx.redraw(line.id); };
    sec.append(el("div", { className: "lineNav" }, el("label", {}, "種類 ", kind), add));
    if (!dvd) {
      if (cap) {
        const tx = el("textarea", { value: l.text, rows: 3 }); tx.setAttribute("aria-label", "テロップの本文");
        tx.oninput = () => { if (!tx.value.trim() || tx.value.length > 600) return; l.text = tx.value; const o = document.querySelector(`#lookLine option[value="${CSS.escape(l.id)}"]`); if (o) o.textContent = tx.value.split("\n")[0]; ctx.change(); };
        const del = el("button", { textContent: "このテキストを削除" }); del.onclick = () => { const d = ctx.data(), i = d.lyrics.findIndex((x: any) => x.id === l.id); if (i < 0 || d.lyrics.length <= 1) return; d.lyrics.splice(i, 1); ctx.redraw(d.lyrics[Math.min(i, d.lyrics.length - 1)].id); };
        sec.append(el("div", { className: "lookControls" }, el("label", { className: "wide" }, "本文 ", tx)), del);
      } else sec.append(el("p", { className: "hint", textContent: "自由テキストやタイトルは上のボタンで追加できます。" }));
      return;
    }
    sec.append(el("p", { className: "hint", textContent: (cap ? "追加テロップ：" : "歌詞の行：") + (HINT[l.motion] ?? "") }));
    const box = el("div", { className: "lookControls" });
    const put = (k: string, v: any) => { if (v === undefined || v === "") delete l[k]; else l[k] = v; ctx.change(); };
    if (cap) {
      const tx = el(l.motion === "dvd_roll" ? "textarea" : "input", { value: l.text, rows: 6 }); tx.setAttribute("aria-label", "テロップの本文");
      tx.oninput = () => { if (!tx.value.trim()) return; l.text = tx.value; const o = document.querySelector(`#lookLine option[value="${CSS.escape(l.id)}"]`); if (o) o.textContent = tx.value.split("\n")[0]; ctx.change(); };
      box.append(el("label", { className: "wide" }, "本文 ", tx));
    }
    if (["dvd_card", "dvd_title", "dvd_cam", "dvd_sub"].includes(l.motion) && (cap || l.motion !== "dvd_sub")) {
      const sub = el("input", { value: l.sub ?? "", placeholder: l.motion === "dvd_cam" ? DVD_DEFAULTS.clock : "" }); sub.setAttribute("aria-label", "サブ行");
      sub.oninput = () => put("sub", sub.value.slice(0, 120)); box.append(el("label", { className: "wide" }, l.motion === "dvd_cam" ? "開始時刻（サブ行） " : "サブ行 ", sub));
    }
    if (["dvd_title", "dvd_cam"].includes(l.motion)) {
      const pre = el("input", { value: l.pre ?? "", placeholder: l.motion === "dvd_cam" ? DVD_DEFAULTS.camFoot : "" }); pre.setAttribute("aria-label", "上の行");
      pre.oninput = () => put("pre", pre.value.slice(0, 120)); box.append(el("label", { className: "wide" }, l.motion === "dvd_cam" ? "左下の表示 " : "上の行 ", pre));
    }
    if (l.motion === "dvd_title") {
      const b = el("input", { type: "number", min: 0, max: 4, step: 0.05, value: l.beat ?? "", placeholder: dvdBeat(undefined, data.bpm).toFixed(2) }); b.setAttribute("aria-label", "タイトルが出る間隔（秒）");
      b.oninput = () => { const v = b.value === "" ? undefined : Number(b.value); if (v !== undefined && !(v >= 0 && v <= 4)) return; put("beat", v); }; box.append(el("label", {}, "間隔（秒） ", b));
    }
    if (l.motion === "dvd_dim") {
      const d = el("input", { type: "number", min: 0, max: 1, step: 0.05, value: l.params?.dim ?? DVD_DEFAULTS.dim }); d.setAttribute("aria-label", "暗さ");
      d.oninput = () => { const v = Number(d.value); if (d.value === "" || !(v >= 0 && v <= 1)) return; l.params = { ...(l.params ?? {}), dim: v }; ctx.change(); }; box.append(el("label", {}, "暗さ（0〜1） ", d));
    }
    const ex = el("input", { type: "number", min: 0.05, max: 3, step: 0.05, value: l.params?.exit ?? DVD_DEFAULTS.exit }); ex.setAttribute("aria-label", "消える時間（秒）");
    ex.oninput = () => { const v = Number(ex.value); if (ex.value === "" || !(v >= 0.05 && v <= 3)) return; l.params = { ...(l.params ?? {}), exit: v }; ctx.change(); };
    box.append(el("label", {}, "消える時間（秒） ", ex), el("small", { textContent: "出てくる時間は「出現秒」です。" }));
    sec.append(box);
    const nav = el("div", { className: "lineNav" }); const pv = el("button", { textContent: "このテロップを確認" }); pv.onclick = ctx.preview; nav.append(pv);
    if (cap) { const del = el("button", { textContent: "このテロップを削除" }); del.onclick = () => { const d = ctx.data(), i = d.lyrics.findIndex((x: any) => x.id === l.id); if (i < 0) return; d.lyrics.splice(i, 1); const next = d.lyrics[Math.min(i, d.lyrics.length - 1)] ?? d.lyrics[0]; ctx.redraw(next.id); }; nav.append(del); }
    sec.append(nav);
  };
  return draw;
}
