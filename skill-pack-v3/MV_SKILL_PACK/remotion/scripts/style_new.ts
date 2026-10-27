// Scaffold a new lyric-motion style: component + catalogue entry + test + README row.
// usage: npm run style:new -- <name> --short "短い名前" --ja "どんな動きか" [--energy low|mid|high] [--font lyrics|round|stamp|sans|serif]
//        npm run style:check -- <name>   (test + stills 16:9/9:16/1:1 + 3 s render)
import { CATALOG } from "../src/lib/catalog";
import { PACK_DIR, REMOTION_DIR, UserError, fail, fs, log, npx, parseArgs, path } from "./common";

const CUSTOM = path.join(REMOTION_DIR, "src", "styles", "custom");
const camel = (n: string) => n.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export function template(name: string, o: { font: string }) {
  return `// Lyric style "${name}" (made with npm run style:new). Edit the motion inside the function.
// Rules (see .agents/skills/mv-style-create/SKILL.md):
// - all motion comes from time (c.t), char timings (c.L.chars[i].t0/t1) and the beat (c.beat): no randomness without rng(seed)
// - lay out with layoutH/layoutV so text wraps inside the safe frame on every aspect ratio
// - return boxes for every glyph (keyword decorations and QA use them)
// - drawH() applies keyword effects (kwMod), palette and per-line fonts automatically
import { beatPulse, clamp, easeOut, easeOutBack } from "../../lib/core";
import { layoutH } from "../layout";
import { drawH, type StyleFn } from "../prims";

export const ${camel(name)}: StyleFn = (c) => {
  const P = c.P; // params: defaults from catalog.custom.ts, overridable per line/section in mv.config.json
  const l = layoutH(c.L, c.W, c.H, { size: Number(P.size_base ?? 0.075), v: c.textY, k: c.k, maxw: 0.86 });
  const enter = Number(P.enter ?? 0.25);
  return drawH(c, l, (i, age) => {
    const p = clamp((age + 0.05) / enter);
    if (p <= 0) return null; // not sung yet -> hidden
    const pulse = age > enter ? beatPulse(c.beat, c.t, 0.12) : 0;
    return { a: easeOut(p, 2), dy: (1 - easeOut(p)) * l.px * 0.6, s: 0.8 + 0.2 * easeOutBack(p) + 0.05 * pulse };
  }, { font: "${o.font}" });
};
`;
}
export function testTemplate(name: string) {
  return `import { describe, expect, it } from "vitest";
import { ASPECTS_WH, sample } from "./harness";
import { CATALOG, canonicalStyle } from "../../src/lib/catalog";

describe("style ${name}", () => {
  it("is registered", () => { expect(CATALOG.${name}).toBeTruthy(); expect(canonicalStyle("${name}")).toBe("${name}"); });
  it.each(ASPECTS_WH)("stays inside the frame at %ix%i and has no NaN", (W, H) => {
    for (const s of sample("${name}", W, H)) {
      for (const b of s.boxes) { expect(b.every(Number.isFinite)).toBe(true); expect(b[0]).toBeGreaterThan(-W * 0.02); expect(b[2]).toBeLessThan(W * 1.02); expect(b[1]).toBeGreaterThan(-H * 0.02); expect(b[3]).toBeLessThan(H * 1.02); }
    }
  });
  it("is hidden before the line and visible while sung", () => {
    const [before, , mid] = sample("${name}", 1920, 1080, [0.2, 1.2, 2.2]);
    expect(mid.boxes.length).toBeGreaterThan(0);
    expect(before.out.el).toBeTruthy();
  });
});
`;
}

function insertAt(file: string, marker: string, text: string) {
  const s = fs.readFileSync(file, "utf8");
  if (!s.includes(marker)) throw new UserError(`${path.basename(file)} の目印「${marker}」が見つかりません`, "その行を消していないか確認してください。");
  fs.writeFileSync(file, s.replace(marker, `${text}\n${marker}`));
}

