"""Face rig data for native Remotion puppet animation (blink / mouth flap / hair sway).

usage: python faces.py --out <dir> [--manual faces_manual.json] img1.jpg img2.png ...
writes <dir>/faces.json  { "<file name>": {"eyes": [[x,y,rx,ry],..], "mouth": [x,y,rx,ry]|null, "size": [w,h],
                           "skin": "#rrggbb", "lash": "#rrggbb",
                           "patches": [{"x":..,"y":..,"w":..,"h":..,"half":"<png>","closed":"<png>"}], "source": "manual|auto"} }
All coordinates are fractions of the image size. Manual entries (from the picker, npm run faces) always win.
Blink patches are painted with the data-driven lid painter (scripts/lidpaint.py) when it is
available, otherwise Remotion draws simple lids from skin/lash colours.
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("❌ opencv-python が入っていません。\n💡 対処: pip install \"opencv-python-headless>=4.8,<5\" numpy （目パチ・口パクの顔検出に使います。無くても手動指定 npm run faces で使えます）")

CASCADE_URL = "https://raw.githubusercontent.com/nagadomi/lbpcascade_animeface/master/lbpcascade_animeface.xml"  # MIT


def cascade():
    if not hasattr(cv2, "CascadeClassifier"):
        return None
    p = Path.home() / ".mvpack" / "lbpcascade_animeface.xml"
    if not p.is_file():
        import urllib.request
        p.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(CASCADE_URL, timeout=60) as r:
                p.write_bytes(r.read())
        except Exception as e:  # offline
            print(f"⚠️ 顔検出モデルを取得できませんでした（{e}）。手動指定（npm run faces）を使ってください", file=sys.stderr)
            return None
    return cv2.CascadeClassifier(str(p))


def detect(im, cas):
    H, W = im.shape[:2]
    g = cv2.equalizeHist(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY))
    fs = cas.detectMultiScale(g, scaleFactor=1.05, minNeighbors=4, minSize=(max(24, W // 20), max(24, W // 20)))
    fs = [f for f in fs if f[2] >= W / 10]  # tiny hits are usually false positives
    if len(fs) == 0:
        return None
    x, y, w, h = (float(v) for v in max(fs, key=lambda r: r[2] * r[3]))
    rx, ry = 0.095 * w / W, 0.07 * h / H
    return {"eyes": [[(x + 0.29 * w) / W, (y + 0.42 * h) / H, rx, ry], [(x + 0.67 * w) / W, (y + 0.42 * h) / H, rx, ry]],
            "mouth": [(x + 0.5 * w) / W, (y + 0.78 * h) / H, 0.10 * w / W, 0.05 * h / H]}


def refine_mouth(im, m):
    """snap the mouth centre to the darkest (open mouth / lip line) band near the guess."""
    if not m:
        return m
    H, W = im.shape[:2]
    x, y, rx, ry = m
    x0, x1 = max(0, int((x - 1.2 * rx) * W)), min(W, int((x + 1.2 * rx) * W))
    y0, y1 = max(0, int((y - 2.5 * ry) * H)), min(H, int((y + 0.8 * ry) * H))
    roi = cv2.GaussianBlur(cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 2)
    if roi.size < 20:
        return m
    rows, cols = roi.mean(1), roi.mean(0)
    yy = y0 + int(np.argmin(rows)); xx = x0 + int(np.argmin(np.convolve(cols, np.ones(5) / 5, "same")))
    return [round(0.5 * x + 0.5 * xx / W, 4), round(yy / H, 4), rx, ry]


def hexc(bgr):
    b, g, r = (int(max(0, min(255, v))) for v in bgr)
    return f"#{r:02x}{g:02x}{b:02x}"


def colours(im, face):
    H, W = im.shape[:2]
    skins, lashes = [], []
    for ex, ey, rx, ry in face["eyes"]:
        cx, cy = int(ex * W), int(ey * H)
        r0 = im[max(0, int(cy + 1.6 * ry * H)):int(cy + 2.4 * ry * H), max(0, int(cx - rx * W)):int(cx + rx * W)]
        if r0.size:
            skins.append(np.median(r0.reshape(-1, 3), 0))
        r1 = im[max(0, int(cy - ry * H)):int(cy + ry * H), max(0, int(cx - rx * W)):int(cx + rx * W)]
        if r1.size:
            lashes.append(np.percentile(r1.reshape(-1, 3), 3, axis=0))
    skin = np.mean(skins, 0) if skins else np.array([200, 210, 235])
    lash = np.mean(lashes, 0) if lashes else np.array([30, 25, 30])
    return hexc(skin), hexc(lash)


def patches(name, im, face, outdir):
    try:
        from lidpaint import eye_patches
    except Exception:
        return []
    H, W = im.shape[:2]
    out = []
    try:
        ps = eye_patches(name, face, im)
    except Exception as e:
        print(f"⚠️ {name}: まぶたパッチ作成に失敗（{e}）→ 簡易まぶたで描画", file=sys.stderr)
        return []
    stem = Path(name).stem
    for i, (x0, y0, half, closed, ah, ac) in enumerate(ps):
        h, w = half.shape[:2]
        files = {}
        for kind, img, a in (("half", half, ah), ("closed", closed, ac)):
            rgba = np.dstack([img, (np.clip(a[..., 0], 0, 1) * 255).astype(np.uint8)])
            fn = f"{stem}_eye{i}_{kind}.png"
            cv2.imwrite(str(outdir / fn), rgba)
            files[kind] = fn
        out.append({"x": x0 / W, "y": y0 / H, "w": w / W, "h": h / H, **files})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--manual")
    a = ap.parse_args()
    outdir = Path(a.out); outdir.mkdir(parents=True, exist_ok=True)
    manual = json.load(open(a.manual, encoding="utf-8")) if a.manual and os.path.isfile(a.manual) else {}
    cas = None
    res = {}
    for p in a.images:
        name = Path(p).name
        im = cv2.imread(p, cv2.IMREAD_COLOR)
        if im is None:
            continue
        H, W = im.shape[:2]
        face, src = manual.get(name), "manual"
        if face is None:
            cas = cas or cascade()
            face, src = (detect(im, cas) if cas is not None else None), "auto"
            if face:
                face["mouth"] = refine_mouth(im, face.get("mouth"))
        if face == "none" or not face or not face.get("eyes"):
            res[name] = {"size": [W, H], "eyes": [], "mouth": None, "source": src}
            continue
        skin, lash = colours(im, face)
        res[name] = {**face, "size": [W, H], "skin": skin, "lash": lash, "source": src, "patches": patches(name, im, face, outdir)}
        print(f"  🙂 {name}: 目{len(face['eyes'])} 口{'あり' if face.get('mouth') else 'なし'}（{'手動' if src == 'manual' else '自動'}）")
    json.dump(res, open(outdir / "faces.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✅ faces.json → {outdir / 'faces.json'}（顔あり {sum(1 for v in res.values() if v.get('eyes'))}/{len(res)}）")


if __name__ == "__main__":
    main()
