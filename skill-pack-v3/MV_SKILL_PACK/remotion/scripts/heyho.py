"""分離したボーカル（例: demucs の vocals.wav）から、短い掛け声（Hey! / Ho! など）の位置を探します。

使い方:
  python scripts/heyho.py vocals.wav --from 15 --to 26 --count 4 [--out hits.json] [--vocal24 vocal24.json]
  python scripts/heyho.py vocals.wav --near 17,18.3,23.9,25.2      （だいたいの秒が分かっている時。その近くの立ち上がりに合わせます）

  掛け声 = ボーカルが一瞬落ちた直後の強い立ち上がり（歌の中の掛け声は無音に挟まれないことが多いため）。区間は狭いほど正確です。時刻順に Hey!, Ho!, Hey!, Ho! と交互に名前を付けます
  （違う時は hits.json の text / kind を書き換え）。hits.json は npm run recipe:dance -- --hits hits.json で使えます。
  --vocal24 は 1コマ(1/24秒)ごとのボーカルの大きさ（stage.vocal、口パクの強さに使えます）。
  必要: pip install librosa（requirements_optional.txt）。ボーカル分離: pip install demucs → demucs --two-stems=vocals 曲.mp3
"""
import argparse, json
import numpy as np


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("wav"); ap.add_argument("--from", dest="a", type=float, default=0); ap.add_argument("--to", dest="b", type=float, default=1e9)
    ap.add_argument("--count", type=int, default=4, help="区間内で探す数"); ap.add_argument("--near", type=lambda s: [float(x) for x in s.split(",")], help="だいたいの秒をカンマ区切りで（その近くに合わせる）")
    ap.add_argument("--dip", type=float, default=0.3); ap.add_argument("--rise", type=float, default=0.5); ap.add_argument("--sep", type=float, default=0.8)
    ap.add_argument("--out", default="hits.json"); ap.add_argument("--vocal24")
    o = ap.parse_args()
    import librosa
    y, sr = librosa.load(o.wav, sr=22050); hop = 110
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]; rms = rms / (np.percentile(rms, 99.5) or 1)
    tt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    # 歌の途中の掛け声は無音に挟まれないことが多いので「ボーカルが一瞬落ちて（谷）→ すぐ強く立ち上がる」所を候補にします。
    sm = np.convolve(rms, np.ones(5) / 5, mode="same"); fr = 1 / (tt[1] - tt[0]); W = int(0.25 * fr)
    cand = []
    for i in range(W, len(sm) - W):
        if not (o.a <= tt[i] <= o.b) or sm[i] > o.dip or sm[i] != sm[i - W:i + W].min(): continue
        j = i + int(np.argmax(sm[i:i + W] > o.rise)) if (sm[i:i + W] > o.rise).any() else None
        if j is None: continue
        peak = sm[j:j + W].max(); cand.append((float(peak - sm[i]), float(tt[j])))
    if o.near: pick = [min(cand, key=lambda c: abs(c[1] - n) - c[0] * 0.2)[1] for n in o.near] if cand else []
    else:
        pick = []
        for sc, t in sorted(cand, reverse=True):
            if all(abs(t - p) >= o.sep for p in pick): pick.append(t)
            if len(pick) >= o.count: break
    hits = [{"t": round(t, 3), "text": "Ho!" if i % 2 else "Hey!", "kind": "ho" if i % 2 else "hey"} for i, t in enumerate(sorted(pick))]
    json.dump({"hits": hits}, open(o.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"掛け声 {len(hits)} 個 → {o.out}"); [print(f"  {h['t']:.3f}s {h['text']}") for h in hits]
    if o.vocal24:
        n = int(len(y) / sr * 24); v = [round(float(min(1, rms[(tt >= i / 24) & (tt < (i + 1) / 24)].mean() if ((tt >= i / 24) & (tt < (i + 1) / 24)).any() else 0)), 2) for i in range(n)]
        json.dump({"fps": 24, "v": v}, open(o.vocal24, "w")); print("ボーカルの大きさ →", o.vocal24)


if __name__ == "__main__": main()
