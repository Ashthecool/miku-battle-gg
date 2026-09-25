"""Download sprites, backgrounds and item icons referenced by the miku.gg novels, resize them and upload
them to the Supabase "game-assets" bucket, then write game/assets/manifest.{json,js}, the one merged
manifest the game reads (image paths are relative to the bucket; music is streamed by URL).

Usage:  SUPABASE_SECRET_KEY=sb_secret_... py tools/fetch_assets.py [novel.json ...]   (default: every novels/*.json)
Novels already in the manifest that aren't given keep their entries, so new novels can be added on their own.
Images already in the bucket are skipped. Set MIKU_TOKEN to send the miku.gg auth token with each request.
With --local the images are written to game/assets/ instead (no key needed; point MB.ASSET_BASE at 'assets/'
to try them before uploading).
"""
import io, json, os, re, sys, glob, unicodedata, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import supabase_storage as sb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "game", "assets")
ASSET_DB = "https://assets.miku.services"
ASSET_DB_OPT = "https://mikugg-assets.nyc3.cdn.digitaloceanspaces.com"
TOKEN = os.environ.get("MIKU_TOKEN", "")
SMALL_H = 450  # height of the sm/ sprite copies (MB.spriteSrc in game/js/config.js)
# characters that never appear on screen, and outfits kept out of the game (CG outfits are scene art, not
# standing sprites). Characters without any description are unfinished placeholders ("char1") and are skipped too.
SKIP_CHARACTERS = {"narrator", "narrador"}
SKIP_OUTFIT = re.compile(r"\bcg\b", re.I)
# blank or placeholder art: "character-id/outfit-id"
SKIP_OUTFITS = {
    "misaki/new-outfit", "misaki-au/new-outfit", "haruka-hijikata/new-outfit",
    "beatrice-avalistos/new-outfit", "curtis-vongravis/new-outfit", "flora-aquila/new-outfit",
    # Doki Doki Literature Club: the [Transparent] outfits are empty images; Flaming, Lust, and Pain: the spoiler character too
    "monika/christmas-outfit-transparent", "monika/fancy-dress-date-outfit-transparent",
    "monika/school-uniform-transparent", "monika/storm-blaze-casual-outfit-transparent",
    "natsuki/christmas-outfit-transparent", "natsuki/making-cupcakes-casual-outfit-transparent",
    "natsuki/school-uniform-transparent", "sayori/christmas-outfit-transparent",
    "sayori/lazy-dayz-casual-outfit-transparent", "sayori/picnicking-date-outfit-transparent",
    "sayori/school-uniform-transparent", "yuri/christmas-outfit-transparent",
    "yuri/comfy-sweater-casual-outfit-transparent", "yuri/gurogurl-date-outfit-transparent",
    "yuri/school-uniform-transparent", "spoiler-character/default",
    # nude art that looks underage: never in the game, not even in NSFW mode
    "natsuki/nude",
}

# NSFW content is downloaded too but tagged `nsfw: true` in the manifest; the game only shows it in NSFW mode
# (js/content.js). An outfit is NSFW when the export flags it (outfit.nsfw = 1), its name says so, it comes with
# adult-only emotions, or it was marked by eye (tools/outfit_sheets.py) because the export's flag missed it.
NSFW_NAME = re.compile(r"\b(nude|topless|naked|nsfw|sex|masturbat\w*|dildo|penetration|tentacles?)\b", re.I)
ADULT_EMOTIONS = {"arousal", "ecstasy", "release", "submission", "humiliation"}
NSFW_OUTFITS = {
    # underwear, towels and the like
    "quinta/quinta-5", "doe/doe-3", "cheetor/cheetor-4", "jill/jill-2", "maria/maria-2", "quistis/quistis-4",
    "rirarra-charca/the-equality-beach",
    "anya/anya-2", "cream/cream-2", "juniper/juniper-5", "adam/adam-4", "alexis/alexis-4", "misaki/morning",
    "anna-vinelace/new-outfit", "charlotte/cat-outfit", "lily/default", "nerida/default", "kira/default",
}
# novels that are NSFW as a whole: their characters, backgrounds, items and music only show in NSFW mode
NSFW_NOVELS = {"Noble One"}
# single backgrounds marked by eye: "novel title/background name"
NSFW_BACKGROUNDS = {"Paradiso Suburbia/CGH1"}

# Novels with a big cast only bring their core characters (about 12): novel title -> character ids
ONLY_CHARACTERS = {
    "New Haven": {"diana", "marija", "jane", "quinta", "clara", "cheetor", "juliana", "joseph", "natalie", "aria",
                  "asuka", "saria", "doe", "juniper", "susan", "john", "louis", "bucky", "delphine", "andrew"},
    # without the nameless binary entity and Hil Kuntnovi
    "DUMB SUPER FANTASY RPG (1st Part Dalmavilla Kingdom and Banitas Accademy)": {
        "beatrice-avalistos", "julia-aquacrucis", "priest-pristo", "hed", "curtis-vongravis", "pepita-pazzarella",
        "mimi-hanetsu", "kuku-hanetsu", "brutio-bruscos", "brulliant-bruscos", "borcolls-carple", "flora-aquila"},
    # without the alternate-universe copies of Misaki and Arisa
    "Atarashī gakkō; Secret Garden!": {"yumi", "eri", "arisa", "misaki", "helga", "suzu", "shiina", "ai",
                                       "evil-villainess-chan", "mariko", "keiko"},
    # the families, the Reid sisters' circle, the Johnsons and two teachers (without Asher, Kayden, Julia and Jake)
    "Paradiso Suburbia": {"hunter-smith", "marie-smith", "chris", "olivia", "evelyn", "sophia", "ethan", "skylar",
                          "hime", "reina", "lucia-atkins", "peter-reeves"},
}

