"""Visual features for fit-based direction (free, local: Pillow + numpy; ffmpeg for clips).
Per image/clip: luminance + busyness (edge density) of 3 horizontal text bands (top/mid/bottom),
dominant colours, colourfulness, art-style guess (illustration / photo / watercolor), clip motion amount.
Usage: python visfeat.py --out visfeat.json FILE [FILE ...]
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter

BANDS = {"top": 0.16, "mid": 0.5, "bottom": 0.84}

def lum(rgb):  # WCAG relative luminance, rgb 0..255 array (...,3)
    c = rgb / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]

def feat_img(im: Image.Image):
    im = im.convert("RGB"); im.thumbnail((320, 320))
    a = np.asarray(im).astype(np.float32); h, w, _ = a.shape
    g = np.asarray(im.convert("L").filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    L = lum(a)
    bands = {}
    for k, v in BANDS.items():
        y0, y1 = int(max(0, (v - 0.11) * h)), int(min(h, (v + 0.11) * h))
        bands[k] = {"lum": round(float(L[y0:y1].mean()), 3), "busy": round(float((g[y0:y1] > 0.12).mean()), 3),
                    "rgb": [int(x) for x in a[y0:y1].reshape(-1, 3).mean(0)]}
    q = (a // 32).astype(int).reshape(-1, 3); keys = q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]
    vals, cnt = np.unique(keys, return_counts=True); top = vals[np.argsort(-cnt)[:5]]
    dom = ["#%02x%02x%02x" % ((k // 64) * 32 + 16, ((k // 8) % 8) * 32 + 16, (k % 8) * 32 + 16) for k in top]
    rg, yb = a[..., 0] - a[..., 1], 0.5 * (a[..., 0] + a[..., 1]) - a[..., 2]
    colorful = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2)) / 100
    flat = float(cnt[np.argsort(-cnt)[:12]].sum() / cnt.sum())  # few colours dominate -> flat illustration
    edges = float((g > 0.12).mean())
    hsv = np.asarray(im.convert("HSV")).astype(np.float32); sat = float(hsv[..., 1].mean() / 255)
    art = "illustration" if flat > 0.62 and edges > 0.04 else "watercolor" if sat < 0.32 and edges < 0.05 else "photo"
    return {"bands": bands, "dominant": dom, "colorful": round(colorful, 3), "brightness": round(float(L.mean()), 3),
            "contrast": round(float(L.std()), 3), "art": art, "flat": round(flat, 3), "edges": round(edges, 3)}

def frames(path, n=4):
    tmp = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "fps=2,scale=160:-1", "-frames:v", str(n * 2), os.path.join(tmp, "f%02d.png")], check=False)
    return [Image.open(os.path.join(tmp, f)) for f in sorted(os.listdir(tmp))]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("files", nargs="+")
    o = ap.parse_args(); res = {}
    for f in o.files:
        try:
            if f.lower().endswith((".mp4", ".mov", ".webm", ".mkv")):
                fr = frames(f)
                if not fr: continue
                d = feat_img(fr[len(fr) // 2])
                arr = [np.asarray(x.convert("L")).astype(np.float32) for x in fr]
                d["motion"] = round(float(np.mean([np.abs(arr[i + 1] - arr[i]).mean() / 255 for i in range(len(arr) - 1)])) if len(arr) > 1 else 0.0, 4)
            else:
                d = feat_img(Image.open(f)); d["motion"] = 0.0
            res[f] = d
        except Exception as e:
            print(f"visfeat: skip {f}: {e}", file=sys.stderr)
    json.dump(res, open(o.out, "w"), ensure_ascii=False, indent=1)
    print(f"visfeat: {len(res)} files")

if __name__ == "__main__":
    main()
