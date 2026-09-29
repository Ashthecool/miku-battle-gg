"""Download sprites, backgrounds and item icons referenced by the miku.gg novels, resize them and upload
them to the Cloudflare R2 "game-assets" bucket, then write game/assets/manifest.{json,js}, the one merged
manifest the game reads (image paths are relative to the bucket; music is streamed by URL).

Usage:  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... py tools/fetch_assets.py [novel.json ...]   (default: every novels/*.json)
Novels already in the manifest that aren't given keep their entries, so new novels can be added on their own.
Images already in the bucket are skipped. Set MIKU_TOKEN to send the miku.gg auth token with each request.
With --local the images are written to game/assets/ instead (no key needed; point MB.ASSET_BASE at 'assets/'
to try them before uploading).
"""
import io, json, os, re, sys, glob, unicodedata, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import r2_storage as r2
from attack_emotions import pick_attack_emotion

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
    # Everythin' with Amy Lyn: an empty placeholder character
    "nothing/nothing",
    # Academia Magicka and Makin' Magic with Miku: blank outfits
    "beatrice/cg1", "beatrice/new-outfit", "ruby/cg1", "irene/new-outfit", "charlotte/new-outfit",
    "gwendolyn/new-outfit", "m-chan/new-outfit",
    # Sugar & Sweethearts: the [Transparent] outfits are empty images
    "momo/transparent", "haruka/transparent", "nico/transparent", "ryu/transparent", "finn/transparent",
    "zero/transparent", "dante/transparent", "velour/transparent", "cupid/transparent", "dani/transparent",
    "marine/transparent",
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
    "anna/covered", "amy-lyn/naked-ribbon", "amy-lyn/naughty-cat", "amy-lyn/for-the-thicc-lovers", "amy-lyn/strap-on-d",
    "maiko/succubus", "maiko/crying", "gwendolyn/spicy",
    # Cries behind Snowfall, Kumi, Nanami Hana
    "sumire/new-outfit", "kumi/naked-apron", "kumi/halloween-mummy", "nanami-hana/seggs",
    # Sugar & Sweethearts
    "momo/lewd", "momo/naked-apron", "haruka/lewd", "haruka/strapon", "nico/lewd", "nico/lingerie",
    "ryu/lewd-set", "ryu/training-lewd", "finn/lewd", "finn/training-lewd", "zero/lewd-set", "zero/pink-lingerie",
    "dante/lewd-set", "dante/lewd-apron", "velour/lewd-set", "velour/shibari", "cupid/classic-outfit",
    "cupid/lewd-outfit", "dani/lewd", "marine/lewd",
}
# novels that are NSFW as a whole: their characters, backgrounds, items and music only show in NSFW mode
NSFW_NOVELS = {"Noble One"}
# single backgrounds marked by eye: "novel title/background name", or the background's id when the novel names them
# all alike ("background-47", some of them twice)
NSFW_BACKGROUNDS = {
    "Paradiso Suburbia/CGH1",
    # Cries behind Snowfall: the bloody crime-scene CGs
    "bffc1c4e-d26d-47b6-ac94-aea6b8d30dfb", "db3cdb43-1558-4de2-8eb3-eafd11a809e2", "1df80627-0bb7-4d5f-a2ea-1c83db9c0fb3",
    "b6e7b8d8-8472-48a5-a2ac-97d0c8e1c970", "9135b340-fe2f-4c10-8735-3875df5897ac", "087b6138-6e29-4723-9351-60e03b6cf2b7",
    # Sugar & Sweethearts: the lewd CGs and the touch-minigame screens
    "1f649249-1d57-434f-9e7c-4478d046096e", "174162e5-2f30-41d0-8208-5cca49157735", "850912f5-239f-4a56-b686-4f0ea6be769e",
    "0c557fa8-73b4-4ef3-86a6-35e4baec3cbe", "eb594ddb-f612-49e1-9fff-6a9b329addab", "fa49d7af-0a05-4c50-af05-b42d234b35b2",
    "9f1fee0e-bb01-488f-8c5e-01d134d842a5", "ba21da70-8991-4303-b750-4e2a3a7dea23", "f75e1c65-8ab7-4718-b257-61277d2401df",
    "ef6a9f48-39b8-448f-aa13-981422252eb3", "b283cc46-c820-4af5-ad86-f7573e7d7b08", "9f93047d-387e-4433-916e-f96a9d5bdf7a",
    "decc2ab7-7f72-475e-89b1-7ea0f2168c39", "87cd1aed-ac83-498f-828e-10663fed474c", "6d05e925-b4ca-4fe0-bccd-a2a92a8c4ea9",
    "99c34151-c132-416b-bee7-ba6dcb089091", "5275a2ae-051f-44d5-a89f-d1db3127b425", "ac226a99-53c3-4a42-87ce-bac89a86801f",
    "e93f27f9-01ff-487f-a6bd-d1fe86b03a37", "0fc6bf48-e7df-4e88-93ce-5c43c6b23d17", "3b553537-38f9-4a79-a522-6e541a7df272",
    "8f02d151-682e-461e-882c-9bf7a1b6b2e9", "6db86622-946c-4fa3-b0ed-dfd2d90ab770", "81fb467e-3158-42ae-bac6-a09189e39d87",
    "d608e175-9d34-4bd6-ba3d-4c58630831d9", "b2d66cee-0c38-404b-b0d6-f7f6574f0a54", "85495c28-d5b4-46c2-9296-9407e02a8ad5",
    "516cf712-8044-4ca6-8da4-459c8e6f7c85", "d084b327-e8b9-4954-bf0c-6c4360987feb", "f654b2a4-6d8b-48d6-9991-36c13b4a4408",
    "a38b5b27-7f96-4ed1-9240-6bebae0993bc", "aa9b8ac4-aa64-47ef-a5f1-9d5e874f98ae", "95d0c5d8-9130-44cf-a8f6-3e7108e1dd69",
    "5fe28711-95a5-423a-8b8d-cf7d0a9e5aa1", "06aa93a2-6de4-4e98-9e0e-4d7c7d3d57cd", "dfc39eb8-1217-4abc-b80b-f06bd74db2a2",
    "c9617ac7-d61e-4588-b46f-38f886bc5ed6", "9607bbe5-76fe-4d19-b3b7-26c0abed4e0b", "a157334e-3d88-4f30-9919-3a87f9ee4400",
    "5316ba08-8cad-4c15-911f-96404065e4db", "29c41897-fc20-44ff-81db-3740db38ec9a", "a6775cc4-63e1-45d0-8455-90a78b943312",
    "bc60ed54-4528-41dc-8ca2-c38edf264785", "ca46b175-b970-4550-bdd8-e529cba43a40", "d9ba6d33-77cc-40c2-beda-db982c9100db",
    "34f7b9be-5e1c-4c3c-9550-750279dac626", "418c77c4-ff01-444b-adc3-b7f9a6d721c5", "695d166b-beea-4f4a-8d7f-07d912f6f9ab",
    "e6f40b2b-f2d2-4ff7-b2e9-539fcb6fa83f", "db5d0dbb-688a-4747-8fd4-8d555874b40a", "7e33267b-4803-4d9c-879e-c2bf72df2579",
    "75f99108-7f83-4767-9ccd-f19afaf16955", "c0910550-2603-4bbb-b16f-cfdf29b34101", "26d14e61-d149-405a-b94b-b84fb7cb71b6",
    "a13064e6-67b0-4417-8785-062c5f3274c4", "28643da7-33f0-4b1b-83a1-d566039748d1", "f9242c8b-e1e4-470c-a8d6-18a716aa2049",
    "221e1dd5-8d07-4d9f-963c-e52bf05139fd", "0f1009b1-28dc-4c07-8fc7-5cf3f5874228", "4c345cc0-4a9f-412a-b353-efec62e25a16",
    "e9f0a98b-7b0c-427b-a1fd-cc50954bf6ea", "f6e182a0-2b93-45e3-bdc6-d7c78d610a1f", "b43d3d34-6a62-485c-abbb-50e5b4ad4ff4",
    "13112133-8728-41c1-b0c5-d5a6daf4f38b", "4653e8c2-0e61-4307-9e90-6e1bfcfc45f2", "275d428b-cdf5-4848-b37c-509d179c1101",
    "f715e6fa-f15d-4d93-bab1-fadfb6b0c82c", "583d3eed-0896-4be7-919f-54216944bc80", "ebad6d04-1e58-4dfe-966e-2b49aaf7c14c",
    "f6da9eee-3c00-4dc7-a66b-6a05ddff3170", "78fa6b51-3747-4c5b-aaca-484e60c37f0a", "d14f71da-efcd-46f6-8770-f24e3ea8ddd9",
    "cfbb001f-60c5-4af0-91a8-69d083f88376", "4456c04a-843d-4136-8074-7c6bef7ea538", "cdf7861f-4368-4ca0-9eaf-a87fca72b05b",
}

