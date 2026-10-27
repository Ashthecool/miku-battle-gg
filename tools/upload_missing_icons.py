"""Uploads the item icons the manifest names that the public R2 bucket doesn't have (404s in the game's console),
from the local copies in game/assets/items/.
  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... py tools/upload_missing_icons.py [--dry-run]
"""
import json, os, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.join(os.path.dirname(__file__), "..", "game")
BASE = re.search(r"ASSET_BASE = '([^']+)'", open(os.path.join(ROOT, "js", "config.js"), encoding="utf8").read())[1]


def public(path):
    # r2.dev answers 403 to Python's default User-Agent
    req = urllib.request.Request(BASE + path, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        return urllib.request.urlopen(req, timeout=20).status == 200
    except urllib.error.HTTPError:
        return False


def main():
    text = open(os.path.join(ROOT, "assets", "manifest.js"), encoding="utf8").read()
    manifest = json.loads(text[text.index("{"):text.rindex("}") + 1])
    icons = sorted({i["icon"] for i in manifest["items"] if i.get("icon") and not re.match(r"https?:|local/", i["icon"])})
    with ThreadPoolExecutor(16) as ex:
        missing = [p for p, ok in zip(icons, ex.map(public, icons)) if not ok]
    print(f"{len(missing)} of {len(icons)} icons missing from the bucket")
    items, absent = [], []
    for p in missing:
        f = os.path.join(ROOT, "assets", p)
        if os.path.exists(f):
            items.append((p, open(f, "rb").read()))
        else:
            absent.append(p)
    for p in absent:
        print("no local copy:", p)
    if "--dry-run" in sys.argv or not items:
        return
    import r2_storage
    failed = r2_storage.upload_many(items)
    still = [p for p, _ in items if p not in failed and not public(p)]
    print(f"uploaded {len(items) - len(failed)}, failed {len(failed)}, still not public {len(still)}")
    sys.exit(1 if failed or still or absent else 0)


if __name__ == "__main__":
    main()
