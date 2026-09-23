"""Download sprites, backgrounds and item icons referenced by the miku.gg novels, resize them and upload
them to the Supabase "game-assets" bucket, then write game/assets/manifest.{json,js}, the one merged
manifest the game reads (image paths are relative to the bucket; music is streamed by URL).

Usage:  SUPABASE_SECRET_KEY=sb_secret_... py tools/fetch_assets.py [novel.json ...]   (default: every novels/*.json)
Images already in the bucket are skipped. Set MIKU_TOKEN to send the miku.gg auth token with each request.
"""
import io, json, os, re, sys, glob, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import supabase_storage as sb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "game", "assets")
ASSET_DB = "https://assets.miku.services"
ASSET_DB_OPT = "https://mikugg-assets.nyc3.cdn.digitaloceanspaces.com"
TOKEN = os.environ.get("MIKU_TOKEN", "")
SMALL_H = 450  # height of the sm/ sprite copies (MB.spriteSrc in game/js/config.js)

# Emotions the battle system uses; first match per role wins.
ROLES = {
    "idle":   ["neutral"],
    "play":   ["happy", "excited"],
    "attack": ["angry", "rage", "frustrated"],
    "special":["rage", "angry"],
    "hurt":   ["scared", "shocked", "surprised"],
    "lose":   ["sad", "disappointed"],
    "win":    ["excited", "proud", "happy"],
    "taunt":  ["proud", "amused", "happy"],
}


def urls(src, prefix):
    if src.startswith("optimized/"):
        return [f"{ASSET_DB_OPT}/{prefix}{src}", f"{ASSET_DB_OPT}/{src}"]
    return [f"{ASSET_DB}/{src}"]


def get(src, prefix=""):
    last = None
    for u in urls(src, prefix):
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0",
                                                 **({"Cookie": f"auth={TOKEN}"} if TOKEN else {})})
        for _ in range(3):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                last = e
                break  # wrong URL variant, try the next one
            except Exception as e:  # timeouts / resets: retry same URL
                last = e
    raise RuntimeError(f"{src}: {last}")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def convert_img(data, max_w=None, max_h=None, fmt="WEBP", quality=86):
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    if im.mode == "RGBA":  # trim transparent padding so sprites stand on the ground
        bbox = im.getchannel("A").getbbox()
        if bbox:
            im = im.crop(bbox)
    w, h = im.size
    scale = min((max_w or w) / w, (max_h or h) / h, 1)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, fmt, quality=quality, method=5)
    return buf.getvalue()


