// Font registry tools: list / fetch (auto-download bundled set) / add (file or Google Fonts name) / sync / sheet.
// usage: npm run fonts [list] | fonts:fetch | fonts:add -- <file|"Google Fonts name"> [--category 手書き --moods ballad,soft --weight Bold --license OFL-1.1] | fonts:sheet
import YAML from "yaml";
import { PACK_DIR, REMOTION_DIR, UserError, fail, fs, log, npx, parseArgs, path } from "./common";

export interface FontEntry { id: string; family: string; file: string; category: string; jp: boolean; moods: string[]; license: string; gf?: string; gfLicenseDir?: string; weight?: string; source?: string; bundled?: boolean }
export const CATEGORIES = ["明朝", "ゴシック", "丸ゴシック", "手書き", "筆・和風", "ポップ", "デザイン・レトロ", "欧文"];
export const REG_FILE = path.join(PACK_DIR, "fonts.yaml");
export const GEN_FILE = path.join(REMOTION_DIR, "src", "lib", "fonts.gen.json");
const FONT_DIR = path.join(REMOTION_DIR, "public", "fonts");
const REDISTRIBUTABLE = /^(OFL|Apache|UFL|MIT)/i;

export const loadRegistry = (): FontEntry[] => YAML.parse(fs.readFileSync(REG_FILE, "utf8")).fonts;
export function saveRegistry(list: FontEntry[]) {
  const head = fs.readFileSync(REG_FILE, "utf8").split("\nfonts:")[0];
  const flow = (f: FontEntry) => "  - " + YAML.stringify(f, { collectionStyle: "flow", lineWidth: 0 }).trim();
  fs.writeFileSync(REG_FILE, `${head}\nfonts:\n${list.map(flow).join("\n")}\n`);
}
/** registry -> JSON the renderer imports (only fonts whose file is present). */
export function syncRegistry() {
  const list = loadRegistry();
  fs.writeFileSync(GEN_FILE, JSON.stringify(list.map(({ id, family, file, category, jp, moods }) => ({ id, family, file, category, jp, moods, present: fs.existsSync(path.join(FONT_DIR, file)) })), null, 1) + "\n");
  return list;
}

async function gfFolder(dir: string, licDirs = ["ofl", "apache", "ufl"]) {
  for (const lic of licDirs) {
    const r = await fetch(`https://api.github.com/repos/google/fonts/contents/${lic}/${dir}`, { headers: { "user-agent": "mvpack" } });
    if (r.ok) return { lic, files: (await r.json()) as { name: string; download_url: string }[] };
  }
  return null;
}
const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new UserError(`ダウンロード失敗 ${r.status}: ${u}`, "ネット接続を確認して、もう一度実行してください。"); return Buffer.from(await r.arrayBuffer()); };

