"""Contact sheets of every outfit a novel would bring into the game (one neutral sprite each, labelled
"character-id/outfit-id"), to check them by eye before uploading. Anything that shouldn't be in the game goes
into NSFW_OUTFITS in fetch_assets.py (blank or placeholder art into SKIP_OUTFITS).

Usage:  py tools/outfit_sheets.py OUT_DIR novel-title-part [...]
"""
import glob, io, json, os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
from fetch_assets import characters, load_novel, get, slug

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TW, TH, COLS, ROWS = 180, 270, 8, 3


def thumb(job):
    label, src = job
    try:
        im = Image.open(io.BytesIO(get(src, "1080p/"))).convert("RGBA")
        im.thumbnail((TW, TH - 18))
    except Exception as e:
        im = None
        label += f" FAIL {e}"[:40]
    return label, im


def main():
    out_dir, parts = sys.argv[1], [a.lower() for a in sys.argv[2:]]
    os.makedirs(out_dir, exist_ok=True)
    jobs = []
    for p in sorted(glob.glob(os.path.join(ROOT, "novels", "*.json"))):
        novel = load_novel(p)
        if parts and not any(x in novel["title"].lower() for x in parts):
            continue
        for e in characters(novel):
            for o in e["outfits"]:
                emo = {x["id"]: x["sources"]["png"] for x in o["emotions"]}
                jobs.append((f"{slug(e['name'])}/{slug(o['name'])}", emo.get("neutral") or next(iter(emo.values()))))
    with ThreadPoolExecutor(8) as ex:
        thumbs = list(ex.map(thumb, jobs))
    per = COLS * ROWS
    for n in range(0, len(thumbs), per):
        sheet = Image.new("RGB", (COLS * TW, ROWS * TH), "white")
        d = ImageDraw.Draw(sheet)
        for i, (label, im) in enumerate(thumbs[n:n + per]):
            x, y = i % COLS * TW, i // COLS * TH
            if im:
                sheet.paste(im, (x + (TW - im.width) // 2, y + 18), im)
            d.text((x + 3, y + 3), label[:30], fill="black")
        path = os.path.join(out_dir, f"sheet_{n // per + 1:02d}.png")
        sheet.save(path)
        print(path)


if __name__ == "__main__":
    main()
