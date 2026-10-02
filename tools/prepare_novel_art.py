"""Stage new-novel artwork without changing cards, animations, or the live manifest.

Run normally to download; use --upload once R2 credentials are available.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

import fetch_assets as f
import r2_storage as r2

ROOT = Path(f.ROOT)
OUT = ROOT / 'output' / 'new-novel-art'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upload', action='store_true')
    args = parser.parse_args()
    old = json.loads((ROOT / 'game/assets/manifest.json').read_text(encoding='utf-8'))
    manifest = {k: [] for k in ('novels', 'nsfwNovels', 'characters', 'backgrounds', 'items', 'music')}
    # Reserve established IDs without including existing entries in the staged inventory.
    manifest['_old_ids'] = {(c['novel'], c['name']): c['id'] for c in old['characters']}
    jobs = []
    for path in sorted((ROOT / 'novels').glob('*.json')):
        novel = f.load_novel(path)
        if novel['title'] in old['novels']:
            continue
        manifest['novels'].append(novel['title'])
        jobs.extend(f.add_novel(novel, manifest))
    del manifest['_old_ids']
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'source-inventory.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    jobs = list({j[2]: j for j in jobs}.values())

    def download(job):
        src, prefix, rel, opts = job
        targets = [(rel, opts)]
        if rel.startswith('sprites/'):
            targets.append(('sm/' + rel, {**opts, 'max_h': f.SMALL_H, 'quality': 88}))
        try:
            missing = [(p, o) for p, o in targets if not (OUT / p).exists()]
            if missing:
                data = f.get(src, prefix)
                for p, o in missing:
                    dest = OUT / p
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(f.convert_img(data, **o))
            return {'key': rel, 'status': 'ready'}
        except Exception as exc:
            return {'key': rel, 'status': 'failed', 'error': str(exc)}

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        results = []
        for i, result in enumerate(pool.map(download, jobs), 1):
            results.append(result)
            print(f"[{i}/{len(jobs)}] {result['status']} {result['key']}", flush=True)
    (OUT / 'download-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    if args.upload:
        # Read/write only missing objects; never overwrite established bucket artwork.
        have = r2.list_objects()
        base = 'https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/'
        files = sorted(p for p in OUT.rglob('*') if p.suffix.lower() in ('.webp', '.png'))
        report = []
        for p in files:
            key = p.relative_to(OUT).as_posix()
            data = p.read_bytes()
            if key not in have:
                r2.upload(key, data)
                status = 'uploaded'
            else:
                status = 'existing'
            remote = r2.download(key)
            if hashlib.sha256(remote).digest() != hashlib.sha256(data).digest():
                raise RuntimeError(f'Existing object differs; left untouched: {key}')
            with urllib.request.urlopen(urllib.request.Request(base + key, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as response:  # r2.dev refuses urllib's default agent
                if response.status != 200:
                    raise RuntimeError(f'Public URL unavailable: {key}')
            report.append({'key': key, 'status': status, 'url': base + key, 'bytes': len(data)})
            (OUT / 'upload-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(f'{status}, verified {key}', flush=True)
    failed = [r for r in results if r['status'] == 'failed']
    print(f"{len(manifest['novels'])} novels; {len(manifest['characters'])} characters; {len(failed)} failures")
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