# Emotions the battle system uses; first match per role wins.
ROLES = {
    "idle":   ["neutral"],
    "play":   ["happy", "excited", "confident"],
    "attack": ["angry", "rage", "frustrated", "intensity"],
    "special":["rage", "angry", "intensity"],
    "hurt":   ["scared", "shocked", "surprised", "worried"],
    "lose":   ["sad", "disappointed", "worried"],
    "win":    ["excited", "proud", "happy", "confident"],
    "taunt":  ["proud", "amused", "teasing", "confident", "happy"],
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
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()  # Laròne -> larone
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


def load_novel(path):
    """A miku.gg export: history files wrap the novel in {"novel": ...}, .novel files are the novel itself."""
    data = json.load(open(path, encoding="utf-8"))
    return data.get("novel", data)


def is_nsfw(c, o):
    return bool(o.get("nsfw")) or bool(NSFW_NAME.search(o["name"])) or bool(ADULT_EMOTIONS & {e["id"] for e in o["emotions"]}) \
        or f"{slug(c['name'])}/{slug(o['name'])}" in NSFW_OUTFITS


def outfits_of(c):
    """A character's usable outfits, safe ones first (the first is their usual look); each gets `_nsfw`."""
    out = [dict(o, _nsfw=is_nsfw(c, o)) for o in c["card"]["data"]["extensions"]["mikugg_v2"]["outfits"]
           if o["emotions"] and not SKIP_OUTFIT.search(o["name"]) and f"{slug(c['name'])}/{slug(o['name'])}" not in SKIP_OUTFITS]
    return sorted(out, key=lambda o: o["_nsfw"])


def characters(novel):
    """The playable characters of a novel: skips narrators and placeholders, and merges characters that share a
    name (the same person from another route/universe) into the one with the most outfits."""
    out = {}
    for c in novel["characters"]:
        name = c["name"].strip()
        name = name[:1].upper() + name[1:]  # "sakura Tooyama"
        if not name or name.lower() in SKIP_CHARACTERS or not c["card"]["data"].get("description", "").strip() or not outfits_of(c):
            continue
        key = slug(name)
        if key not in out:
            out[key] = {"name": name, "src": c, "outfits": outfits_of(c)}
            continue
        prev = out[key]
        if len(outfits_of(c)) > len(prev["outfits"]):
            prev["src"], prev["outfits"], extra = c, outfits_of(c), prev["outfits"]
        else:
            extra = outfits_of(c)
        names = {slug(o["name"]) for o in prev["outfits"]}
        prev["outfits"] = sorted(prev["outfits"] + [o for o in extra if slug(o["name"]) not in names], key=lambda o: o["_nsfw"])
    only = ONLY_CHARACTERS.get(novel["title"])
    return [e for k, e in out.items() if not only or k in only]


def add_novel(novel, manifest):
    """Queue downloads for one novel and append its entries to the manifest."""
    jobs = []
    novel_nsfw = novel["title"] in NSFW_NOVELS

    def outfit_sprites(outfit, folder):
        emo = {e["id"]: e["sources"]["png"] for e in outfit["emotions"]}
        sprites = {}
        for role, prefs in ROLES.items():
            pick = next((p for p in prefs if p in emo), "neutral" if "neutral" in emo else next(iter(emo)))
            rel = f"{folder}/{pick}.webp"
            sprites[role] = rel
            jobs.append((emo[pick], "1080p/", rel, dict(max_h=900)))
        return sprites

    taken = {ch["id"] for ch in manifest["characters"]}
    for entry in characters(novel):
        c, outfits = entry["src"], entry["outfits"]
        cid = slug(entry["name"])
        if cid in taken:  # same name in an earlier novel
            cid = f"{cid}-{slug(novel['title']).split('-')[0]}"
        taken.add(cid)
        outfit = outfits[0]
        sprites = outfit_sprites(outfit, f"sprites/{cid}")
        # every other outfit becomes a costume (used by the wardrobe and by relationship fusions)
        seen, costumes = {slug(outfit["name"])}, []
        for o in outfits[1:]:
            if slug(o["name"]) not in seen:  # outfit names repeat now and then ("Joey 3" twice)
                seen.add(slug(o["name"]))
                costumes.append({"id": slug(o["name"]), "name": o["name"].strip(),
                                 "sprites": outfit_sprites(o, f"sprites/{cid}/{slug(o['name'])}"),
                                 **({"nsfw": True} if o["_nsfw"] else {})})
        portrait = None
        if c.get("profile_pic") and c["profile_pic"] != "empty_char.png":
            portrait = f"portraits/{cid}.webp"
            jobs.append((c["profile_pic"], "256p/", portrait, dict(max_w=400, max_h=560)))
        desc = c["card"]["data"].get("description", "")
        m = re.search(r"Personality:\s*\[?([^\]\n{}]+)", desc)
        manifest["characters"].append({
            "id": cid, "name": entry["name"], "outfit": outfit["name"],
            "short": (c.get("short_description") or "").replace("{{user}}", "you"),
            "traits": [t for t in (x.strip(' ".,') for x in m.group(1).split(",")) if t and len(t.split()) <= 3][:8] if m else [],
            "sprites": sprites, "costumes": costumes, "portrait": portrait, "novel": novel["title"],
            # an NSFW novel, or no safe outfit at all: the whole character is NSFW
            **({"nsfw": True} if novel_nsfw or outfit["_nsfw"] else {})})

    for b in novel.get("backgrounds") or []:
        src = b["source"].get("jpg")
        if not src:
            continue
        rel = f"backgrounds/{slug(b['name'])}-{b['id'][:6]}.webp"
        jobs.append((src, "1080p/", rel, dict(max_w=1600, fmt="WEBP", quality=80)))
        manifest["backgrounds"].append({"id": b["id"], "name": b["name"].replace("{{user}}", "Your"),
                                        "desc": b["description"], "src": rel,
                                        **({"nsfw": True} if novel_nsfw or NSFW_NAME.search(b["name"])
                                           or f"{novel['title']}/{b['name']}" in NSFW_BACKGROUNDS else {})})

    for it in novel.get("inventory") or []:
        if any(i["id"] == slug(it["name"]) for i in manifest["items"]):
            continue
        rel = f"items/{slug(it['name'])}.webp"
        jobs.append((it["icon"], "256p/", rel, dict(max_w=256, max_h=256)))
        manifest["items"].append({"id": slug(it["name"]), "name": it["name"].strip(),
                                  "desc": it["description"], "icon": rel, **({"nsfw": True} if novel_nsfw else {})})

    # music is streamed straight from the miku.gg CDN by the game, not downloaded
    for s in novel.get("songs") or []:
        sid, n = slug(s["name"]), 2
        while any(m["id"] == sid for m in manifest["music"]):  # same song name in two novels
            sid, n = f"{slug(s['name'])}-{n}", n + 1
        manifest["music"].append({"id": sid, "name": s["name"], "tags": s["tags"], "novel": novel["title"],
                                   "url": urls(s["source"], "")[0],
                                   **({"nsfw": True} if novel_nsfw or NSFW_NAME.search(s["name"]) else {})})
    return jobs


def main():
    local = "--local" in sys.argv
    paths = [a for a in sys.argv[1:] if a != "--local"] or sorted(glob.glob(os.path.join(ROOT, "novels", "*.json")))
    jobs, manifest = [], {"title": "Miku Battle", "novels": [], "nsfwNovels": [], "characters": [], "backgrounds": [],
                          "items": [], "music": []}
    # novels already in the manifest whose export isn't given keep their entries as they are (their exports may
    # live elsewhere); backgrounds and items don't say their novel, so the old ones stay and new ones replace by id
    novels = [load_novel(p) for p in paths]
    given = {n["title"] for n in novels}
    try:
        old = json.load(open(os.path.join(OUT, "manifest.json"), encoding="utf-8"))
    except FileNotFoundError:
        old = None
    if old:
        manifest["novels"] = [t for t in old["novels"] if t not in given]
        manifest["nsfwNovels"] = [t for t in old["nsfwNovels"] if t not in given]
        for k in ("characters", "music"):
            manifest[k] = [e for e in old[k] if e["novel"] not in given]
        manifest["backgrounds"], manifest["items"] = old["backgrounds"], old["items"]
    for novel in novels:
        manifest["backgrounds"] = [b for b in manifest["backgrounds"]
                                   if b["id"] not in {x["id"] for x in novel.get("backgrounds") or []}]
        manifest["novels"].append(novel["title"])
        if novel["title"] in NSFW_NOVELS:
            manifest["nsfwNovels"].append(novel["title"])
        jobs += add_novel(novel, manifest)

    if local:
        def store(rel, data):
            path = os.path.join(OUT, *rel.split("/"))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
        uploaded = {os.path.relpath(os.path.join(d, n), OUT).replace(os.sep, "/") for d, _, ns in os.walk(OUT) for n in ns}
    else:
        def store(rel, data):
            sb.upload(sb.GAME_BUCKET, rel, data)
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
            store(rel, convert_img(data, **opts))
            if small:
                store(small, convert_img(data, **{**opts, "max_h": SMALL_H, "quality": 88}))
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
        # a usual-outfit emotion that didn't download stands in with one that did
        ok = [p for p in c["sprites"].values() if p not in failed]
        if ok:
            c["sprites"] = {role: (p if p not in failed else c["sprites"]["idle"] if c["sprites"]["idle"] not in failed else ok[0])
                            for role, p in c["sprites"].items()}
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
