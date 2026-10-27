"""Free local lyrics: faster-whisper transcription (audio only) or forced alignment of plain lyrics text.

usage:
  python transcribe.py song.mp3 --out lyrics.json                 # (a) audio only -> auto lyrics
  python transcribe.py song.mp3 --text lyrics.txt --out lyrics.json  # (b) audio + plain text -> line/word timings
options: --model small|medium|large-v3 (default small) --lang ja --vocals vocals.wav (use an isolated vocal stem if you have one)
Output = the lyric-sync JSON shape (schemaVersion 1.0 subset), so the rest of the pipeline treats it like hand-made data.
"""
from __future__ import annotations
import argparse, difflib, json, re, sys, unicodedata


def norm(ch: str) -> str:
    ch = unicodedata.normalize("NFKC", ch)
    if "\u30a1" <= ch <= "\u30f6":  # katakana -> hiragana
        ch = chr(ord(ch) - 0x60)
    return ch.lower()


SKIP = re.compile(r"[\s、。,.!?！？「」『』（）()…・ー〜~\-]")


def load_audio(path: str):
    """decode with ffmpeg ourselves (avoids PyAV version mismatches); falls back to Remotion's bundled ffmpeg."""
    import shutil, subprocess
    import numpy as np
    exe = shutil.which("ffmpeg")
    cmd = [exe] if exe else ["npx", "remotion", "ffmpeg"]
    raw = subprocess.run(cmd + ["-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True, shell=(sys.platform == "win32" and not exe)).stdout
    return np.frombuffer(raw, np.float32).copy()


def transcribe(audio: str, model: str, lang: str, prompt: str | None = None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("❌ faster-whisper が入っていません。\n💡 対処: pip install faster-whisper （無料・ローカル実行。初回はモデルをダウンロードします）")
    m = WhisperModel(model, device="auto", compute_type="int8")
    segs, info = m.transcribe(load_audio(audio), language=lang, word_timestamps=True, vad_filter=False, beam_size=5,
                              initial_prompt=prompt, condition_on_previous_text=False)  # VAD drops sung vocals; lyric prompt keeps the same script (kanji/kana)
    out = []
    for s in segs:
        words = [{"text": w.word.strip(), "startSeconds": round(w.start, 3), "endSeconds": round(w.end, 3)} for w in (s.words or []) if w.word.strip()]
        out.append({"text": s.text.strip(), "start": round(s.start, 3), "end": round(s.end, 3), "words": words})
    return out, info.duration


def char_times(segs):
    """flatten whisper words -> list of (normalized char, t0, t1)."""
    out = []
    for s in segs:
        for w in s["words"]:
            cs = [c for c in w["text"] if not SKIP.match(c)]
            d = max(0.02, w["endSeconds"] - w["startSeconds"])
            for k, c in enumerate(cs):
                out.append((norm(c), w["startSeconds"] + d * k / len(cs), w["startSeconds"] + d * (k + 1) / len(cs)))
    return out


def align(text_lines, segs):
    asr = char_times(segs)
    lyr = []  # (line index, char) for non-skip chars
    for li, line in enumerate(text_lines):
        for c in line:
            if not SKIP.match(c):
                lyr.append((li, c))
    a = "".join(c for c, _, _ in asr)
    b = "".join(norm(c) for _, c in lyr)
    times = [None] * len(lyr)
    for blk in difflib.SequenceMatcher(None, b, a, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (asr[blk.b + k][1], asr[blk.b + k][2])
    # interpolate gaps between known neighbours
    known = [i for i, t in enumerate(times) if t]
    if not known:
        print("⚠️ 歌詞と音声の一致が取れなかったため、行を均等に配置しました（npm run timing で直せます）", file=sys.stderr)
        t0 = segs[0]["start"] if segs else 1.0
        t1 = segs[-1]["end"] if segs else t0 + 3.0 * len(lyr) / max(1, len(text_lines))
        step = (t1 - t0) / max(1, len(lyr))
        times = [(t0 + step * i, t0 + step * (i + 1)) for i in range(len(lyr))]
        known = list(range(len(lyr)))
    if False:
        raise SystemExit("❌ 歌詞と音声がほとんど一致しませんでした。\n💡 対処: 歌詞テキストが曲と同じか確認するか、ボーカルだけの音源を --vocals で渡してください。")
    for i in range(len(times)):
        if times[i]:
            continue
        p = max([k for k in known if k < i], default=None)
        n = min([k for k in known if k > i], default=None)
        if p is None:
            t = times[n][0] - 0.12 * (n - i); times[i] = (t, t + 0.1)
        elif n is None:
            t = times[p][1] + 0.12 * (i - p); times[i] = (t, t + 0.1)
        else:
            f = (i - p) / (n - p); t = times[p][1] + (times[n][0] - times[p][1]) * f; times[i] = (t, t + max(0.05, (times[n][0] - times[p][1]) / (n - p)))
    lines = []
    for li, line in enumerate(text_lines):
        ks = [k for k, (l, _) in enumerate(lyr) if l == li]
        if not ks:
            continue
        # words = space separated tokens (or the whole line)
        words, k = [], 0
        for tok in line.split():
            n = len([c for c in tok if not SKIP.match(c)])
            if n == 0:
                continue
            seg = ks[k:k + n]; k += n
            if seg:
                words.append({"text": tok, "startSeconds": round(times[seg[0]][0], 3), "endSeconds": round(times[seg[-1]][1], 3)})
        lines.append({"text": line, "start": round(times[ks[0]][0], 3), "end": round(times[ks[-1]][1], 3), "words": words})
    for i in range(1, len(lines)):  # monotone
        lines[i]["start"] = max(lines[i]["start"], lines[i - 1]["start"] + 0.05)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio"); ap.add_argument("--text"); ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="small"); ap.add_argument("--lang", default="ja"); ap.add_argument("--vocals")
    a = ap.parse_args()
    raw = open(a.text, encoding="utf-8-sig").read().splitlines() if a.text else []
    segs, dur = transcribe(a.vocals or a.audio, a.model, a.lang, " ".join(l.strip() for l in raw if l.strip())[:400] or None)
    if a.text:
        text_lines = [l.strip() for l in raw if l.strip() and not re.match(r"^[【\[].*[】\]]$", l.strip())]
        lyrics, source = align(text_lines, segs), "aligned"
    else:
        lyrics, source = segs, "whisper"
    data = {"schemaVersion": "1.0", "projectName": a.audio.rsplit("/", 1)[-1].rsplit(".", 1)[0], "audio": {"name": a.audio, "duration": dur},
            "fps": 30, "lyrics": lyrics, "sections": [], "analysis": {}, "source": source, "_note": "自動生成。間違いは timing エディタ（npm run timing）で直せます"}
    json.dump(data, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    hit = sum(1 for _ in segs)
    print(f"✅ {source}: {len(lyrics)}行 → {a.out}（認識セグメント {hit}）")


if __name__ == "__main__":
    main()
