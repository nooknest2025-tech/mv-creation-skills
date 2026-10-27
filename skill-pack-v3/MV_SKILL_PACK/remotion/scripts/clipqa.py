#!/usr/bin/env python3
"""Generated-clip QA: flicker, morphing and face drift -> flag clips for regeneration.
usage: python scripts/clipqa.py clip.mp4 [--ref face.png] [--json]
 - flicker : spikes of global luminance change between consecutive frames (vs the clip's median)
 - morph   : edge-structure change that is large while the overall motion is small (things melting in place)
 - face    : face crop similarity (HSV histogram + downscaled grey correlation) vs the first face / --ref image
Needs ffmpeg + numpy + PIL. Face check uses OpenCV if installed, else it is skipped (reported, not faked)."""
import json, subprocess, sys, os, tempfile
import numpy as np
from PIL import Image, ImageFilter

TH = {"flicker": 4.0, "morph": 0.35, "face": 0.55}

def frames(path, fps=8, w=256):
    d = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={w}:-2", os.path.join(d, "%04d.png")], check=True)
    fs = sorted(os.listdir(d))
    return [Image.open(os.path.join(d, f)).convert("RGB") for f in fs]

def lum(im): return np.asarray(im.convert("L"), dtype=np.float32)
def edges(im): return (np.asarray(im.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float32) > 40).astype(np.float32)

def flicker_score(ims):
    m = np.array([lum(i).mean() for i in ims])
    if len(m) < 3: return 0.0, []
    d = np.abs(np.diff(m)); base = float(np.percentile(d, 25)) + 0.5
    # flicker = a frame whose brightness jumps away from BOTH neighbours (and comes back)
    dev = np.abs(m[1:-1] - (m[:-2] + m[2:]) / 2)
    bad = [i + 1 for i, v in enumerate(dev) if v > max(6.0, TH["flicker"] * base)]
    return float(d.max() / base), bad

def morph_score(ims):
    out = []
    for a, b in zip(ims, ims[1:]):
        motion = np.abs(lum(a) - lum(b)).mean() / 255
        ea, eb = edges(a), edges(b); u = np.maximum(ea, eb).sum() + 1
        change = 1 - (np.minimum(ea, eb).sum() / u)
        out.append(change * (1 - min(1, motion * 8)))
    return (float(max(out)) if out else 0.0), [i for i, v in enumerate(out) if v > TH["morph"]]

def face_sig(crop):
    c = crop.resize((48, 48)).convert("HSV"); h = np.histogram(np.asarray(c)[..., 0], 16, (0, 255))[0].astype(np.float32); h /= h.sum() + 1e-6
    g = np.asarray(crop.resize((24, 24)).convert("L"), dtype=np.float32).ravel(); g = (g - g.mean()) / (g.std() + 1e-6)
    return h, g

def face_sim(a, b):
    (ha, ga), (hb, gb) = a, b
    return float(0.5 * np.minimum(ha, hb).sum() + 0.5 * max(0, (ga * gb).mean()))

def face_drift(ims, ref=None):
    try: import cv2
    except Exception: return None, [], "OpenCV が無いため顔チェックは未実行"
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    def crop(im):
        g = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY); f = det.detectMultiScale(g, 1.1, 4, minSize=(24, 24))
        if len(f) == 0: return None
        x, y, w, h = max(f, key=lambda r: r[2] * r[3]); return im.crop((x, y, x + w, y + h))
    base = face_sig(crop(ref) or ref) if ref is not None else None
    sims, bad = [], []
    for i, im in enumerate(ims):
        c = crop(im)
        if c is None: continue
        s = face_sig(c)
        if base is None: base = s; continue
        v = face_sim(base, s); sims.append(v)
        if v < TH["face"]: bad.append(i)
    return (float(min(sims)) if sims else None), bad, None

def qa(path, ref=None, fps=8):
    ims = frames(path, fps)
    f, fb = flicker_score(ims); m, mb = morph_score(ims)
    r = Image.open(ref).convert("RGB") if ref else None
    fs, fdb, note = face_drift(ims, r)
    flags = []
    if fb: flags.append({"type": "flicker", "at_sec": [round(i / fps, 2) for i in fb], "ja": "ちらつき（明るさの点滅）"})
    if mb: flags.append({"type": "morph", "at_sec": [round(i / fps, 2) for i in mb], "ja": "形が溶ける・崩れる（モーフィング）"})
    if fdb and len(fdb) >= 2: flags.append({"type": "face_drift", "at_sec": [round(i / fps, 2) for i in fdb], "ja": "顔が別人に変わっていく"})
    return {"clip": path, "frames": len(ims), "flicker": round(f, 2), "morph": round(m, 3), "face_min_sim": fs, "flags": flags, "regenerate": bool(flags), "notes": [note] if note else []}

if __name__ == "__main__":
    a = sys.argv[1:]; ref = a[a.index("--ref") + 1] if "--ref" in a else None
    clips = [x for x in a if not x.startswith("--") and x != ref]
    res = [qa(c, ref) for c in clips]
    if "--json" in a: print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res: print(("🔁 再生成推奨 " if r["regenerate"] else "✅ OK ") + r["clip"] + " " + " / ".join(f["ja"] + str(f["at_sec"]) for f in r["flags"]))
    sys.exit(1 if any(r["regenerate"] for r in res) else 0)