def add_novel(novel, manifest):
    """Queue downloads for one novel and append its entries to the manifest."""
    jobs = []

    def outfit_sprites(outfit, folder):
        emo = {e["id"]: e["sources"]["png"] for e in outfit["emotions"]}
        sprites = {}
        for role, prefs in ROLES.items():
            pick = next((p for p in prefs if p in emo), "neutral" if "neutral" in emo else next(iter(emo)))
            rel = f"{folder}/{pick}.webp"
            sprites[role] = rel
            jobs.append((emo[pick], "1080p/", rel, dict(max_h=900)))
        return sprites

    for c in novel["characters"]:
        cid = slug(c["name"])
        outfits = c["card"]["data"]["extensions"]["mikugg_v2"]["outfits"]
        outfit = outfits[0]
        sprites = outfit_sprites(outfit, f"sprites/{cid}")
        # every other outfit becomes a costume (used by the wardrobe and by relationship fusions)
        costumes = [{"id": slug(o["name"]), "name": o["name"].strip(),
                     "sprites": outfit_sprites(o, f"sprites/{cid}/{slug(o['name'])}")} for o in outfits[1:]]
        portrait = None
        if c.get("profile_pic") and c["profile_pic"] != "empty_char.png":
            portrait = f"portraits/{cid}.webp"
            jobs.append((c["profile_pic"], "256p/", portrait, dict(max_w=400, max_h=560)))
        desc = c["card"]["data"].get("description", "")
        m = re.search(r"Personality:\s*\[([^\]]+)", desc)
        manifest["characters"].append({
            "id": cid, "name": c["name"].strip(), "outfit": outfit["name"],
            "short": c["short_description"].replace("{{user}}", "you"),
            "traits": [t.strip(' ",') for t in m.group(1).split(",")][:8] if m else [],
            "sprites": sprites, "costumes": costumes, "portrait": portrait, "novel": novel["title"]})

    for b in novel["backgrounds"]:
        src = b["source"].get("jpg")
        if not src:
            continue
        rel = f"backgrounds/{slug(b['name'])}-{b['id'][:6]}.webp"
        jobs.append((src, "1080p/", rel, dict(max_w=1600, fmt="WEBP", quality=80)))
        manifest["backgrounds"].append({"id": b["id"], "name": b["name"].replace("{{user}}", "Your"),
                                        "desc": b["description"], "src": rel})

    for it in novel["inventory"]:
        if any(i["id"] == slug(it["name"]) for i in manifest["items"]):
            continue
        rel = f"items/{slug(it['name'])}.webp"
        jobs.append((it["icon"], "256p/", rel, dict(max_w=256, max_h=256)))
        manifest["items"].append({"id": slug(it["name"]), "name": it["name"].strip(),
                                  "desc": it["description"], "icon": rel})

    # music is streamed straight from the miku.gg CDN by the game, not downloaded
    for s in novel["songs"]:
        sid, n = slug(s["name"]), 2
        while any(m["id"] == sid for m in manifest["music"]):  # same song name in two novels
            sid, n = f"{slug(s['name'])}-{n}", n + 1
        manifest["music"].append({"id": sid, "name": s["name"], "tags": s["tags"], "novel": novel["title"],
                                   "url": urls(s["source"], "")[0]})
    return jobs


def main():
    paths = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "novels", "*.json")))
    jobs, manifest = [], {"title": None, "novels": [], "characters": [], "backgrounds": [], "items": [], "music": []}
    for p in paths:
        novel = json.load(open(p, encoding="utf-8"))["novel"]
        manifest["title"] = manifest["title"] or novel["title"]
        manifest["novels"].append(novel["title"])
        jobs += add_novel(novel, manifest)

    sb.ensure_bucket(sb.GAME_BUCKET)
    uploaded = set(sb.list_objects(sb.GAME_BUCKET))

    # sprites also get a half-size copy under sm/, which the game uses for cards and the board
    def run(job):
        src, prefix, rel, opts = job
        small = "sm/" + rel if rel.startswith("sprites/") else None
        if rel in uploaded and (not small or small in uploaded):
            return rel, "cached"
        try:
            data = get(src, prefix)
            sb.upload(sb.GAME_BUCKET, rel, convert_img(data, **opts))
            if small:
                sb.upload(sb.GAME_BUCKET, small, convert_img(data, **{**opts, "max_h": SMALL_H, "quality": 88}))
            return rel, "ok"
        except Exception as e:
            return rel, f"FAIL {e}"

    # de-dup identical targets (several roles can share one emotion file)
    uniq = list({j[2]: j for j in jobs}.values())
    print(f"{len(uniq)} files to fetch")
    failed = set()
    with ThreadPoolExecutor(8) as ex:
        for i, (rel, status) in enumerate(ex.map(run, uniq), 1):
            if status.startswith("FAIL"):
                failed.add(rel)
            print(f"[{i}/{len(uniq)}] {status} {rel}", flush=True)

    manifest["backgrounds"] = [b for b in manifest["backgrounds"] if b["src"] not in failed]
    manifest["items"] = [i for i in manifest["items"] if i["icon"] not in failed]
    for c in manifest["characters"]:
        if c["portrait"] in failed:
            c["portrait"] = None
        # drop costumes whose sprites didn't download
        c["costumes"] = [o for o in c["costumes"] if not failed & set(o["sprites"].values())]
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    # also as JS so the game works when opened straight from disk
    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("window.MIKU_MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print(f"done, {len(failed)} failed")


if __name__ == "__main__":
    main()
