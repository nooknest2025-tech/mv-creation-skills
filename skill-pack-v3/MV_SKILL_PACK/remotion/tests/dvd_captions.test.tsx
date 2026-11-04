// 「ライブDVD風」 captions (dvd_*): catalogue registration, drawing (editor preview = MP4 export = npm run mv), added caption lines,
// boxX/boxY placement, server.py save validation, and the editor's stills check helpers.
import { describe, expect, it } from "vitest";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs"; import os from "os"; import path from "path"; import { spawn, spawnSync } from "child_process";
import { CATALOG, AUTO_POOLS, canonicalStyle } from "../src/lib/catalog";
import { TRAITS } from "../src/lib/traits";
import { STYLES } from "../src/styles/styles";
import { DVD_KINDS, DVD_FREE_TEXT, clockSeconds, dvdTimecode, dvdBeat, isCaption, newCaption } from "../src/lib/dvd";
import { Scene } from "../editor/editor-scene";
import { dvdSpec } from "../editor/dvd-styles";
import { originalIds } from "../editor/dvd-panel";
import { LYRIC_EDIT_KEYS } from "../src/lib/lyricEdits";
import { prepareProject } from "../scripts/editor";
// @ts-ignore plain ESM helper used by stills-check.mjs
import { parseSeconds, frameAt, sheetLayout, stillName, HOOK_SECONDS } from "../editor/stills-plan.mjs";

const R = path.resolve(__dirname, "..");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const base = (lyrics: any[], extra: any = {}) => ({ duration: 20, width: 1280, height: 720, fps: 30, bpm: 120, assets: ["a.png"], scenes: [{ id: "S1", start: 0, asset: 0, transition: 0 }], lyrics, ...extra });
const lyric = (o: any) => ({ id: "L001", text: "はじまりの歌", start: 1, end: 5, motion: "reveal", scale: 1, y: 0.8, motionDuration: 0.8, ...o });
const html = (data: any, t: number) => renderToStaticMarkup(<Scene data={data} t={t} />);

describe("ライブDVD風 captions are a real lyric style", () => {
  it("every dvd_* is in the catalogue (so the editor list and server.py accept it) and has a renderer", () => {
    expect(DVD_KINDS).toEqual(["dvd_sub", "dvd_card", "dvd_title", "dvd_cam", "dvd_dim", "dvd_roll"]);
    for (const k of DVD_KINDS) { expect(CATALOG[k]?.short).toMatch(/ライブDVD/); expect(STYLES[k]).toBeTypeOf("function"); expect(canonicalStyle(k)).toBe(k); }
    expect(canonicalStyle("ライブDVD・字幕")).toBe("dvd_sub");
    expect(DVD_FREE_TEXT).not.toContain("dvd_sub");
  });
  it("never chosen automatically (only when the user picks it)", () => {
    for (const k of DVD_KINDS) { expect(TRAITS[k]).toBeUndefined(); for (const pool of Object.values(AUTO_POOLS)) expect(pool).not.toContain(k); }
  });
  it("timecode / beat helpers have neutral defaults", () => {
    expect(clockSeconds("01:02:03")).toBe(3723); expect(clockSeconds("02:03")).toBe(123); expect(clockSeconds("x")).toBe(0);
    expect(dvdTimecode("00:00:58", 2.5, 30)).toBe("00:01:00:15");
    expect(dvdTimecode(undefined, 0, 30)).toBe("00:00:00:00");
    expect(dvdBeat(0.5, 120)).toBe(0.5); expect(dvdBeat(undefined, 120)).toBe(1); expect(dvdBeat(undefined)).toBe(0.8);
  });
  it("no song-specific text, clock or tempo is built in", () => {
    for (const f of ["src/lib/dvd.ts", "src/styles/custom/dvd.tsx", "editor/dvd-styles.tsx", "editor/dvd-panel.ts", "editor/stills-check.mjs", "editor/stills-plan.mjs"]) {
      const src = fs.readFileSync(path.join(R, f), "utf8");
      expect(src, f).not.toMatch(/15:42|0\.863|138\.5|ヘンドレ|カフェ|Pollo|126\.2/);
    }
  });
});

