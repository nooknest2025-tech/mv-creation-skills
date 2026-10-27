// Finishing / export: audio-safe mux + faststart, Drive-size variant, DaVinci FCPXML, QA checks.
import { ff, probe, durationOf, fs, path, md5File, UserError } from "./common";

const COPYABLE = new Set(["aac", "mp3", "alac"]);

/** audio stream md5 (packets, codec copy) - equal when the source audio was not re-encoded. */
export function audioStreamMd5(file: string): string {
  const r = ff(["-i", file, "-map", "0:a:0", "-c", "copy", "-f", "md5", "-"]);
  return String(r.stdout).trim().replace(/^MD5=/, "");
}

/** mux silent video + ORIGINAL audio (copied bit-exact when possible), H.264 Main yuv420p, +faststart. */
export function finalMux(video: string, audio: string, out: string, o: { start?: number; dur?: number; reencodeVideo?: boolean } = {}) {
  const codec = probe(audio).streams?.find((s: any) => s.codec_type === "audio")?.codec_name;
  const copy = COPYABLE.has(codec) && !o.start && !o.dur;
  const args = ["-i", video];
  if (o.start) args.push("-ss", String(o.start));
  args.push("-i", audio);
  if (o.dur) args.push("-t", String(o.dur));
  args.push("-map", "0:v:0", "-map", "1:a:0");
  args.push(...(o.reencodeVideo ? ["-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium"] : ["-c:v", "copy"]));
  args.push(...(copy ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "320k"]), "-shortest", "-movflags", "+faststart", out);
  ff(args);
  return { audioCopied: copy, codec };
}

