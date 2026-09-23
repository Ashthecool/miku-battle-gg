"""Minimal Supabase Storage client (stdlib only) shared by the asset tools.

Needs SUPABASE_SECRET_KEY in the environment (Dashboard > Project Settings > API keys, the sb_secret_... one).
Never commit that key or ship it to the browser; the game only reads public bucket URLs.
"""
import json, os, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

URL = os.environ.get("SUPABASE_URL", "https://djknvuaivmtudiecwztx.supabase.co")
GAME_BUCKET = "game-assets"   # sprites, backgrounds, items, portraits, avatar thumbnails, pack art
CARD_BUCKET = "card-images"   # original profile pictures and the common/rare/epic pack images

MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
        ".json": "application/json"}


def _key():
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not key:
        raise SystemExit("Set SUPABASE_SECRET_KEY (the sb_secret_... key) to talk to Supabase Storage.")
    return key


def _req(method, path, body=None, headers=None):
    key = _key()
    h = {"apikey": key, "Authorization": f"Bearer {key}", **(headers or {})}
    if isinstance(body, (dict, list)):
        body, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    req = urllib.request.Request(f"{URL}/storage/v1/{path}", data=body, headers=h, method=method)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
                return json.loads(data) if r.headers.get_content_type() == "application/json" else data
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:
                raise RuntimeError(f"{method} {path}: {e.code} {e.read().decode(errors='replace')}") from None
        except OSError:
            if attempt == 2:
                raise


def public_url(bucket, path):
    return f"{URL}/storage/v1/object/public/{bucket}/{path}"


def ensure_bucket(name, public=True):
    if not any(b["name"] == name for b in _req("GET", "bucket")):
        _req("POST", "bucket", {"id": name, "name": name, "public": public})


def list_objects(bucket, prefix=""):
    """Every object under prefix as {path: metadata}, recursing into folders."""
    out, offset = {}, 0
    while True:
        page = _req("POST", f"object/list/{bucket}", {"prefix": prefix, "limit": 1000, "offset": offset})
        for o in page:
            path = f"{prefix}/{o['name']}" if prefix else o["name"]
            if o.get("id") is None:  # a folder
                out.update(list_objects(bucket, path))
            else:
                out[path] = o.get("metadata") or {}
        if len(page) < 1000:
            return out
        offset += 1000


def download(bucket, path):
    return _req("GET", f"object/{bucket}/{urllib.request.quote(path)}")


def upload(bucket, path, data, cache="max-age=604800"):
    mime = MIME.get(os.path.splitext(path)[1].lower(), "application/octet-stream")
    _req("POST", f"object/{bucket}/{urllib.request.quote(path)}", data,
         {"Content-Type": mime, "x-upsert": "true", "cache-control": cache})


def remove(bucket, paths):
    _req("DELETE", f"object/{bucket}", {"prefixes": list(paths)})


def upload_many(bucket, items, workers=8):
    """items: [(path, bytes)]. Returns the paths that failed, printing progress."""
    failed = []

    def run(item):
        try:
            upload(bucket, *item)
            return item[0], None
        except Exception as e:
            return item[0], e

    with ThreadPoolExecutor(workers) as ex:
        for i, (path, err) in enumerate(ex.map(run, items), 1):
            if err:
                failed.append(path)
            print(f"[{i}/{len(items)}] {'FAIL ' + str(err) if err else 'up'} {path}", flush=True)
    return failed