describe("editor preview / export draws them", () => {
  const card = { id: "DVD-1", extra: true, text: "会場名テスト", sub: "HALL · 2026", start: 2, end: 8, motion: "dvd_card", scale: 1, y: 0.5, motionDuration: 0.8 };
  it("venue card shows its own text and sub line", () => {
    const h = html(base([lyric({}), card]), 4);
    expect(h).toContain("会場名テスト"); expect(h).toContain("HALL · 2026"); expect(h).toContain("はじまりの歌".slice(0, 1));
  });
  it("dvd_sub on a lyric line keeps the lyric text, at the bottom", () => {
    const h = html(base([lyric({ motion: "dvd_sub" })]), 3);
    expect(h).toContain("はじまりの歌"); expect(h).toMatch(/bottom:54px/);
  });
  it("title reveals over the beat; camera timecode runs from the start clock with the project fps", () => {
    const title = { ...card, id: "DVD-2", motion: "dvd_title", text: "TITLE", pre: "LIVE", sub: "SUB", beat: 0.5 };
    expect(html(base([lyric({}), title]), 6)).toMatch(/LIVE[\s\S]*TITLE[\s\S]*SUB/);
    const cam = { ...card, id: "DVD-3", motion: "dvd_cam", text: "CAM 2", sub: "10:00:00", start: 2, end: 9 };
    const h = html(base([lyric({}), cam], { fps: 25 }), 3.5);
    expect(h).toContain("CAM 2"); expect(h).toContain("10:00:01:12"); expect(h).toContain("REC");
  });
  it("credits roll: #heading, rule, >note, role|name", () => {
    const roll = { ...card, id: "DVD-4", motion: "dvd_roll", text: "#THANKS\n-\nVOCAL|名前A\n>note", start: 15, end: 20 };
    const h = html(base([lyric({}), roll]), 17); for (const s of ["THANKS", "VOCAL", "名前A", "note"]) expect(h).toContain(s);
  });
  it("captions may run into the last second (credits); normal lyrics still stop 1 s before the end", () => {
    const roll = { ...card, id: "DVD-4", motion: "dvd_roll", text: "#END", start: 15, end: 20 };
    const h = html(base([lyric({ start: 15, end: 20, text: "最後の歌詞" }), roll]), 19.5);
    expect(h).toContain("END"); expect(h).not.toContain("最後の歌詞");
  });
  it("dim reads params.dim (older projects: scale ≤ 1)", () => {
    expect(dvdSpec({ motion: "dvd_dim", start: 0, end: 4, params: { dim: 0.3 } }).dim).toBe(0.3);
    expect(dvdSpec({ motion: "dvd_dim", start: 0, end: 4, scale: 0.7 }).dim).toBe(0.7);
    expect(dvdSpec({ motion: "dvd_title", start: 0, end: 4 }, { bpm: 150 }).beat).toBeCloseTo(0.8);
  });
  it("boxX / boxY place a normal line by its top-left corner (0..1 of the frame)", () => {
    const a = html(base([lyric({ start: 0, end: 6 })]), 3), b = html(base([lyric({ start: 0, end: 6, boxX: 0.05, boxY: 0.05 })]), 3);
    expect(a).not.toBe(b);
    expect(LYRIC_EDIT_KEYS).toContain("boxX"); expect(LYRIC_EDIT_KEYS).toContain("boxY");
    const srv = fs.readFileSync(path.join(R, "editor/server.py"), "utf8"); expect(srv).toMatch(/LYRIC_EDIT_KEYS=\[[^\]]*'boxX','boxY'\]/);
  });
});

describe("added caption lines (editor 「ライブDVD風テロップ」)", () => {
  it("newCaption: unique id, marked extra, inside the song, neutral texts", () => {
    const ids = new Set(["L001", "DVD-1"]);
    const c = newCaption("dvd_title", 18, 20, ids, 120);
    expect(c.extra).toBe(true); expect(ids.has(c.id)).toBe(false); expect(c.end).toBeLessThanOrEqual(20); expect(c.start).toBeLessThan(c.end);
    expect(c.beat).toBe(1); expect(c.motion).toBe("dvd_title");
    expect(newCaption("dvd_cam", 0, 20, ids).sub).toBe("00:00:00");
    expect(newCaption("dvd_dim", 0, 20, ids).params.dim).toBe(0.6);
  });
  it("isCaption: extra flag, or an old dvd_* line that is not from the lyrics", () => {
    const orig = originalIds({ sourceLyrics: [{ text: "a" }, { text: "b" }] });
    expect([...orig]).toEqual(["L001", "L002"]);
    expect(isCaption({ id: "X", extra: true }, orig)).toBe(true);
    expect(isCaption({ id: "CARD", motion: "dvd_card" }, orig)).toBe(true);
    expect(isCaption({ id: "L001", motion: "dvd_sub" }, orig)).toBe(false);
    expect(isCaption({ id: "SPLIT_1", motion: "dvd_sub", sourceParts: [] }, orig)).toBe(false);
  });
});