# Novels with a big cast only bring their core characters (about 12): novel title -> character ids
ONLY_CHARACTERS = {
    "New Haven": {"diana", "marija", "jane", "quinta", "clara", "cheetor", "juliana", "joseph", "natalie", "aria",
                  "asuka", "saria", "doe", "juniper", "susan", "john", "louis", "bucky", "delphine", "andrew",
                  "queen", "bob", "noelle", "anya", "shenzi"},
    # without the nameless binary entity and Hil Kuntnovi
    "DUMB SUPER FANTASY RPG (1st Part Dalmavilla Kingdom and Banitas Accademy)": {
        "beatrice-avalistos", "julia-aquacrucis", "priest-pristo", "hed", "curtis-vongravis", "pepita-pazzarella",
        "mimi-hanetsu", "kuku-hanetsu", "brutio-bruscos", "brulliant-bruscos", "borcolls-carple", "flora-aquila"},
    # without the alternate-universe copies of Misaki and Arisa
    "Atarashī gakkō; Secret Garden!": {"yumi", "eri", "arisa", "misaki", "helga", "suzu", "shiina", "ai",
                                       "evil-villainess-chan", "mariko", "keiko"},
    # the families, the Reid sisters' circle, the Johnsons and two teachers (without Asher, Kayden, Julia and Jake)
    "Paradiso Suburbia": {"hunter-smith", "marie-smith", "chris", "olivia", "evelyn", "sophia", "ethan", "skylar",
                          "hime", "reina", "lucia-atkins", "peter-reeves", "kayden"},
    # the students and teachers the stories revolve around (without the explainer, the AU Irene and the side cast)
    "Academia Magicka: Entrance Ceremony [DEMO]": {"beatrice", "jeffery", "ruby", "steel", "irene", "charlotte", "thomas",
                                                   "elyssa", "gwendolyn", "howard", "hailey", "rion",
                                                   "marianne", "makoto", "nevaeh", "hubertson", "farigh-anterim", "aria", "licht"},
    # the named cast (without the nameless workers, guards and goons)
    "Cyber Delivery": {"dani", "kat-13", "stv-3", "takeda", "jet", "lamina", "seo-jin-tae", "nikita", "mel", "crash",
                       "hope", "pedro"},
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

    def outfit_sprites(outfit, folder, cid):
        emo = {e["id"]: e["sources"]["png"] for e in outfit["emotions"]}
        sprites = {}
        for role, prefs in ROLES.items():
            pick = next((p for p in prefs if p in emo), "neutral" if "neutral" in emo else next(iter(emo)))
            if role == "attack":
                pick = pick_attack_emotion(cid, emo) or pick
            rel = f"{folder}/{pick}.webp"
            sprites[role] = rel
            jobs.append((emo[pick], "1080p/", rel, dict(max_h=900)))
        return sprites

    # a character re-added from its export keeps the id it had (cards, saves and bonds use it); a new one never
    # takes an id already in use, whatever order the novels are re-added in
    taken = {ch["id"] for ch in manifest["characters"]} | set(manifest["_old_ids"].values())
    for entry in characters(novel):
        c, outfits = entry["src"], entry["outfits"]
        cid = manifest["_old_ids"].get((novel["title"], entry["name"]))
        if not cid:
            cid = slug(entry["name"])
            if cid in taken:  # same name in an earlier novel
                cid = f"{cid}-{slug(novel['title']).split('-')[0]}"
        taken.add(cid)
        outfit = outfits[0]
        sprites = outfit_sprites(outfit, f"sprites/{cid}", cid)
        # every other outfit becomes a costume (used by the wardrobe and by relationship fusions)
        seen, costumes = {slug(outfit["name"])}, []
        for o in outfits[1:]:
            if slug(o["name"]) not in seen:  # outfit names repeat now and then ("Joey 3" twice)
                seen.add(slug(o["name"]))
                costumes.append({"id": slug(o["name"]), "name": o["name"].strip(),
                                 "sprites": outfit_sprites(o, f"sprites/{cid}/{slug(o['name'])}", cid),
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
                                           or f"{novel['title']}/{b['name']}" in NSFW_BACKGROUNDS or b["id"] in NSFW_BACKGROUNDS else {})})

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
    manifest["_old_ids"] = {(c["novel"], c["name"]): c["id"] for c in old["characters"]} if old else {}
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
    del manifest["_old_ids"]
    # characters and songs an export no longer has (an older export of the novel had them) stay as they were
    if old:
        for k in ("characters", "music"):
            ids = {e["id"] for e in manifest[k]}
            manifest[k] += [e for e in old[k] if e["novel"] in given and e["id"] not in ids]

    if local:
        def store(rel, data):
            path = os.path.join(OUT, *rel.split("/"))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
        uploaded = {os.path.relpath(os.path.join(d, n), OUT).replace(os.sep, "/") for d, _, ns in os.walk(OUT) for n in ns}
    else:
        def store(rel, data):
            r2.upload(rel, data)
        uploaded = set(r2.list_objects())

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
