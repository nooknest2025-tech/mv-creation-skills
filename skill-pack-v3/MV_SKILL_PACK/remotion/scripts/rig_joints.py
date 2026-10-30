"""パーツの腕・脚を関節（肘・膝）で2つに分け、関節を丸いパッドでつなぎます。腕を太くするオプション付き。

使い方:
  python scripts/rig_joints.py <rigフォルダ> --arm arm_l --joint 281,546 --end 272,671 [--thicken 1.25]
  python scripts/rig_joints.py <rigフォルダ> --auto [--thicken 1.25]

  --auto は rig.json の腕（kind arm_l/arm_r）と脚（leg_l/leg_r）を全部分けます。関節の位置は
  パーツの "elbow" / "knee"、先端は手の pivot（腕）・"foot"（脚）を使います。
  無ければ 付け根→先端 の中点を関節にします。

  出力（同じフォルダ）:
    <元>-upper.png（付け根側）と <元>-lower.png（先の側＋関節パッド）
    rig.json には fore_l/fore_r（腕）・shin_l/shin_r（脚）を追加し、手・靴の親を先の側に付け替え
    元の rig.json は rig.before-joints.json に残します

  ポイント:
  - パッドは関節の幅の円で、色は関節近くの中身の色（肌・服）の中央値。輪郭線は描きません
    （線を描くと、曲げた時に関節に黒い輪が出ます）。
  - パッドは先の側（前腕・すね）の画像に入るので、どう曲げても隙間が出ません。
  - --thicken は付け根→先端の線に直角な方向にだけ広げます（長さは変えません）。細い腕が棒に見える時に 1.15〜1.3。
"""
import argparse, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def thicken(a, p0, p1, k):
    if abs(k - 1) < 1e-3: return a
    d = (p1 - p0) / np.linalg.norm(p1 - p0); n = np.array([-d[1], d[0]])
    Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    rel = np.stack([X - p0[0], Y - p0[1]], -1); along = rel @ d; perp = rel @ n
    sx = p0[0] + d[0] * along + n[0] * perp / k; sy = p0[1] + d[1] * along + n[1] * perp / k
    xi = np.clip(np.round(sx).astype(int), 0, a.shape[1] - 1); yi = np.clip(np.round(sy).astype(int), 0, a.shape[0] - 1)
    return a[yi, xi]


def split(img_path, root, joint, end, out_up, out_lo, k=1.0):
    a = np.array(Image.open(img_path).convert("RGBA")); root, joint, end = map(np.asarray, (root, joint, end))
    a = thicken(a, root, end, k)
    d = (end - root) / np.linalg.norm(end - root)
    Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    along = (X - joint[0]) * d[0] + (Y - joint[1]) * d[1]; perp = (X - joint[0]) * (-d[1]) + (Y - joint[1]) * d[0]
    row = (np.abs(along) < 1.5) & (a[..., 3] > 128)
    if not row.any(): sys.exit(f"{img_path.name}: 関節 {joint.tolist()} の位置に絵がありません")
    w = perp[row]; hw = (w.max() - w.min()) / 2; cen = (w.max() + w.min()) / 2; c = joint + np.array([-d[1], d[0]]) * cen
    inner = (np.abs(along) < 6) & (np.abs(perp - cen) < hw * 0.5) & (a[..., 3] > 200)
    fill = tuple(int(v) for v in np.median(a[inner][:, :3], 0)) if inner.any() else (230, 200, 180)
    up = a.copy(); up[along > 1.0, 3] = 0
    lo = a.copy(); lo[along < 0, 3] = 0
    pad = Image.new("RGBA", (a.shape[1], a.shape[0]), (0, 0, 0, 0)); r = hw - 1.5
    ImageDraw.Draw(pad).ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=fill + (255,))
    pad.alpha_composite(Image.fromarray(lo))
    Image.fromarray(up).save(out_up); pad.save(out_lo)
    return [round(float(v), 2) for v in c], round(float(hw), 1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("rig"); ap.add_argument("--auto", action="store_true")
    ap.add_argument("--arm"); ap.add_argument("--joint"); ap.add_argument("--end"); ap.add_argument("--thicken", type=float, default=1.0)
    o = ap.parse_args(); R = Path(o.rig); rj = json.loads((R / "rig.json").read_text(encoding="utf-8")); P = {p["id"]: p for p in rj["parts"]}
    xy = lambda s: [float(v) for v in s.split(",")]
    jobs = []
    for p in rj["parts"]:
        if o.arm and p["id"] != o.arm: continue
        if not o.auto and not o.arm: break
        if p["kind"] not in ("arm_l", "arm_r", "leg_l", "leg_r"): continue
        arm = p["kind"].startswith("arm"); side = p["kind"][-1]
        tip = next((q for q in rj["parts"] if q.get("parent") == p["id"] and q["kind"] == ("hand_" if arm else "foot_") + side), None)
        end = xy(o.end) if o.end else (tip["pivot"] if tip and arm else p.get("foot") or (tip and tip["pivot"]))
        if end is None: print(p["id"], ": 先端（手の pivot / foot）がありません。--end で指定してください"); continue
        joint = xy(o.joint) if o.joint else p.get("elbow" if arm else "knee") or [(p["pivot"][0] + end[0]) / 2, (p["pivot"][1] + end[1]) / 2]
        jobs.append((p, arm, side, tip, joint, end))
    if not jobs: sys.exit("分ける部品がありません（--auto か --arm <id> を指定）")
    shutil.copy(R / "rig.json", R / "rig.before-joints.json")
    for p, arm, side, tip, joint, end in jobs:
        stem = Path(p["src"]).stem; up, lo = f"{stem}-upper.png", f"{stem}-lower.png"
        c, hw = split(R / p["src"], p["pivot"], joint, end, R / up, R / lo, o.thicken if arm else 1.0)
        nid = ("fore_" if arm else "shin_") + side
        p["src"] = up; p["elbow" if arm else "knee"] = c
        q = {"id": nid, "src": lo, "kind": nid, "parent": p["id"], "pivot": c, "z": p["z"] + (0.2 if arm else -0.1)}
        rj["parts"] = [x for x in rj["parts"] if x["id"] != nid]; rj["parts"].insert(rj["parts"].index(p) + 1, q)
        if tip: tip["parent"] = nid
        print(f"{p['id']}: 関節 {c}（幅の半分 {hw}px）→ {up} / {lo}  親付け替え: {tip['id'] if tip else '-'}")
    if any(j[1] for j in jobs) and "zArm" not in rj:  # 腕の重ね順をポーズで切り替える（下の説明は docs/recipes/parts_dance_mv_ja.md）
        rj["zArm"] = {"bend": 45, "front": {"arm": 7.4, "sleeve": 7.6, "fore": 7.7, "hand": 7.8}, "side": {"arm": 5, "fore": 4.9, "hand": 4.95, "sleeve": 7.5}}
    if any(not j[1] for j in jobs): rj["legs"] = True
    (R / "rig.json").write_text(json.dumps(rj, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__": main()
