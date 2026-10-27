#!/usr/bin/env python3
"""Parts animation helper (パーツアニメ). Free / local only.
  layers <file.psd> --out DIR        PSD -> one full-canvas PNG per visible layer + layers.json   (needs psd-tools, MIT)
  bbox <png...>                      alpha bounding boxes as JSON                                   (Pillow)
  split <image> --out DIR [--no-rembg]  single image -> rough parts (head / body / arms / bg plate) (Pillow+numpy; rembg & OpenCV optional)
  sheet <rig.json> --out PNG         review sheet: composite + pivots + labels
  demo --out DIR                     draws an original simple character as parts (for tests / demo)
Quality note for split: this is a heuristic cut-out (no hidden-area knowledge). Hidden areas are filled by inpainting
(OpenCV Telea) or edge-extension; always review the sheet and fix pivots/parts before animating.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def save(img, d, name):
    os.makedirs(d, exist_ok=True); p = os.path.join(d, name); img.save(p); return name

def bbox_of(img):
    a = np.array(img.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(a > 8)
    if not len(xs): return [0, 0, img.width, img.height]
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]

def cmd_layers(a):
    try:
        from psd_tools import PSDImage
    except ImportError:
        sys.exit("psd-tools がありません: pip install psd-tools （無料・MIT）。または PSD を書き出したレイヤー PNG のフォルダを npm run parts -- import <フォルダ> で読み込めます")
    psd = PSDImage.open(a.file); W, H = psd.width, psd.height; out = []
    leaves = [l for l in psd.descendants() if not l.is_group() and l.is_visible()]
    for i, l in enumerate(leaves):
        im = l.composite()
        if im is None: continue
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0)); canvas.paste(im.convert("RGBA"), (l.left, l.top), im.convert("RGBA"))
        names = [l.name]; p = l.parent
        while p is not None and getattr(p, "name", None) and p is not psd: names.insert(0, p.name); p = p.parent
        fn = save(canvas, a.out, f"{i:02d}.png")
        out.append({"name": "/".join(names), "file": fn, "bbox": bbox_of(canvas)})
    json.dump({"size": [W, H], "layers": out}, open(os.path.join(a.out, "layers.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"ok": True, "n": len(out)}))

def cmd_bbox(a):
    res = {}
    for f in a.files:
        im = Image.open(f); res[f] = {"size": [im.width, im.height], "bbox": bbox_of(im)}
    print(json.dumps(res))

def fg_mask(img, use_rembg=True):
    rgba = np.array(img.convert("RGBA"))
    if (rgba[:, :, 3] < 250).mean() > 0.02: return rgba[:, :, 3] > 127, "alpha"
    if use_rembg:
        try:
            from rembg import remove
            m = np.array(remove(img.convert("RGB")))[:, :, 3] > 127
            return m, "rembg"
        except Exception:
            pass
    rgb = rgba[:, :, :3].astype(float); H, W = rgb.shape[:2]
    corners = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3), rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, 0); d = np.sqrt(((rgb - bg) ** 2).sum(2))
    return d > 40, "corner-colour"

def inpaint(rgb, hole):
    try:
        import cv2
        return cv2.inpaint(rgb, (hole * 255).astype(np.uint8), 7, cv2.INPAINT_TELEA), "OpenCV Telea"
    except Exception:
        out = rgb.copy(); im = Image.fromarray(rgb)
        for r in (4, 12, 32):
            bl = np.array(im.filter(ImageFilter.GaussianBlur(r))); out[hole] = bl[hole]
        return out, "blur fill"

def cmd_split(a):
    img = Image.open(a.image).convert("RGBA"); W, H = img.size
    m, how = fg_mask(img, not a.no_rembg)
    ys, xs = np.where(m)
    if not len(xs): sys.exit("キャラクターが見つかりませんでした（背景と区別できない）。透過PNGか、背景が単色の画像で試してください")
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); ch = y1 - y0
    # head: face detector when available, else the top ~28% of the figure
    neck = int(y0 + ch * 0.28); face_how = "比率推定"
    try:
        import cv2
        g = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2GRAY)
        casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
        f = casc.detectMultiScale(g, 1.1, 5, minSize=(int(ch * 0.08), int(ch * 0.08)))
        if len(f): fx, fy, fw, fh = max(f, key=lambda r: r[2] * r[3]); neck = int(fy + fh * 1.12); face_how = "顔検出"
    except Exception:
        pass
    rgb = np.array(img.convert("RGB")); alpha = (m * 255).astype(np.uint8)
    yy = np.arange(H)[:, None]
    # torso core width measured just below the neck
    band = m[min(H - 1, neck + int(ch * 0.05)):min(H, neck + int(ch * 0.12))]
    cols = np.where(band.any(0))[0] if band.size else np.array([])
    cx = int(np.median(xs[ys > neck])) if (ys > neck).any() else (x0 + x1) // 2
    half = int(max(ch * 0.09, (cols.max() - cols.min()) * 0.32 if len(cols) else ch * 0.1))
    shoulder = neck + int(ch * 0.06)
    left = m & (np.arange(W)[None, :] < cx - half) & (yy > shoulder)
    right = m & (np.arange(W)[None, :] > cx + half) & (yy > shoulder)
    head = m & (yy < neck + int(ch * 0.02))
    body = m & ~head & ~left & ~right
    parts = {}
    def layer(mask, fill_rgb=None):
        a2 = (mask * 255).astype(np.uint8); src = fill_rgb if fill_rgb is not None else rgb
        return Image.fromarray(np.dstack([src, a2]))
    # body: extend upward into the neck/head area by inpainting so a turning head never shows a hole
    neck_zone = (yy < neck + int(ch * 0.02)) & (yy > neck - int(ch * 0.08)) & (np.abs(np.arange(W)[None, :] - cx) < half * 0.6) & m
    hole = (neck_zone | left | right) & m
    filled, inp = inpaint(rgb, hole & ~(body))
    body_ext = body | neck_zone
    # arms leave a hole in the body edge: fill a thin strip along the torso
    parts["体"] = save(layer(body_ext, filled), a.out, "body.png")
    parts["頭"] = save(layer(head), a.out, "head.png")
    if left.sum() > ch * 4: parts["左腕"] = save(layer(left), a.out, "arm_l.png")
    if right.sum() > ch * 4: parts["右腕"] = save(layer(right), a.out, "arm_r.png")
    bgfill, _ = inpaint(rgb, m)
    save(Image.fromarray(bgfill).convert("RGBA"), a.out, "background_plate.png")
    layers = [{"name": n, "file": f, "bbox": bbox_of(Image.open(os.path.join(a.out, f)))} for n, f in parts.items()]
    order = {"体": 0, "左腕": 1, "右腕": 2, "頭": 3}
    layers.sort(key=lambda l: order.get(l["name"], 9))
    note = f"自動分解（{how}で切り抜き・頭={face_how}・隠れた所={inp}）。髪・目・口は分かれていません。目パチ口パクは既存の顔リグ（npm run faces）か、口と目のレイヤーを追加してください。"
    json.dump({"size": [W, H], "layers": layers, "note": note, "plate": "background_plate.png"}, open(os.path.join(a.out, "layers.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"ok": True, "n": len(layers), "note": note}, ensure_ascii=False))

def font(sz):
    for p in [os.path.join(os.path.dirname(__file__), "..", "public", "fonts", "NotoSansJP.ttf")]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def cmd_sheet(a):
    rig = json.load(open(a.rig)); base = os.path.dirname(a.rig); W, H = rig["size"]
    comp = Image.new("RGBA", (W, H), (40, 40, 48, 255))
    for p in sorted(rig["parts"], key=lambda p: p["z"]):
        f = os.path.join(base, os.path.basename(p["src"]))
        if os.path.exists(f): comp.alpha_composite(Image.open(f).convert("RGBA").resize((W, H)))
    d = ImageDraw.Draw(comp); fs = max(14, W // 40)
    for p in rig["parts"]:
        x, y = p["pivot"]; r = max(6, W // 90)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 70, 160), width=3); d.line([x - 2 * r, y, x + 2 * r, y], fill=(255, 70, 160), width=2); d.line([x, y - 2 * r, x, y + 2 * r], fill=(255, 70, 160), width=2)
        d.text((x + 2 * r, y - fs), f'{p["id"]} ({p["kind"]})', fill=(255, 255, 255), font=font(fs), stroke_width=2, stroke_fill=(0, 0, 0))
    comp.convert("RGB").save(a.out); print(json.dumps({"ok": True, "out": a.out}))

def cmd_demo(a):
    """original simple character (not based on any existing artwork). 2x supersampled."""
    W, H, S = 800, 1200, 2
    def canvas(): im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
    def done(im, name): save(im.resize((W, H), Image.LANCZOS), a.out, name); return name
    s = lambda *v: [x * S for x in v]
    SKIN, HAIR, HAIR2, CLOTH, CLOTH2, LINE, ACC = (255, 226, 205, 255), (52, 44, 92, 255), (72, 62, 128, 255), (245, 245, 250, 255), (215, 25, 42, 255), (30, 24, 40, 255), (255, 214, 60, 255)
    L = []
    im, d = canvas(); d.ellipse(s(250, 170, 550, 560), fill=HAIR); d.rectangle(s(255, 360, 545, 640), fill=HAIR); L.append(("後ろ髪", done(im, "hair_back.png")))
    im, d = canvas(); d.rounded_rectangle(s(370, 470, 430, 540), 20, fill=SKIN)
    d.polygon(s(300, 520, 500, 520, 560, 900, 240, 900), fill=CLOTH); d.polygon(s(240, 880, 560, 880, 610, 1120, 190, 1120), fill=CLOTH2)
    d.polygon(s(360, 520, 400, 600, 440, 520), fill=CLOTH2); d.rectangle(s(330, 1110, 380, 1190), fill=SKIN); d.rectangle(s(420, 1110, 470, 1190), fill=SKIN)
    L.append(("体", done(im, "body.png")))
    im, d = canvas(); d.rounded_rectangle(s(235, 525, 290, 800), 26, fill=CLOTH); d.ellipse(s(232, 780, 292, 840), fill=SKIN); L.append(("左腕", done(im, "arm_l.png")))
    im, d = canvas(); d.rounded_rectangle(s(510, 525, 565, 800), 26, fill=CLOTH); d.ellipse(s(508, 780, 568, 840), fill=SKIN); L.append(("右腕", done(im, "arm_r.png")))
    im, d = canvas(); d.ellipse(s(285, 230, 515, 500), fill=SKIN); L.append(("頭", done(im, "head.png")))
    for name, closed in (("目", False), ("目_閉じ", True)):
        im, d = canvas()
        for cx in (350, 450):
            if closed: d.arc(s(cx - 26, 350, cx + 26, 390), 200, 340, fill=LINE, width=6 * S)
            else: d.ellipse(s(cx - 22, 335, cx + 22, 395), fill=LINE); d.ellipse(s(cx - 10, 345, cx + 2, 360), fill=(255, 255, 255, 255))
        L.append((name, done(im, "eyes_closed.png" if closed else "eyes.png")))
    shapes = {"口": lambda d: d.line(s(385, 445, 415, 445), fill=LINE, width=5 * S), "口_a": lambda d: d.ellipse(s(382, 432, 418, 470), fill=(150, 30, 50, 255)),
              "口_i": lambda d: d.rounded_rectangle(s(375, 438, 425, 454), 8, fill=(150, 30, 50, 255)), "口_u": lambda d: d.ellipse(s(392, 436, 408, 456), fill=(150, 30, 50, 255)),
              "口_e": lambda d: d.ellipse(s(380, 436, 420, 460), fill=(150, 30, 50, 255)), "口_o": lambda d: d.ellipse(s(386, 432, 414, 466), fill=(150, 30, 50, 255))}
    for n, fn in shapes.items(): im, d = canvas(); fn(d); L.append((n, done(im, f"mouth{n[1:] or ''}.png".replace("_", "_"))))
    im, d = canvas(); d.polygon(s(270, 330, 300, 200, 400, 165, 500, 200, 530, 330, 480, 290, 440, 320, 400, 280, 360, 320, 320, 290), fill=HAIR2); L.append(("前髪", done(im, "hair_front.png")))
    im, d = canvas(); d.polygon(s(470, 205, 540, 170, 530, 240), fill=ACC); d.polygon(s(470, 205, 420, 160, 430, 235), fill=ACC); d.ellipse(s(458, 192, 482, 218), fill=CLOTH2); L.append(("リボン", done(im, "ribbon.png")))
    layers = [{"name": n, "file": f, "bbox": bbox_of(Image.open(os.path.join(a.out, f)))} for n, f in L]
    json.dump({"size": [W, H], "layers": layers, "note": "デモ用のオリジナル簡易キャラ（既存作品の模写ではありません）"}, open(os.path.join(a.out, "layers.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"ok": True, "n": len(layers)}))

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("layers"); p.add_argument("file"); p.add_argument("--out", required=True)
    p = sp.add_parser("bbox"); p.add_argument("files", nargs="+")
    p = sp.add_parser("split"); p.add_argument("image"); p.add_argument("--out", required=True); p.add_argument("--no-rembg", action="store_true")
    p = sp.add_parser("sheet"); p.add_argument("rig"); p.add_argument("--out", required=True)
    p = sp.add_parser("demo"); p.add_argument("--out", required=True)
    a = ap.parse_args(); {"layers": cmd_layers, "bbox": cmd_bbox, "split": cmd_split, "sheet": cmd_sheet, "demo": cmd_demo}[a.cmd](a)
