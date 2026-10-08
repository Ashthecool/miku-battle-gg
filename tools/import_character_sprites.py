"""Import one existing miku.gg character's safe default outfit from a novel export.

Usage: py tools/import_character_sprites.py "Paradiso Suburbia" "Asher" [id]

`id` names a character whose name makes no id of its own (a "???" gets "binary-entity").

The exported sprite database supplies the images. This writes game-local WebP files and
appends one character to manifest.json/js; no R2 credentials or bucket writes are needed.

Later, with the R2 keys (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY as env vars):
    py tools/import_character_sprites.py --upload hil-kuntnovi binary-entity
uploads those characters' local sprites (both sizes) to the bucket, checks they are public and
points their manifest entries at the bucket.
"""
import glob
import json
import os
import re
import sys

import fetch_assets as assets


def main(title, name, cid=None):
    paths = glob.glob(os.path.join(assets.ROOT, "novels", "*.json"))
    novel = None
    for path in paths:
        candidate = assets.load_novel(path)
        if candidate["title"] == title:
            novel = candidate
            break
    if novel is None:
        raise SystemExit(f"Novel export not found: {title}")
    # The normal bulk importer deliberately limits casts. A requested individual character may be outside that list.
    limit = assets.ONLY_CHARACTERS.pop(title, None)
    try:
        entry = next((c for c in assets.characters(novel) if c["name"].casefold() == name.casefold()), None)
    finally:
        if limit is not None:
            assets.ONLY_CHARACTERS[title] = limit
    if entry is None:
        raise SystemExit(f"Character with a usable sprite not found: {name}")
    outfit = next((o for o in entry["outfits"] if not o["_nsfw"]), None)
    if outfit is None:
        raise SystemExit(f"No safe default outfit for {name}")

    manifest_path = os.path.join(assets.OUT, "manifest.json")
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    existing = next((c for c in manifest["characters"] if c["novel"] == title and c["name"] == entry["name"]), None)
    if existing:
        raise SystemExit(f"Already in the manifest as {existing['id']}")
    cid = cid or assets.slug(entry["name"])
    if not cid:
        raise SystemExit(f"{name} makes no id; pass one")
    if any(c["id"] == cid for c in manifest["characters"]):
        cid += "-" + assets.slug(title).split("-")[0]

    available = {e["id"]: e["sources"]["png"] for e in outfit["emotions"]}
    sprites = {}
    for role, prefs in assets.ROLES.items():
        emotion = next((p for p in prefs if p in available), "neutral" if "neutral" in available else next(iter(available)))
        if role == "attack":
            emotion = assets.pick_attack_emotion(cid, available) or emotion
        sprites[role] = f"local/sprites/{cid}/{emotion}.webp"
    tasks = {path.rsplit("/", 1)[-1]: available[path.rsplit("/", 1)[-1][:-5]] for path in sprites.values()}
    for filename, src in tasks.items():
        data = assets.get(src, "1080p/")
        big = assets.convert_img(data, max_h=900)
        small = assets.convert_img(data, max_h=450, quality=88)
        for kind, image in [("sprites", big), ("sm/sprites", small)]:
            folder = os.path.join(assets.OUT, "local", *kind.split("/"), cid)
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, filename), "wb") as fh:
                fh.write(image)
        print(f"Fetched {entry['name']} {filename}", flush=True)

    source = entry["src"]
    desc = source["card"]["data"].get("description", "")
    short = source.get("short_description", "").replace("{{user}}", "you").strip()
    if not short:
        short = desc.replace("{{user}}", "you").split(".", 1)[0].strip()[:150]
    personality = re.search(r"Personality:\s*\[?([^\]\n{}]+)", desc)
    traits = [t for t in (x.strip(' ".,') for x in personality.group(1).split(",")) if t and len(t.split()) <= 3][:8] if personality else []
    manifest["characters"].append({
        "id": cid, "name": entry["name"], "outfit": outfit["name"],
        "short": short,
        "traits": traits, "sprites": sprites, "costumes": [], "portrait": None, "novel": title,
        **({"nsfw": True} if title in assets.NSFW_NOVELS else {}),
    })
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(assets.OUT, "manifest.js"), "w", encoding="utf-8") as fh:
        fh.write("window.MIKU_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print(f"Added {cid} with {len(tasks)} downloaded source images. Description: {desc[:170].replace(chr(10), ' ')}")


def upload(ids):
    import urllib.request
    import r2_storage as r2
    manifest_path = os.path.join(assets.OUT, "manifest.json")
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    base = re.search(r"ASSET_BASE = '([^']+)'", open(os.path.join(assets.ROOT, "game", "js", "config.js"), encoding="utf-8").read()).group(1)
    for cid in ids:
        entry = next((c for c in manifest["characters"] if c["id"] == cid), None)
        if entry is None:
            raise SystemExit(f"{cid} is not in the manifest")
        local = sorted({p for p in entry["sprites"].values() if p.startswith("local/")})
        if not local:
            print(f"{cid}: already in the bucket")
            continue
        for path in local:
            rel = path[len("local/"):]
            for key in (rel, "sm/" + rel):
                with open(os.path.join(assets.OUT, "local", *key.split("/")), "rb") as fh:
                    r2.upload(key, fh.read())
                with urllib.request.urlopen(urllib.request.Request(base + key, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as res:
                    if res.status != 200:
                        raise SystemExit(f"{base + key} is not public ({res.status})")
            print(f"{cid}: uploaded {rel}", flush=True)
        entry["sprites"] = {role: p[len("local/"):] if p.startswith("local/") else p for role, p in entry["sprites"].items()}
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(assets.OUT, "manifest.js"), "w", encoding="utf-8") as fh:
        fh.write("window.MIKU_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print("Manifest now points at the bucket; commit game/assets/manifest.{json,js}.")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--upload":
        upload(sys.argv[2:])
        raise SystemExit()
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
