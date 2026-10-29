// Illustration backdrop (scene / global comp.backdrop), panel tilt pan (dy/dy1) and parallax depth; TS ⇔ server.py validation parity.
import { describe, expect, it } from "vitest";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import path from "path"; import { spawnSync } from "child_process";
import { backdropOf, checkBackdrop, checkComp, checkGlobalComp, coverScale, resolvePanels } from "../src/lib/compose";
import { CompScene, cardFontSize } from "../src/render/Compose";
const R = path.resolve(__dirname, "..");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const media = (a: number, t: number, _s: any, k: string) => <i key={k} data-a={a} data-t={t.toFixed(2)} />;
const base = () => ({ fps: 30, bpm: 139, duration: 2, assets: [{ kind: "video" }, { kind: "image" }], scenes: [{ start: 0, comp: { layout: { type: "full" }, panels: [{ asset: 0 }] } as any }, { start: 1, comp: { panels: [{ asset: 0 }] } }], comp: {} as any });
const html = (d: any, t: number) => renderToStaticMarkup(<CompScene data={d} i={0} t={t} W={1920} H={1080} media={media} />);

describe("illustration backdrop", () => {
  it("scene backdrop wins over global; default black", () => {
    const d = base(); expect(backdropOf(d, d.scenes[0].comp)).toBe("black");
    d.comp.backdrop = "footage"; expect(backdropOf(d, d.scenes[0].comp)).toBe("footage");
    d.scenes[0].comp.backdrop = { asset: 1 }; expect(backdropOf(d, d.scenes[0].comp)).toEqual({ asset: 1 });
  });
  it("draws the illustration (sharp, no footage blur) and moves it over the scene", () => {
    const d = base(); d.comp.backdrop = "footage";
    expect(html(d, 0.1)).toContain("blur(18px)");
    d.scenes[0].comp.backdrop = { asset: 1, z: 1.1, z1: 1.4, dx: -5, dx1: 5, dy: 0, dy1: -4 };
    const a = html(d, 0.05), b = html(d, 0.9);
    expect(a).not.toContain("blur(18px)"); expect(a).toContain('data-a="1"');
    const tr = (h: string) => h.match(/translate3d\(([-\d.]+)%, ([-\d.]+)%, 0\)[^"]*scale\(([\d.]+)\)/)!.slice(1).map(Number);
    const [x0, y0, z0] = tr(a), [x1, y1, z1] = tr(b);
    expect(x1).toBeGreaterThan(x0); expect(y1).toBeLessThan(y0); expect(z1).toBeGreaterThan(z0);
  });
  it("global illustration backdrop applies to scenes without their own", () => {
    const d = base(); d.comp.backdrop = { asset: 1, dim: 0.3 }; expect(html(d, 0.1)).toContain("brightness(0.700)");
  });
});

describe("scene end not on a frame boundary", () => {
  it("the last frame before the next scene still shows the panels (not just the backdrop)", () => {
    const d = base(); d.fps = 24; d.scenes[1].start = 0.97; d.comp.backdrop = { asset: 1 }; // 0.97*24 = 23.28 -> frame 23 (t=0.958) still belongs to scene 0
    expect(html(d, 23 / 24)).toContain('data-a="0"');
  });
});

describe("panel tilt pan + parallax depth", () => {
  it("dy/dy1 resolve (flipY mirrors) and widen the cover zoom", () => {
    const [p] = resolvePanels({ panels: [{ asset: 0, dy: 4, dy1: -6, depth: 2 }] }, 1920, 1080, 0.43);
    expect([p.dy, p.dy1, p.depth]).toEqual([4, -6, 2]);
    const m = resolvePanels({ layout: { type: "mirror", dir: "h" }, panels: [{ asset: 0, dy: 4 }] }, 1920, 1080, 0.43);
    expect(m[1].dy).toBe(-4); expect(resolvePanels({ panels: [{ asset: 0 }] }, 1920, 1080, 0.43)[0].depth).toBe(1);
    expect(coverScale(50, 50, 0, 0, 16 / 9, 10)).toBeGreaterThan(coverScale(50, 50, 0, 0, 16 / 9, 0));
  });
  it("a depth≠1 panel gets its own camera offset during shake; depth 1 does not", () => {
    const d = base(); d.scenes[0].comp = { layout: { type: "full" }, panels: [{ asset: 0 }], shake: 30, punch: 0.1 };
    const one = html(d, 0.1); d.scenes[0].comp.panels[0].depth = 2; const two = html(d, 0.1);
    expect(two).not.toBe(one); expect((two.match(/scale\(1\.0\d+\) rotate/g) ?? []).length).toBeGreaterThan(0);
  });
});

const cases: [string, any, any][] = [
  ["scene art ok", { panels: [{ asset: 0, dy: -10, dy1: 10, depth: 1.5 }], backdrop: { asset: 1, z: 1.1, z1: 1.3, dx: -4, dx1: 4, dy: 2, dy1: -2, rot: -2, rot1: 2, depth: 0.4, dim: 0.2, blur: 2, cx: 50, cy: 40, from: 0 } }, null],
  ["scene footage ok", { panels: [{ asset: 0 }], backdrop: "footage" }, null],
  ["scene bad asset", { panels: [{ asset: 0 }], backdrop: { asset: 9 } }, null],
  ["scene bad key", { panels: [{ asset: 0 }], backdrop: { asset: 1, foo: 1 } }, null],
  ["scene bad string", { panels: [{ asset: 0 }], backdrop: "white" }, null],
  ["dy range", { panels: [{ asset: 0, dy1: 60 }] }, null],
  ["depth range", { panels: [{ asset: 0, depth: 4 }] }, null],
  ["bd depth range", { panels: [{ asset: 0 }], backdrop: { asset: 1, depth: -1 } }, null],
  ["bd dim range", { panels: [{ asset: 0 }], backdrop: { asset: 1, dim: 2 } }, null],
  ["bd blur range", { panels: [{ asset: 0 }], backdrop: { asset: 1, blur: 50 } }, null],
  ["bd bool asset", { panels: [{ asset: 0 }], backdrop: { asset: true } }, null],
  ["global art ok", null, { backdrop: { asset: 1, z: 1.2 } }],
  ["global footage ok", null, { backdrop: "footage" }],
  ["global bad asset", null, { backdrop: { asset: 5 } }],
  ["global bad z", null, { backdrop: { asset: 1, z: 9 } }],
  ["global array", null, { backdrop: [1] }],
];
const tsOk = (c: any, g: any) => { try { if (c) checkComp(c, 2, 2); if (g) checkGlobalComp(g, 2); return true; } catch { return false; } };

describe("validation", () => {
  it("TS accepts/rejects as expected", () => {
    expect(cases.map(([n, c, g]) => [n, tsOk(c, g)])).toEqual(cases.map(([n]) => [n, n.endsWith(" ok")]));
    expect(() => checkBackdrop({ asset: 3 })).not.toThrow(); // asset count unknown -> integer only
  });
  it.skipIf(!py)("server.py check_comp / check_gcomp give the same answers (parity)", () => {
    const prog = `
import ast,json,math,re,sys
src=open(sys.argv[1],encoding='utf8').read();tree=ast.parse(src);ns={'math':math,'re':re}
keep=[n for n in tree.body if (isinstance(n,ast.FunctionDef) and n.name in ('check_comp','check_gcomp','check_backdrop')) or (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and (t.id.startswith('COMP_') or t.id=='BD_KEYS') for t in n.targets))]
exec(compile(ast.Module(body=keep,type_ignores=[]),'server.py','exec'),ns)
out=[]
for c,g in json.loads(sys.stdin.read()):
    try:
        if c is not None:ns['check_comp'](c,2,2)
        if g is not None:ns['check_gcomp'](g,2)
        out.append(True)
    except ValueError:out.append(False)
print(json.dumps(out))`;
    const r = spawnSync(py!, ["-c", prog, path.join(R, "editor/server.py")], { input: JSON.stringify(cases.map(([, c, g]) => [c, g])), encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(JSON.parse(r.stdout)).toEqual(cases.map(([, c, g]) => tsOk(c, g)));
  });
});

describe("name card title fits the band", () => {
  it("long names shrink to fit (first glyph never off the band); short names keep 120px", () => {
    const W = 1920, band = W * 0.62 - W * 0.05 - Math.tan((14 * Math.PI) / 180) * 210;
    for (const n of ["サンプルガーディアン", "サンプル侍", "SAMPLE GUARDIAN THE SECOND"]) {
      const fs = cardFontSize(n, W), em = Array.from(n).reduce((a, ch) => a + (/[\u0000-\u024F]/.test(ch) ? 0.62 : 1), 0);
      expect(fs * em + 20).toBeLessThanOrEqual(band);
    }
    expect(cardFontSize("サンプル侍", W)).toBe(120); expect(cardFontSize("サンプルガーディアン", W)).toBeLessThan(120);
    const d = base(); d.scenes[0].comp.card = { name: "サンプルガーディアン", side: "right" };
    expect(html(d, 0.5)).toContain(`font-size:${cardFontSize("サンプルガーディアン", 1920)}px`);
  });
});

describe("never black: slash wipe, lift, dim cap", () => {
  it("a slash wipe shows the outgoing scene underneath (not black / not the backdrop)", () => {
    const d = base(); d.comp.backdrop = { asset: 1 };
    d.scenes[1].comp = { layout: { type: "full" }, panels: [{ asset: 1 }], enter: "slash" };
    const h = renderToStaticMarkup(<CompScene data={d} i={1} t={1.0} W={1920} H={1080} media={media} />);
    expect(h).toContain('data-a="0"'); // previous scene's panel under the wipe
    const d2 = structuredClone(d); delete d2.scenes[1].comp.enter; // without the wipe: no outgoing picture
    expect(renderToStaticMarkup(<CompScene data={d2} i={1} t={1.0} W={1920} H={1080} media={media} />)).not.toContain('data-a="0"');
  });
  it("lift brightens a dark panel; backdrop dim is capped so it never goes near-black", () => {
    const d = base(); d.scenes[0].comp.panels[0].lift = 0.5; expect(html(d, 0.2)).toContain("brightness(1.5)");
    const e = base(); e.comp.backdrop = { asset: 1, dim: 1 }; expect(html(e, 0.2)).toContain("brightness(0.400)");
  });
});