export function scaffold(name: string, o: Record<string, any>) {
  if (!/^[a-z][a-z0-9_]{2,30}$/.test(name)) throw new UserError(`名前「${name}」は使えません`, "英小文字・数字・_ で 3〜31 文字（例: sakura_fall）");
  if (CATALOG[name]) throw new UserError(`「${name}」はもうあります`, "別の名前にしてください。");
  const short = String(o.short ?? name), ja = String(o.ja ?? "（説明を書いてください）"), energy = String(o.energy ?? "mid"), font = String(o.font ?? "lyrics");
  if (!["low", "mid", "high"].includes(energy)) throw new UserError("--energy は low / mid / high", "静か=low、中=mid、激しい=high");
  const file = path.join(CUSTOM, `${name}.tsx`);
  fs.writeFileSync(file, template(name, { font }));
  insertAt(path.join(CUSTOM, "index.ts"), "// @style:new import (do not remove this line)", `import { ${camel(name)} } from "./${name}";`);
  insertAt(path.join(CUSTOM, "index.ts"), "  // @style:new entry (do not remove this line)", `  ${name}: ${camel(name)},`);
  insertAt(path.join(REMOTION_DIR, "src", "lib", "catalog.custom.ts"), "  // @style:new catalog (do not remove this line)", `  ${name}: { short: ${JSON.stringify(short)}, ja: ${JSON.stringify(ja)}, energy: "${energy}", defaults: { enter: 0.25 } },`);
  fs.writeFileSync(path.join(REMOTION_DIR, "tests", "styles", `${name}.test.ts`), testTemplate(name));
  // README style table row
  const rp = path.join(PACK_DIR, "README_ja.md"), rd = fs.readFileSync(rp, "utf8").split("\n");
  const rows = rd.map((l, i) => [l, i] as const).filter(([l]) => /^\| \d+ \| `/.test(l));
  if (rows.length) { const [, last] = rows[rows.length - 1]; const n = rows.length + 1;
    rd.splice(last + 1, 0, `| ${n} | \`${name}\` | ${short} | ${ja} | ${{ low: "静", mid: "中", high: "強" }[energy]} |`); fs.writeFileSync(rp, rd.join("\n")); }
  log(`✅ 新しい文字スタイル「${name}」の雛形を作りました`);
  log(`   動き: src/styles/custom/${name}.tsx  /  名前・説明・既定値: src/lib/catalog.custom.ts  /  テスト: tests/styles/${name}.test.ts`);
  log(`   次: 動きを書く → npm run style:check -- ${name}`);
}

export function check(name: string, o: Record<string, any>) {
  if (!CATALOG[name]) throw new UserError(`スタイル「${name}」がありません`, "npm run styles で一覧を確認。");
  npx(["vitest", "run", `tests/styles/${name}.test.ts`]);
  for (const a of ["16:9", "9:16", "1:1"]) npx(["tsx", "scripts/showcase.ts", "--only", name, "--stills", "--aspect", a, "--seconds", "3"]);
  const outs = fs.readdirSync(path.join(REMOTION_DIR, "out", "showcase_stills"));
  if (!o["no-render"]) npx(["tsx", "scripts/showcase.ts", "--only", name, "--seconds", "3", "--out", `out/style_${name}.mp4`]);
  log(`✅ テスト OK。静止画: remotion/out/showcase_stills/（${outs.length}枚）${o["no-render"] ? "" : `  動画: remotion/out/style_${name}.mp4`}`);
  log("   目で見て: 読める？ 画面からはみ出さない？ 縦長でも字が切れない？ 語エフェクト（キライ＝ひび）が付く？");
}

async function main() {
  const { o, rest } = parseArgs(process.argv.slice(2));
  if (process.argv[1]?.includes("check") || rest[0] === "check") return check(String(rest[rest[0] === "check" ? 1 : 0] ?? ""), o);
  if (!rest[0]) throw new UserError("スタイル名を指定してください", '例: npm run style:new -- sakura_fall --short "桜吹雪" --ja "花びらのように舞って着地する" --energy mid');
  scaffold(rest[0], o);
}
if (process.argv[1]?.match(/style_new\.ts$/)) main().catch(fail);
