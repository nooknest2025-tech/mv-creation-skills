import { describe, expect, it } from "vitest";
import zlib from "zlib";
import YAML from "yaml";
import fs from "fs";
import path from "path";
import { EDITOR_FONT_IDS, extraFonts, unzipEntries } from "../scripts/editor_fonts";

function zip(files: [string, Buffer, boolean][]): Buffer {
  const locals: Buffer[] = [], cents: Buffer[] = []; let off = 0;
  for (const [name, data, deflate] of files) {
    const body = deflate ? zlib.deflateRawSync(data) : data, n = Buffer.from(name, "latin1");
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(deflate ? 8 : 0, 8); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    locals.push(h, n, body); cents.push(c, n); off += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(cents), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}

describe("editor fonts", () => {
  it("unzips stored and deflated entries byte-for-byte", () => {
    const a = Buffer.from("FONTDATA".repeat(100)), b = Buffer.from("readme");
    const m = unzipEntries(zip([["onryou.TTF", a, true], ["readme.txt", b, false]]));
    expect(m.get("onryou.TTF")!.equals(a)).toBe(true); expect(m.get("readme.txt")!.equals(b)).toBe(true);
  });
  it("every editor font id is a free (OFL/Apache) registry font with a Google Fonts source", () => {
    const reg = YAML.parse(fs.readFileSync(path.join(__dirname, "..", "..", "fonts.yaml"), "utf8")).fonts;
    expect(EDITOR_FONT_IDS).toEqual(reg.filter((f:any)=>f.jp && /^(OFL-1.1|Apache-2.0)$/.test(f.license)).map((f:any)=>f.id));
    for (const id of EDITOR_FONT_IDS) { const f = reg.find((x: any) => x.id === id); expect(f, id).toBeTruthy(); expect(f.license).toMatch(/^(OFL-1.1|Apache-2.0)$/); expect(f.jp).toBe(true); }
  });
  it("extra fonts are credited, come from the author's site and are not committed", () => {
    const ignore = fs.readFileSync(path.join(__dirname, "..", "..", "..", "..", ".gitignore"), "utf8");
    expect(ignore).toContain("remotion/public/fonts/extra/");
    for (const f of extraFonts()) { expect(f.author).toContain("暗黒工房"); expect(f.permissionSource).toBe("https://www.ankokukoubou.com/font/ankokuzonji.htm"); expect(f.url).toMatch(/^https:\/\/www\.ankokukoubou\.com\//); expect(f.file.startsWith("extra/")).toBe(true); }
  });
});
