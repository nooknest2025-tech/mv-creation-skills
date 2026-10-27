"""Data-driven eyelid painter for blink patches (from the author's earlier Python MV engine, MIT).
eye_patches(key, face, src) -> [(x0, y0, half_rgb, closed_rgb, half_alpha, closed_alpha), ...]"""
from __future__ import annotations
import math
import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - checked by doctor
    cv2 = None



def need_cv2():
    if cv2 is None:
        raise RuntimeError("opencv-python-headless (<5) がありません → pip install -r requirements_optional.txt")
    return cv2


def _ell_mask(h, w, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2


def _poly(img, pts, col, th):
    n = len(pts)
    for i in range(n - 1):
        u = abs(2 * i / max(1, n - 2) - 1)
        t = max(1, int(round(th * (1.0 - 0.7 * u ** 3))))
        cv2.line(img, (int(pts[i][0] * 4), int(pts[i][1] * 4)), (int(pts[i + 1][0] * 4), int(pts[i + 1][1] * 4)),
                 col, t, cv2.LINE_AA, shift=2)


_P: dict = {}


def eye_patches(key: str, face: dict, src: np.ndarray, seed: int = 0) -> list:
    """Data-driven blink patches: find the dark eye blob (iris + thick upper lash; thin hair strands removed by
    a morphological opening), paint it over with lid/skin tone and draw a closed-lid lash line along the eye's
    own lower contour. Returns [(x0, y0, half_rgb, closed_rgb, alpha_half, alpha_closed)]."""
    need_cv2()
    ck = (key, src.shape)
    if ck in _P:
        return _P[ck]
    if len(_P) > 16:
        _P.clear()
    H, W = src.shape[:2]
    out = []
    eyes = face.get("eyes") or []
    for ex, ey, rx, ry in eyes:
        cx, cy, rx, ry = ex * W, ey * H, rx * W, ry * H
        x0, x1 = max(0, int(cx - 1.8 * rx)), min(W, int(cx + 1.8 * rx))
        y0, y1 = max(0, int(cy - 1.8 * ry)), min(H, int(cy + 1.8 * ry))
        crop = src[y0:y1, x0:x1].copy()
        h, w = crop.shape[:2]
        if h < 8 or w < 8:
            continue
        lcx, lcy = cx - x0, cy - y0
        lum = crop.astype(np.float32).mean(2)
        d = _ell_mask(h, w, lcx, lcy, rx * 1.25, ry * 1.25)
        dark = ((lum < 78) & (d <= 1)).astype(np.uint8)
        k = max(3, int(0.32 * ry)) | 1
        op = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        op = cv2.morphologyEx(op, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        nl, lab, st, cen = cv2.connectedComponentsWithStats(op)
        if nl <= 1:
            continue
        best = max(range(1, nl), key=lambda j: st[j, cv2.CC_STAT_AREA] /
                   (1 + ((cen[j][0] - lcx) / rx) ** 2 + ((cen[j][1] - lcy) / ry) ** 2))
        blob = (lab == best).astype(np.uint8)
        blob[:max(0, int(lcy - 1.15 * ry))] = 0
        blob[int(lcy + 1.15 * ry):] = 0
        cnts, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        blob = np.zeros_like(blob)
        cv2.drawContours(blob, cnts, -1, 1, -1)
        cols = np.where(blob.any(0))[0]
        if len(cols) < 5:
            continue
        yt = np.array([np.where(blob[:, c])[0].min() for c in cols], np.float32)
        yb = np.array([np.where(blob[:, c])[0].max() for c in cols], np.float32)
        cf = cols.astype(np.float32)
        yt = np.polyval(np.polyfit(cf, yt, 2), cf).astype(np.float32)
        yb = np.polyval(np.polyfit(cf, yb, 2), cf).astype(np.float32)
        ring = crop[(d > 1.0) & (d < 2.4)].astype(np.float32)
        rl = ring.mean(1) if len(ring) else np.zeros(0)
        rs = ring[(rl >= np.percentile(rl, 30)) & (rl <= np.percentile(rl, 60))] if len(ring) else ring
        skin = np.median(rs, axis=0) if len(rs) else np.array([150, 138, 132], np.float32)
        lid = skin * 0.72
        yy = np.arange(h, dtype=np.float32)[:, None]
        g = np.clip((yy - yt.min()) / max(4, (yb.max() - yt.min())), 0, 1)[..., None]
        rng = np.random.default_rng(seed * 7 + int(ex * 1000))
        base = lid * (1 - g) + skin * g
        base = base + cv2.GaussianBlur(rng.normal(0, 9, (h, w)).astype(np.float32), (0, 0), 2.5)[..., None] \
            + rng.normal(0, 3, (h, w, 1))
        base = np.clip(base, 0, 255)
        dk = max(3, int(0.12 * ry)) | 1
        mfull = cv2.dilate(blob, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dk, dk))).astype(np.float32)
        tel = cv2.inpaint(crop, (mfull > 0).astype(np.uint8) * 255, int(max(5, 0.3 * ry)), cv2.INPAINT_TELEA).astype(np.float32)
        tel = cv2.GaussianBlur(tel, (0, 0), max(2, 0.10 * ry))
        tl = tel.mean(2, keepdims=True)
        tel = np.where(tl < skin.mean() * 0.8, tel * 0.35 + base * 0.65, tel * 0.6 + base * 0.4)
        base = np.clip(tel + rng.normal(0, 3, (h, w, 1)), 0, 255)
        gray = lum.astype(np.uint8)
        kb = max(5, int(0.30 * ry)) | 1
        bh = (cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kb, kb))).astype(np.float32) - lum)
        bh = cv2.GaussianBlur(np.clip(bh - 12, 0, 255), (0, 0), 0.7)[..., None]
        base = np.clip(base - 0.9 * bh, 0, 255)
        sh = np.zeros((h, w), np.float32)
        for i, c in enumerate(cols):
            sh[:, c] = np.exp(-((np.arange(h) - (yt[i] + 0.15 * (yb[i] - yt[i]))) / max(2, 0.35 * (yb[i] - yt[i]))) ** 2)
        sh = cv2.GaussianBlur(sh, (0, 0), max(1.5, 0.12 * rx))[..., None]
        base = np.clip(base * (1 - 0.28 * sh), 0, 255)
        af = cv2.GaussianBlur(mfull, (0, 0), max(1.5, 0.08 * ry))[..., None]
        closed = np.clip(crop * (1 - af) + base * af, 0, 255).astype(np.uint8)
        dark_col = tuple(int(v) for v in np.percentile(crop[blob > 0], 3, axis=0))
        th = max(3, 0.22 * ry)
        hgt = yb - yt
        _poly(closed, [(x, yb[i] - 0.18 * hgt[i]) for i, x in enumerate(cf)], dark_col, th)
        side = 1 if cx > W * 0.5 * (eyes[0][0] + eyes[-1][0]) else -1
        j = -1 if side > 0 else 0
        ex_, ey_ = float(cols[j]), float(yb[j] - 0.18 * hgt[j])
        cv2.line(closed, (int(ex_ * 4), int(ey_ * 4)), (int((ex_ + side * 0.22 * rx) * 4), int((ey_ - 0.10 * ry) * 4)),
                 dark_col, max(1, int(th * 0.6)), cv2.LINE_AA, shift=2)
        for q in (0.55, 0.7, 0.85):
            ii = int(q * (len(cols) - 1)) if side > 0 else int((1 - q) * (len(cols) - 1))
            px, py = float(cols[ii]), float(yb[ii] - 0.18 * hgt[ii])
            cv2.line(closed, (int(px * 4), int(py * 4)), (int((px + side * 0.06 * rx) * 4), int((py + 0.16 * ry) * 4)),
                     dark_col, max(1, int(th * 0.35)), cv2.LINE_AA, shift=2)
        mid = yt + 0.52 * hgt
        cover = np.zeros((h, w), np.float32)
        for i, c in enumerate(cols):
            cover[:int(mid[i]), c] = 1
        mh = mfull * cover
        ah = cv2.GaussianBlur(mh, (0, 0), max(1.2, 0.05 * ry))[..., None]
        half = np.clip(crop * (1 - ah) + base * ah, 0, 255).astype(np.uint8)
        _poly(half, [(x, mid[i]) for i, x in enumerate(cf)], dark_col, th * 1.25)
        a_c = np.clip(cv2.GaussianBlur(cv2.dilate(mfull, np.ones((int(th * 2) | 1, int(th * 2) | 1), np.uint8)),
                                       (0, 0), 1.5), 0, 1)[..., None]
        out.append((x0, y0, half, closed, a_c, a_c))
    _P[ck] = out
    return out