/** download one Google Fonts family; verifies the licence from METADATA.pb before saving. */
async function fetchGF(dir: string, want: { file?: string; weight?: string }, licDir?: string) {
  const g = await gfFolder(dir, licDir ? [licDir] : undefined);
  if (!g) throw new UserError(`Google Fonts に「${dir}」が見つかりません`, "名前のつづりを確認してください（例: \"Zen Maru Gothic\"）。https://fonts.google.com で検索できます。");
  const meta = (await get(g.files.find((f) => f.name === "METADATA.pb")!.download_url)).toString("utf8");
  const lic = meta.match(/license:\s*"(\w+)"/)?.[1] ?? "?";
  if (!/^(OFL|APACHE2|UFL)$/.test(lic)) throw new UserError(`ライセンスが ${lic} なので同梱しません`, "公式ページで条件を確認してから、ファイル指定で追加してください。");
  const ttfs = g.files.filter((f) => /\.(ttf|otf)$/i.test(f.name));
  const pick = ttfs.find((f) => f.name === want.file) ?? (want.weight ? ttfs.find((f) => f.name.endsWith(`-${want.weight}.ttf`)) : undefined)
    ?? ttfs.find((f) => /\[/.test(f.name) && !/Italic/.test(f.name)) ?? ttfs.find((f) => /-Bold\.ttf$/.test(f.name)) ?? ttfs.find((f) => /-Regular\.ttf$/.test(f.name)) ?? ttfs[0];
  const licFile = g.files.find((f) => /^(OFL|LICENSE|UFL)/i.test(f.name) && f.name.endsWith(".txt"));
  return { meta, lic: lic === "OFL" ? "OFL-1.1" : lic === "APACHE2" ? "Apache-2.0" : "UFL-1.0", font: await get(pick.download_url), fontName: pick.name, licText: licFile ? await get(licFile.download_url) : null };
}

/** download registry fonts that are not on disk (licence re-checked from google/fonts METADATA.pb).
 *  ids = only these (used by a render); all = every registry font. */
export async function fetchMissing(o: { ids?: string[]; all?: boolean } = {}) {
  const list = loadRegistry();
  let n = 0;
  const want = (f: FontEntry) => o.all || (o.ids ? o.ids.includes(f.id) : f.bundled !== false);
  for (const f of list) {
    if (!want(f) || fs.existsSync(path.join(FONT_DIR, f.file)) || !f.gf) continue;
    log(`⬇ ${f.family} …`);
    try {
      const r = await fetchGF(f.gf, { weight: f.weight }, f.gfLicenseDir);
      fs.mkdirSync(path.dirname(path.join(FONT_DIR, f.file)), { recursive: true });
      fs.writeFileSync(path.join(FONT_DIR, f.file), r.font);
      if (r.licText) fs.writeFileSync(path.join(path.dirname(path.join(FONT_DIR, f.file)), `LICENSE_${f.id}.txt`), r.licText);
      f.license = r.lic; n++;
    } catch (e: any) { log(`  ⚠️ ${f.family}: ${e?.message ?? e}（スキップ。代わりの書体で表示します）`); }
  }
  syncRegistry();
  if (n || !o.ids) log(n ? `✅ ${n} 書体をダウンロードしました（ライセンスは public/fonts/**/LICENSE_*.txt）` : "✅ 必要な書体は揃っています");
  return n;
}

const GF_CAT: Record<string, string> = { SERIF: "明朝", SANS_SERIF: "ゴシック", HANDWRITING: "手書き", DISPLAY: "デザイン・レトロ", MONOSPACE: "ゴシック" };
export async function addFont(src: string, o: Record<string, any>) {
  const list = loadRegistry();
  const idOf = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\.(ttf|otf|woff2?)$/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  let e: FontEntry;
  if (fs.existsSync(src)) {
    const file = path.basename(src), family = String(o.family ?? path.basename(src).replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[-_](Regular|Bold|Black|Medium|Light|SemiBold|ExtraBold)$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2"));
    fs.copyFileSync(src, path.join(FONT_DIR, file));
    const license = String(o.license ?? "未確認");
    e = { id: String(o.id ?? idOf(family)), family, file, category: String(o.category ?? "ゴシック"), jp: o.jp !== "false", moods: String(o.moods ?? "").split(",").filter(Boolean), license, source: String(o.source ?? "ユーザー追加"), bundled: REDISTRIBUTABLE.test(license) };
    log(`⚠️ ライセンスの確認をお願いします: ${family}`);
    log(`   - MV に使ってよいか（商用・動画での使用）、配布してよいかは書体ごとに違います。`);
    log(`   - 分かったら --license OFL-1.1 のように付けて登録し直してください（今は「${license}」）。`);
    if (!e.bundled) log(`   - ライセンスが OFL/Apache など再配布可でない限り、パックを書き出すときは同梱されません（bundled: false）。`);
  } else {
    const dir = src.toLowerCase().replace(/[^a-z0-9]/g, "");
    log(`🔎 Google Fonts: ${src} …`);
    const r = await fetchGF(dir, { weight: o.weight ? String(o.weight) : undefined });
    const family = r.meta.match(/^name:\s*"([^"]+)"/m)?.[1] ?? src;
    const file = r.fontName.replace(/\[.*\]/, "");
    fs.writeFileSync(path.join(FONT_DIR, file), r.font);
    const id = String(o.id ?? idOf(family));
    if (r.licText) fs.writeFileSync(path.join(FONT_DIR, `LICENSE_${id}.txt`), r.licText);
    const jp = /subsets:\s*"japanese"/.test(r.meta);
    e = { id, family, file, category: String(o.category ?? (jp ? GF_CAT[r.meta.match(/category:\s*"(\w+)"/)?.[1] ?? ""] ?? "ゴシック" : "欧文")), jp, moods: String(o.moods ?? "").split(",").filter(Boolean), license: r.lic, gf: dir, source: `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}` };
    log(`✅ ライセンス ${r.lic}（Google Fonts の METADATA で確認）→ 同梱・再配布OK`);
  }
  if (!CATEGORIES.includes(e.category)) throw new UserError(`分類「${e.category}」は未知です`, `--category は ${CATEGORIES.join(" / ")} のどれか`);
  const i = list.findIndex((f) => f.id === e.id);
  if (i >= 0) list[i] = e; else list.push(e);
  saveRegistry(list); syncRegistry();
  log(`📝 fonts.yaml に「${e.id}」（${e.family} / ${e.category}）を登録。使い方: 「サビは${e.id}で」または mv.config.json の lyrics.font`);
  return e;
}

async function main() {
  const { o, rest } = parseArgs(process.argv.slice(2));
  const cmd = rest[0] ?? "list";
  if (cmd === "list") { for (const c of CATEGORIES) { const fs_ = loadRegistry().filter((f) => f.category === c); log(`【${c}】 ` + fs_.map((f) => `${f.id}(${f.family}${fs.existsSync(path.join(FONT_DIR, f.file)) ? "" : " ※未DL"})`).join("  ")); } return; }
  if (cmd === "fetch") { await fetchMissing({ all: !!o.all, ids: o.ids ? String(o.ids).split(",") : undefined }); return; }
  if (cmd === "sync") { log(`✅ ${syncRegistry().length} 書体`); return; }
  if (cmd === "add") { if (!rest[1]) throw new UserError("追加する書体を指定してください", '例: npm run fonts:add -- "Zen Maru Gothic"  または  npm run fonts:add -- C:\\fonts\\MyFont.ttf --license OFL-1.1 --category 手書き'); await addFont(rest[1], o); return; }
  if (cmd === "sheet") {
    syncRegistry();
    const out = path.resolve(String(o.out ?? path.join(PACK_DIR, "docs", "images", "font_specimen.jpg")));
    npx(["remotion", "still", "FontSheet", out, "--log=error", ...(o.text ? [`--props=${JSON.stringify({ text: o.text })}`] : [])]);
    log(`✅ 見本: ${out}`); return;
  }
  throw new UserError(`不明なコマンド: ${cmd}`, "list / fetch / add / sync / sheet");
}
if (process.argv[1]?.match(/fonts\.ts$/)) main().catch(fail);
