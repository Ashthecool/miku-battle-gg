"""Minimal Cloudflare R2 client (stdlib only, S3 API with SigV4) for the "game-assets" bucket the game reads.

Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the environment (Cloudflare dashboard > R2 >
Manage API tokens, an "Object Read & Write" token). Never commit them or ship them to the browser; the game only
reads the bucket's public URL (MB.ASSET_BASE). R2 has no egress fees, unlike Supabase Storage.
"""
import base64, datetime, hashlib, hmac, os, re, urllib.parse, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

BUCKET = os.environ.get("R2_BUCKET", "game-assets")
MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
        ".json": "application/json"}
NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


def _env(name):
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Set {name} (Cloudflare dashboard > R2 > Manage API tokens) to talk to R2.")
    return v


def _q(s, safe="-_.~"):
    return urllib.parse.quote(s, safe=safe)


def _sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def _authorization(method, path, qs, h, access, secret, region="auto"):
    """SigV4 Authorization header; h holds every header to sign (lowercase names, host and x-amz-date included)."""
    amz_date = h["x-amz-date"]
    signed = ";".join(sorted(h))
    canonical = "\n".join([method, path, qs, *(f"{k}:{h[k].strip()}" for k in sorted(h)), "", signed,
                           h["x-amz-content-sha256"]])
    scope = f"{amz_date[:8]}/{region}/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
    k = _sign(_sign(_sign(_sign(("AWS4" + secret).encode(), amz_date[:8]), region), "s3"), "aws4_request")
    return (f"AWS4-HMAC-SHA256 Credential={access}/{scope}, SignedHeaders={signed}, "
            f"Signature={hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()}")


def _req(method, key="", query=None, body=b"", headers=None):
    account, access, secret = _env("R2_ACCOUNT_ID"), _env("R2_ACCESS_KEY_ID"), _env("R2_SECRET_ACCESS_KEY")
    host = f"{account}.r2.cloudflarestorage.com"
    path = f"/{BUCKET}" + (f"/{_q(key, '-_.~/')}" if key else "")
    qs = "&".join(f"{_q(k)}={_q(v)}" for k, v in sorted((query or {}).items()))
    h = {"host": host, "x-amz-date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
         "x-amz-content-sha256": hashlib.sha256(body).hexdigest(), **{k.lower(): v for k, v in (headers or {}).items()}}
    h["authorization"] = _authorization(method, path, qs, h, access, secret)
    del h["host"]
    req = urllib.request.Request(f"https://{host}{path}" + (f"?{qs}" if qs else ""), data=body or None,
                                 headers=h, method=method)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:
                raise RuntimeError(f"{method} {path}?{qs}: {e.code} {e.read().decode(errors='replace')}") from None
        except OSError:
            if attempt == 2:
                raise


def _md5(body):
    return base64.b64encode(hashlib.md5(body).digest()).decode()


def list_objects(prefix=""):
    """Every object under prefix as {path: size}."""
    out, token = {}, None
    while True:
        q = {"list-type": "2", "prefix": prefix, **({"continuation-token": token} if token else {})}
        root = ET.fromstring(_req("GET", query=q))
        for c in root.iter(NS + "Contents"):
            out[c.find(NS + "Key").text] = int(c.find(NS + "Size").text)
        if root.findtext(NS + "IsTruncated") != "true":
            return out
        token = root.findtext(NS + "NextContinuationToken")


def download(path):
    return _req("GET", path)


def upload(path, data, cache="max-age=604800"):
    mime = MIME.get(os.path.splitext(path)[1].lower(), "application/octet-stream")
    _req("PUT", path, body=data, headers={"Content-Type": mime, "Cache-Control": cache})


def remove(paths):
    paths = list(paths)
    for i in range(0, len(paths), 1000):
        keys = "".join(f"<Object><Key>{_xml(p)}</Key></Object>" for p in paths[i:i + 1000])
        body = f"<Delete><Quiet>true</Quiet>{keys}</Delete>".encode()
        _req("POST", query={"delete": ""}, body=body, headers={"Content-MD5": _md5(body)})


def _xml(s):
    return re.sub(r"[&<>]", lambda m: {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[m[0]], s)


def allow_cors():
    """Let any site GET the objects with CORS: the service worker fetches them in cors mode to cache them."""
    body = (b"<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod>"
            b"<AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>86400</MaxAgeSeconds>"
            b"</CORSRule></CORSConfiguration>")
    _req("PUT", query={"cors": ""}, body=body, headers={"Content-MD5": _md5(body)})


def upload_many(items, workers=8):
    """items: [(path, bytes)]. Returns the paths that failed, printing progress."""
    failed = []

    def run(item):
        try:
            upload(*item)
            return item[0], None
        except Exception as e:
            return item[0], e

    with ThreadPoolExecutor(workers) as ex:
        for i, (path, err) in enumerate(ex.map(run, items), 1):
            if err:
                failed.append(path)
            print(f"[{i}/{len(items)}] {'FAIL ' + str(err) if err else 'up'} {path}", flush=True)
    return failed
