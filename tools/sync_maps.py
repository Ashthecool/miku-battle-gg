"""Copy the Story maps from the Supabase "map-images" bucket into the game.

Every image there becomes game-assets/maps/<name>.webp (same size, WebP), which MB.ACTS in game/js/story.js
names as an act's `map`. Placing the quests on a new map is done by hand in story.js.

Usage:  SUPABASE_SECRET_KEY=sb_secret_... py tools/sync_maps.py [--force]
--force also re-converts maps that are already in game-assets (bump ASSETS in game/sw.js after that).
"""
import io, os, re, sys
from PIL import Image
import supabase_storage as sb

MAP_BUCKET = "map-images"
IMG = re.compile(r"\.(png|jpe?g|webp)$", re.I)


def main():
    force = "--force" in sys.argv
    have = set(sb.list_objects(sb.GAME_BUCKET, "maps"))
    items = []
    for path in sorted(sb.list_objects(MAP_BUCKET)):
        if not IMG.search(path):
            continue
        out = "maps/" + re.sub(r"[^a-z0-9]+", "_", IMG.sub("", path).lower()).strip("_") + ".webp"
        if out in have and not force:
            print("have", out)
            continue
        im = Image.open(io.BytesIO(sb.download(MAP_BUCKET, path))).convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=86, method=5)
        print(f"{path} {im.size[0]}x{im.size[1]} -> {out} ({len(buf.getvalue()) // 1024} KB)")
        items.append((out, buf.getvalue()))
    failed = sb.upload_many(sb.GAME_BUCKET, items) if items else []
    if failed:
        raise SystemExit(f"{len(failed)} uploads failed")


if __name__ == "__main__":
    main()
