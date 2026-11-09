"""Repack a generated 2x2 pose sheet so no frame reaches into another's cell.

Image generators often let a sword or a flung arm cross the grid line, and tools/pose_sheets.py measures each frame inside
its rect. This splits the figures by connected alpha components (the biggest one in each quadrant is that frame's figure,
loose bits like hair strands go to the nearest figure), lays them out again on a 2x2 grid of equal cells with transparent
gutters and their feet on one baseline, and adds or replaces the sheet's entry in new-characters/sheet-inventory.json.

Usage:  py tools/repack_pose_sheet.py <generated.png> <character id>
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "game", "assets", "attacks", "new-characters")
THRESHOLD, SOLID, STEP, GUTTER, SPECK = 24, 128, 2, 24, 100  # SPECK: smaller loose bits (in STEP blocks) are dropped


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for yy in range(max(0, y - 1), min(h, y + 2)):
                for xx in range(max(0, x - 1), min(w, x + 2)):
                    if mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        q.append((yy, xx))
    return lab, n


def main(src, cid):
    im = Image.open(src).convert("RGBA")
    px = np.array(im)
    alpha = px[:, :, 3] >= THRESHOLD
    H, W = alpha.shape
    hs, ws = -(-H // STEP), -(-W // STEP)

    def coarse(mask):  # any pixel set in a STEP block: keeps the flood fill quick
        pad = np.zeros((hs * STEP, ws * STEP), bool)
        pad[:H, :W] = mask
        return pad.reshape(hs, STEP, ws, STEP).any(axis=(1, 3))
    # figures are found on the solid pixels only, so a faint glow or hair wisp between two poses doesn't join them
    weak = coarse(alpha)
    lab, n = components(coarse(px[:, :, 3] >= SOLID))
    info = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        info.append({"id": i, "size": len(ys), "cx": xs.mean(), "cy": ys.mean(), "box": (xs.min(), ys.min(), xs.max(), ys.max())})
    figures = []
    for qy in range(2):
        for qx in range(2):
            inq = [c for c in info if (c["cx"] >= ws / 2) == qx and (c["cy"] >= hs / 2) == qy]
            if not inq:
                raise SystemExit(f"no figure in quadrant {qx},{qy}")
            figures.append(max(inq, key=lambda c: c["size"]))
    if len({f["id"] for f in figures}) < 4:
        raise SystemExit("two frames touch; regenerate or split by hand")
    owner = {f["id"]: k for k, f in enumerate(figures)}

    def gap(c, f):
        a, b = c["box"], f["box"]
        return max(0, a[0] - b[2], b[0] - a[2]) + max(0, a[1] - b[3], b[1] - a[3])
    for c in info:
        if c["id"] not in owner and c["size"] < SPECK:
            owner[c["id"]] = -1  # generator dust and fringe specks
        elif c["id"] not in owner:
            owner[c["id"]] = min(range(4), key=lambda k: gap(c, figures[k]))
    frame_of = np.array([-1] + [owner[i] for i in range(1, n + 1)])
    cells = frame_of[lab]
    # the faint pixels go to whichever figure reaches them first
    q = deque(zip(*np.nonzero(cells >= 0)))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < hs and 0 <= xx < ws and weak[yy, xx] and cells[yy, xx] < 0 and lab[yy, xx] == 0:
                cells[yy, xx] = cells[y, x]
                q.append((yy, xx))
    fmap = np.kron(cells, np.ones((STEP, STEP), np.int64))[:H, :W]
    crops = []
    for k in range(4):
        m = (fmap == k) & alpha
        ys, xs = np.nonzero(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        part = px[y0:y1, x0:x1].copy()
        part[~m[y0:y1, x0:x1]] = 0
        crops.append(Image.fromarray(part))
    cw = max(c.width for c in crops) + 2 * GUTTER
    ch = max(c.height for c in crops) + 2 * GUTTER
    sheet = Image.new("RGBA", (cw * 2, ch * 2), (0, 0, 0, 0))
    frames = []
    for k, c in enumerate(crops):
        cx, cy = (k % 2) * cw, (k // 2) * ch
        sheet.paste(c, (cx + (cw - c.width) // 2, cy + ch - GUTTER - c.height))
        frames.append({"rect": [cx, cy, cw, ch]})
    os.makedirs(os.path.join(SRC, cid), exist_ok=True)
    sheet.save(os.path.join(SRC, cid, "attack-poses.png"))
    inv_path = os.path.join(SRC, "sheet-inventory.json")
    inv = [e for e in json.load(open(inv_path, encoding="utf-8")) if e["id"] != cid]
    inv.append({"id": cid, "file": f"{cid}/attack-poses.png", "size": list(sheet.size), "alphaRange": [0, 255], "frames": frames})
    json.dump(inv, open(inv_path, "w", encoding="utf-8"), indent=2)
    print(cid, sheet.size, [c.size for c in crops])


if __name__ == "__main__":
    main(*sys.argv[1:3])
