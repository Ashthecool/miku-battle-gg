"""One-off: copy every image in the Supabase "game-assets" bucket to the R2 bucket of the same name and let
browsers fetch it with CORS. Objects already in R2 with the same size are skipped, so it can be run again.

Usage:  SUPABASE_SECRET_KEY=sb_secret_... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
        py tools/migrate_to_r2.py
Then point MB.ASSET_BASE in game/js/config.js at the R2 bucket's public URL.
"""
from concurrent.futures import ThreadPoolExecutor
import supabase_storage as sb
import r2_storage as r2


def main():
    r2.allow_cors()
    src = sb.list_objects(sb.GAME_BUCKET)
    have = r2.list_objects()
    todo = sorted(p for p, meta in src.items() if have.get(p) != meta.get("size"))
    print(f"{len(src)} objects in Supabase, {len(src) - len(todo)} already in R2, {len(todo)} to copy", flush=True)

    def copy(path):
        try:
            r2.upload(path, sb.download(sb.GAME_BUCKET, path))
            return path, None
        except Exception as e:
            return path, e

    failed = []
    with ThreadPoolExecutor(8) as ex:
        for i, (path, err) in enumerate(ex.map(copy, todo), 1):
            if err:
                failed.append(path)
            print(f"[{i}/{len(todo)}] {'FAIL ' + str(err) if err else 'copied'} {path}", flush=True)
    if failed:
        raise SystemExit(f"{len(failed)} copies failed; run it again to retry them")


if __name__ == "__main__":
    main()
