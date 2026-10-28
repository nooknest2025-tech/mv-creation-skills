// Make every editor font available: Google Fonts (OFL/Apache) via fetchMissing, plus author-permitted
// extra fonts (editor/extra-fonts.json) downloaded from the author's official site. Never alters font files.
// Never throws: on network failure it prints a Japanese message and the editor uses what is present.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { REMOTION_DIR } from "./common";
import { fetchMissing } from "./fonts";

export const FONT_DIR = path.join(REMOTION_DIR, "public", "fonts");
export const EDITOR_FONT_IDS = ["noto_serif", "shippori_mincho", "zen_old_mincho", "noto_sans", "zen_kaku", "mplus1p", "dela", "zen_maru", "mplus_rounded", "kosugi_maru", "rocknroll", "klee", "yomogi", "zen_kurenaido", "yusei", "yuji_syuku", "yuji_boku", "zen_antique", "hachi_maru", "mochiy", "potta", "reggae", "dotgothic", "train_one", "rampart", "kaisei_decol", "new_tegomin"];
export const extraFonts = (): any[] => JSON.parse(fs.readFileSync(path.join(REMOTION_DIR, "editor", "extra-fonts.json"), "utf8"));

/** Minimal ZIP reader (stored/deflate) so no extra dependency or OS unzip tool is needed (Windows-safe). */
export function unzipEntries(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip ではありません");
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16); const out = new Map<string, Buffer>();
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip の目次が壊れています");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nl).toString("latin1");
    const data0 = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), raw = buf.subarray(data0, data0 + csize);
    if (method === 0) out.set(name, Buffer.from(raw)); else if (method === 8) out.set(name, zlib.inflateRawSync(raw));
    p += 46 + nl + el + cl;
  }
  return out;
}

async function fetchExtra(f: any): Promise<boolean> {
  const dest = path.join(FONT_DIR, f.file);
  if (fs.existsSync(dest)) return false;
  const r = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 mvpack" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}（リンク切れの可能性: ${f.source}）`);
  const entries = unzipEntries(Buffer.from(await r.arrayBuffer()));
  const ttf = entries.get(f.zipEntry) ?? [...entries].find(([k]) => /\.(ttf|otf)$/i.test(k))?.[1];
  if (!ttf) throw new Error("zip の中に TTF がありません");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, ttf); // byte-for-byte, unmodified
  for (const [k, v] of entries) if (/readme.*\.txt$/i.test(k)) fs.writeFileSync(path.join(path.dirname(dest), `README_${f.id}.txt`), v);
  return true;
}

export async function ensureEditorFonts(o: { quiet?: boolean } = {}): Promise<{ ok: number; skipped: string[] }> {
  const skipped: string[] = [];
  if (process.env.MVPACK_SKIP_FONT_DOWNLOAD) { console.log("ℹ️ MVPACK_SKIP_FONT_DOWNLOAD が設定されているため書体のダウンロードを省略"); return { ok: 0, skipped }; }
  try { await fetchMissing({ ids: EDITOR_FONT_IDS }); } catch (e: any) { skipped.push(`Google Fonts: ${e?.message ?? e}`); }
  for (const f of extraFonts()) {
    try { if (await fetchExtra(f)) console.log(`⬇ ${f.label}（作者: ${f.author}、利用条件: ${f.permissionSource}）`); }
    catch (e: any) { skipped.push(`${f.label}: ${e?.message ?? e}`); }
  }
  const missing = [...EDITOR_FONT_IDS.map((id) => id), ...extraFonts().map((f) => f.id)];
  const ok = missing.length - skipped.length;
  if (skipped.length) console.log(`⚠️ 一部の書体を取得できませんでした（ネット接続を確認し、後で npm run fonts:editor で再試行できます。手元にある書体だけで編集UIは使えます）:\n  - ${skipped.join("\n  - ")}`);
  else if (!o.quiet) console.log("✅ 編集UIの書体は揃っています");
  return { ok, skipped };
}

if (process.argv[1]?.match(/editor_fonts\.ts$/)) ensureEditorFonts().catch((e) => console.log(`⚠️ 書体の準備をスキップ: ${e?.message ?? e}`)).finally(() => process.exit(0));
