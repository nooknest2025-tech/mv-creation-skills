"""歌詞の文字がフォントに全部入っているか調べます（入っていない字は□や別の書体＝「字が化ける・ブロックになる」原因）。

使い方:
  python scripts/font_cover.py --project <名前> フォント.ttf [フォント2.ttf ...]
  python scripts/font_cover.py --text "歌詞の文字" フォント.ttf

  フォントごとに「足りない字」と、漢字（CJK統合漢字）が何字入っているかを出します。
  足りない字がある書体は、その行には使わないでください（hwLyrics の font を別の書体に）。
  必要: pip install fonttools
"""
import argparse, json, re, sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("fonts", nargs="+"); ap.add_argument("--project"); ap.add_argument("--text", default="")
    o = ap.parse_args()
    from fontTools.ttLib import TTFont
    text = o.text
    if o.project:
        st = Path(__file__).resolve().parents[2] / "projects" / o.project / "out/editor/editor-state.json"
        text += "".join(l["text"] for l in json.loads(st.read_text(encoding="utf-8"))["data"]["lyrics"])
    chars = sorted(set(c for c in re.sub(r"[\s　（）()]", "", text)))
    bad = 0
    for f in o.fonts:
        cmap = TTFont(f, fontNumber=0).getBestCmap(); kanji = sum(1 for c in cmap if 0x4E00 <= c <= 0x9FFF)
        miss = [c for c in chars if ord(c) not in cmap]; bad += bool(miss)
        print(f"{Path(f).name}: 漢字 {kanji}字 / 歌詞の字 {len(chars)}字中 足りない {len(miss)}字 {''.join(miss)}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__": main()