/** Drive/LINE-friendly variant under `maxMB` (default 95MB): bitrate from duration, H.264 Main, AAC 192k. */
export function driveVariant(src: string, out: string, maxMB = 95) {
  const dur = durationOf(src);
  const total = (maxMB * 8 * 1024 * 1024) / Math.max(1, dur); // bits/s
  const v = Math.max(400_000, Math.min(12_000_000, Math.floor(total - 192_000 - 50_000)));
  ff(["-i", src, "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-b:v", String(v), "-maxrate", String(Math.floor(v * 1.3)), "-bufsize", String(v * 2), "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
  const mb = fs.statSync(out).size / 1048576;
  if (mb > maxMB + 4) throw new UserError(`Drive用ファイルが ${mb.toFixed(1)}MB で上限を超えました`, "--drive-mb 80 のように小さめに指定して再実行してください。");
  return mb;
}

/** FCPXML 1.9 for DaVinci Resolve: V1 = MV (or picture), V2 = transparent lyric overlay, A1 = original audio. */
export function writeFcpxml(out: string, o: { title: string; fps: number; width: number; height: number; duration: number; video: string; overlay?: string; audio: string }) {
  const fr = `${100}/${o.fps * 100}s`;
  const t = (s: number) => `${Math.round(s * o.fps) * 100}/${o.fps * 100}s`;
  const url = (p: string) => "file://" + (process.platform === "win32" ? "/" : "") + path.resolve(p).replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/").replace(/%3A/, ":");
  const D = t(o.duration);
  const asset = (id: string, p: string, video: boolean, audio: boolean) => `<asset id="${id}" name="${path.basename(p)}" start="0s" duration="${D}" hasVideo="${video ? 1 : 0}" hasAudio="${audio ? 1 : 0}" format="r1"><media-rep kind="original-media" src="${url(p)}"/></asset>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
 <resources>
  <format id="r1" name="FFVideoFormat${o.height}p${o.fps}" frameDuration="${fr}" width="${o.width}" height="${o.height}"/>
  ${asset("a1", o.video, true, false)}
  ${o.overlay ? asset("a2", o.overlay, true, false) : ""}
  ${asset("a3", o.audio, false, true)}
 </resources>
 <library><event name="${o.title}"><project name="${o.title}"><sequence format="r1" duration="${D}" tcStart="0s" tcFormat="NDF">
  <spine>
   <asset-clip ref="a1" name="MV" offset="0s" start="0s" duration="${D}">
    ${o.overlay ? `<asset-clip ref="a2" lane="1" name="lyrics_overlay" offset="0s" start="0s" duration="${D}"/>` : ""}
    <asset-clip ref="a3" lane="-1" name="audio" offset="0s" start="0s" duration="${D}"/>
   </asset-clip>
  </spine>
 </sequence></project></event></library>
</fcpxml>
`;
  fs.writeFileSync(out, xml);
}

export interface QAItem { ok: boolean; item: string; detail: string }
/** automatic finishing checks (lessons from real finishing jobs). */
export function qaChecks(o: { out: string; audio: string; expectDur: number; audioCopied: boolean; partial?: boolean; lines: { tOn: number; tEnd: number }[]; startAt: number; endAt: number; overlay?: string; drive?: string }): QAItem[] {
  const R: QAItem[] = [];
  const p = probe(o.out), v = p.streams.find((s: any) => s.codec_type === "video"), a = p.streams.find((s: any) => s.codec_type === "audio");
  R.push({ ok: v?.codec_name === "h264" && v?.pix_fmt === "yuv420p", item: "互換MP4（H.264 / yuv420p）", detail: `${v?.codec_name} ${v?.profile} ${v?.pix_fmt} ${v?.width}x${v?.height}` });
  const head = fs.readFileSync(o.out).subarray(0, 64 * 1024).toString("latin1");
  R.push({ ok: head.indexOf("moov") >= 0 && head.indexOf("moov") < head.indexOf("mdat") || head.indexOf("mdat") < 0, item: "faststart（moov が先頭）", detail: head.indexOf("moov") >= 0 ? "OK" : "moov が後ろ" });
  const dur = Number(p.format.duration);
  R.push({ ok: Math.abs(dur - o.expectDur) < 0.15, item: "尺が曲と一致", detail: `${dur.toFixed(2)}s / 期待 ${o.expectDur.toFixed(2)}s` });
  if (o.audioCopied) {
    const m1 = audioStreamMd5(o.audio), m2 = audioStreamMd5(o.out);
    R.push({ ok: m1 === m2, item: "音声は無加工（ストリームmd5一致）", detail: `${m1.slice(0, 10)}… vs ${m2.slice(0, 10)}…` });
  } else R.push({ ok: !!a, item: "音声（部分書き出し or WAV等のため AAC 320k。元ファイルは無変更）", detail: `元ファイルmd5 ${md5File(o.audio).slice(0, 10)}…（DaVinci用には元WAVをそのまま使用）` });
  const tail = o.lines.filter((L) => L.tEnd > o.endAt - 1.0 && L.tOn < o.endAt);
  R.push({ ok: o.partial || tail.length === 0, item: "エンディング最後の1秒に歌詞が残っていない（きれいに終わる）", detail: o.partial ? "部分書き出しのため対象外" : tail.length ? `${tail.length}行が掛かっています` : "OK" });
  if (o.drive) { const mb = fs.statSync(o.drive).size / 1048576; R.push({ ok: mb < 100, item: "Drive用 <100MB", detail: `${mb.toFixed(1)}MB` }); }
  if (o.overlay) { const q = probe(o.overlay).streams[0]; R.push({ ok: /yuva|argb|rgba|4444/.test(`${q.pix_fmt}${q.profile}`), item: "透過歌詞オーバーレイ（アルファ付き）", detail: `${q.codec_name} ${q.profile ?? ""} ${q.pix_fmt}` }); }
  return R;
}
export function qaMarkdown(title: string, items: QAItem[], manual: string[]) {
  return `# QA チェック — ${title}\n\n## 自動チェック\n${items.map((i) => `- [${i.ok ? "x" : " "}] ${i.ok ? "✅" : "⚠️"} ${i.item} — ${i.detail}`).join("\n")}\n\n## 目視チェック（人が見る）\n${manual.map((m) => `- [ ] ${m}`).join("\n")}\n`;
}
export const MANUAL_QA = [
  "最初の3秒で目を引くか（フック）", "歌詞が読める速さ・大きさか（スマホでも）", "歌詞が画面内UI（ゲーム画面・スマホ画面など作中のUI）や顔を隠していないか",
  "サビで一段階盛り上がっているか（カット・色・文字）", "エンディングがきれいに終わる（歌詞・ノイズが残らない）", "音ズレしていない（口・拍と合っている）", "サムネ候補（thumbs/）に使える1枚があるか",
];