describe("stills check helpers (npm run editor:stills)", () => {
  it("defaults to the 0/1/2/3 s hook check; custom seconds are sorted, deduped and kept inside the song", () => {
    expect(HOOK_SECONDS).toEqual([0, 1, 2, 3]); expect(parseSeconds(undefined, 60)).toEqual([0, 1, 2, 3]);
    expect(parseSeconds("3, 1,1,90", 60)).toEqual([1, 3, 60]); expect(() => parseSeconds("a", 60)).toThrow(/秒数/); expect(() => parseSeconds("-1", 60)).toThrow();
    expect(frameAt(60, 30, 1800)).toBe(1799); expect(frameAt(1.5, 30, 1800)).toBe(45); expect(stillName(2.5)).toBe("still-2_50s.jpg");
    expect(sheetLayout(4)).toMatchObject({ cols: 2, rows: 2, layout: "0_0|w0_0|0_h0|w0_h0" }); expect(sheetLayout(3).cols).toBe(2);
    const pkg = JSON.parse(fs.readFileSync(path.join(R, "package.json"), "utf8")); expect(pkg.scripts["editor:stills"]).toMatch(/stills-check\.mjs/);
  });
});

describe.skipIf(!py)("server.py save accepts dvd captions and checks their fields", () => {
  it("saves a lyric with dvd_sub, added captions (also to the very end), rejects bad ones in Japanese", async () => {
    const cat = path.join(R, "editor/style-catalog.json");
    if (!fs.existsSync(cat) || !JSON.parse(fs.readFileSync(cat, "utf8")).dvd_sub) fs.writeFileSync(cat, JSON.stringify(CATALOG, null, 2)); // generated file (same as editor/build.mjs)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-dvd-")); fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    const r = prepareProject({ demo: true, project: dir });
    const port = 5600 + Math.floor(Math.random() * 300);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", r.runtime, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MV_NO_PICKER: "1" } });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      let st = await (await fetch(url + "/api/state")).json();
      const D = st.data.duration;
      const save = async (mut: (d: any) => void) => { const d = structuredClone(st.data); mut(d); const res = await fetch(url + "/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: st.revision, data: d }) }); return [res.status, await res.json()] as const; };
      const cap = (o: any = {}) => ({ id: "DVD-1", extra: true, text: "会場", sub: "HALL", start: 0.5, end: D, motion: "dvd_card", scale: 1, y: 0.5, motionDuration: 0.8, ...o });
      for (const bad of [
        (d: any) => d.lyrics.push(cap({ motion: "reveal" })),
        (d: any) => d.lyrics.push(cap({ text: "" })),
        (d: any) => d.lyrics.push(cap({ sub: 5 })),
        (d: any) => d.lyrics.push(cap({ motion: "dvd_title", beat: 9 })),
        (d: any) => d.lyrics.push(cap({ motion: "dvd_dim", params: { dim: 2 } })),
        (d: any) => { d.lyrics[0].boxX = 1.5; },
        (d: any) => { d.lyrics[0].end = D; }, // normal lyrics still end 1 s before the song
      ]) { const [code, body] = await save(bad); expect(code).toBe(400); expect(body.error).toMatch(/[ぁ-んァ-ン一-龥]/); }
      const [ok, res] = await save((d) => { d.lyrics[0].motion = "dvd_sub"; d.lyrics[0].boxX = 0.1; d.lyrics.push(cap(), cap({ id: "DVD-2", motion: "dvd_roll", text: "#END\n-\nA|B", start: 1, end: D })); });
      expect(ok, JSON.stringify(res)).toBe(200);
      st = await (await fetch(url + "/api/state")).json();
      expect(st.data.lyrics.filter((l: any) => l.extra).length).toBe(2); expect(st.data.lyrics[0].edited).toContain("boxX");
    } finally { srv.kill(); }
  }, 20000);
});
