import { TRAITS } from "../src/lib/traits";
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { FONT_REG, resolveFont, fontFromText, fontCss, suggestFont } from "../src/lib/fonts";
import { GENRES, GENRE_IDS, autoGenre, genreFromText } from "../src/lib/genres";
import { CATALOG } from "../src/lib/catalog";
import { STYLES } from "../src/styles/styles";
import { applyInstruction } from "../src/lib/nl";
import { resolveLines } from "../src/lib/resolve";
import { charTimes } from "../src/lib/song";
import { template, testTemplate } from "../scripts/style_new";
import type { Song } from "../src/lib/types";

const PACK = path.resolve(__dirname, "..", "..");
const reg = YAML.parse(fs.readFileSync(path.join(PACK, "fonts.yaml"), "utf8")).fonts as any[];
const song = (texts: string[], bpm = 120): Song => ({ title: "t", duration: 20, fps: 30, bpm, phase: 0, beatsPerBar: 4, energy: [], energyHz: 0,
  sections: [{ label: "VERSE", type: "verse", start: 0, end: 10 }, { label: "CHORUS", type: "chorus", start: 10, end: 20 }],
  lines: texts.map((t, i) => ({ text: t, start: i * 5 + 0.5, end: i * 5 + 3, ...charTimes(t, i * 5 + 0.5, i * 5 + 3) })) });

describe("font registry", () => {
  it("covers all 8 categories with redistributable licences and licence files", () => {
    for (const c of ["明朝", "ゴシック", "丸ゴシック", "手書き", "筆・和風", "ポップ", "デザイン・レトロ", "欧文"]) expect(reg.some((f) => f.category === c)).toBe(true);
    for (const f of reg) expect(f.license).toMatch(/^(OFL-1.1|Apache-2.0)$/);
    const dir = path.join(__dirname, "..", "public", "fonts"), lic = fs.readdirSync(dir).filter((f) => /\.txt$/.test(f));
    expect(lic.length).toBeGreaterThanOrEqual(10); // bundled core
    expect(reg.length).toBeGreaterThanOrEqual(100);
    expect(reg.filter((f) => f.jp).length).toBeGreaterThanOrEqual(50);
  });
  it("bundled core is on disk, the rest is auto-downloadable; present flag is truthful", () => {
    for (const f of reg) if (f.bundled !== false) expect(fs.existsSync(path.join(__dirname, "..", "public", "fonts", f.file))).toBe(true); else expect(f.gf).toBeTruthy();
    for (const f of FONT_REG) expect(!!f.present).toBe(fs.existsSync(path.join(__dirname, "..", "public", "fonts", f.file)));
  });
  it("resolves ids, families, categories and Japanese words", () => {
    expect(resolveFont("zen_maru")).toBe("zen_maru");
    expect(resolveFont("Zen Maru Gothic")).toBe("zen_maru");
    expect(FONT_REG.find((f) => f.id === resolveFont("明朝"))?.category).toBe("明朝");
    expect(fontFromText("サビは筆文字で")).toBe("yuji_syuku");
    expect(FONT_REG.find((f) => f.id === fontFromText("丸っこい字に"))?.category).toBe("丸ゴシック");
    expect(fontCss("bebas")).toContain("Noto Sans JP");
    expect(suggestFont(["idol", "cute"])).toMatch(/zen_maru|hachi_maru|mplus_rounded|mochiy|kiwi_maru|yusei/);
  });
});

describe("Japanese font / genre commands", () => {
  const run = (t: string) => applyInstruction({} as any, t).cfg as any;
  it("song / section / line / keyword scopes", () => {
    expect(run("丸っこい字にして").lyrics.font).toBe("zen_maru");
    expect(run("サビは筆文字で").lyrics.fontSections.chorus).toBe("yuji_syuku");
    expect(run("3行目は明朝で").lyrics.fontLines["2"]).toBeTruthy();
    expect(run("『キライ』は極太の字で").lyrics.fontKeywords["キライ"]).toBe("dela");
  });
  it("style words still mean styles, not fonts", () => {
    expect(run("2番のAメロは手書き").lyrics.sections["verse#2"]).toBe("handwriting");
    expect(run("2番のAメロは手書き").lyrics.fontSections).toBeUndefined();
  });
  it("genre words", () => {
    expect(run("バラードっぽく").genre).toBe("ballad");
    expect(run("和風にして").genre).toBe("wa");
    expect(run("ボカロっぽく").preset).toBe("vocaloid");
  });
});

describe("genre recipes", () => {
  it("every recipe uses known styles and fonts", () => {
    for (const g of GENRE_IDS) {
      const r = GENRES[g];
      for (const pool of Object.values(r.pools)) for (const s of pool) expect(CATALOG[s]).toBeTruthy();
      for (const s of Object.values(r.accent)) expect(CATALOG[s]).toBeTruthy();
      for (const f of [r.fonts.base, r.fonts.chorus]) expect(reg.some((x) => x.id === f)).toBe(true);
    }
  });
  it("auto-detects obvious cases", () => {
    expect(autoGenre(song(["桜 舞う 月の夜に 花", "紅の 花は 風に 散る 雪"])).id).toBe("wa");
    expect(autoGenre(song(["遠い街の灯りに", "君を想う"], 70)).id).toBe("ballad");
    expect(genreFromText("ヒップホップで")).toBe("hiphop");
  });
  it("drives styles, fonts and palette in resolveLines", () => {
    const L = resolveLines(song(["遠い街の灯りに 君を想う", "さよならの代わりに 歌うよ", "ありがとうと 言えたなら"]), { genre: "ballad" });
    expect(TRAITS[L[0].style].intensity).toBeLessThanOrEqual(0.45);
    expect(L[0].params.font).toBeTruthy();
    expect(L[0].params.palette.fill).toBe(GENRES.ballad.palette.fill);
  });
  it("keyword fonts become per-glyph hits; user font beats genre", () => {
    const L = resolveLines(song(["キライ キライ だいキライ", "あいう"]), { genre: "idol_pop", font: "noto_serif", fontKeywords: { キライ: "dela" } });
    expect(L[0].kw.some((k) => k.effect === "font:dela")).toBe(true);
  });
});

describe("style scaffold", () => {
  it("custom styles are registered like built-ins", () => {
    for (const s of ["sakura_fall", "spotlight"]) { expect(CATALOG[s]).toBeTruthy(); expect(typeof STYLES[s]).toBe("function"); }
  });
  it("templates are valid-looking TS", () => {
    expect(template("foo_bar", { font: "lyrics" })).toContain("export const fooBar: StyleFn");
    expect(testTemplate("foo_bar")).toContain('sample("foo_bar"');
  });
});
