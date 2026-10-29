// Editor UI (合成 panel): backdrop / tilt / depth controls exist and write the same fields the renderer + validators read.
import { describe, expect, it } from "vitest";
import { composePanel } from "../editor/compose-panel";
import { checkComp, checkGlobalComp } from "../src/lib/compose";
class El { kids: El[] = []; attrs: Record<string, string> = {}; listeners: Record<string, (() => void)[]> = {}; [k: string]: any;
  constructor(public tag: string) {} append(...k: any[]) { for (const x of k) if (x instanceof El) this.kids.push(x); }
  replaceChildren() { this.kids = []; } setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(t: string, f: () => void) { (this.listeners[t] ??= []).push(f); }
  fire(t: "input" | "change") { this[`on${t}`]?.(); for (const f of this.listeners[t] ?? []) f(); } }
(globalThis as any).document = { createElement: (t: string) => new El(t) };
const all = (e: El): El[] => [e, ...e.kids.flatMap(all)];
const ctl = (root: El, label: string, nth = 0) => all(root).filter((e) => e.attrs["aria-label"] === label)[nth];
const set = (e: El, v: string, t: "input" | "change" = "input") => { e.value = v; e.fire(t); };

describe("compose panel UI", () => {
  it("scene + global backdrop illustration, panel dy/dy1/depth", () => {
    const data: any = { fps: 30, duration: 2, assets: [{ kind: "video", label: "v" }, { kind: "image", label: "shrine" }], scenes: [{ start: 0, asset: 0, comp: { layout: { type: "full" }, panels: [{ asset: 0 }] } }] };
    const host = new El("div"); let changes = 0;
    const draw = composePanel(host as any, { data: () => data, current: () => 0, change: () => changes++, preview: () => {} }); draw();
    const root = host.kids[0];
    set(ctl(root, "縦移動 始め%（ティルト）"), "-6"); set(ctl(root, "縦移動 終わり%"), "8"); set(ctl(root, "奥行き（パララックス 0〜3）"), "1.6");
    expect(data.scenes[0].comp.panels[0]).toMatchObject({ dy: -6, dy1: 8, depth: 1.6 });
    set(ctl(root, "背景", 0), "art", "change"); // scene backdrop
    expect(data.scenes[0].comp.backdrop).toMatchObject({ asset: 1 });
    // the scene backdrop controls are drawn above the panels, so they come first
    set(ctl(root, "拡大 終わり", 0), "1.5"); set(ctl(root, "縦移動 終わり%", 0), "-3"); set(ctl(root, "奥行き（0=固定・1=画面と同じ・2=手前）"), "0.3");
    expect(data.scenes[0].comp.backdrop).toMatchObject({ asset: 1, z1: 1.5, dy1: -3, depth: 0.3 });
    set(ctl(root, "背景", 1), "art", "change"); // whole video
    expect(data.comp.backdrop).toMatchObject({ asset: 1 });
    expect(() => checkComp(data.scenes[0].comp, 2, 2)).not.toThrow(); expect(() => checkGlobalComp(data.comp, 2)).not.toThrow();
    set(ctl(root, "背景", 0), "inherit", "change"); expect(data.scenes[0].comp.backdrop).toBeUndefined();
    set(ctl(root, "背景", 1), "footage", "change"); expect(data.comp.backdrop).toBe("footage");
    set(ctl(root, "背景", 1), "black", "change"); expect(data.comp?.backdrop).toBeUndefined();
    expect(changes).toBeGreaterThan(5);
  });
});
