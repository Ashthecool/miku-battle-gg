"""Update signature-attack sprites without reimporting unrelated game assets.

py tools/sync_attack_emotions.py [--upload] [--source-dir PATH ...]
Defaults to novels/. Preview reports choices without changing the manifest. --upload
uploads missing 900px/450px images to R2, verifies every chosen public URL, and only
then writes both manifests. Credentials are read by r2_storage from the environment.
Characters whose exports are unavailable use only their already-imported artwork.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import time
import urllib.request

import fetch_assets as assets
from attack_emotions import CHOICES, pick_attack_emotion


def load_sources(directories):
    sources = {}
    for directory in directories:
        for path in sorted(Path(directory).glob('*.json')):
            try:
                data = json.loads(path.read_text(encoding='utf-8'))
                if not isinstance(data, dict):
                    continue
                novel = data.get('novel', data)
                if not isinstance(novel, dict) or 'characters' not in novel or 'title' not in novel:
                    continue
                # The manifest, not the bulk-import cast limit, determines this update's scope.
                limit = assets.ONLY_CHARACTERS.pop(novel['title'], None)
                try:
                    for entry in assets.characters(novel):
                        sources[novel['title'], entry['name']] = entry
                finally:
                    if limit is not None:
                        assets.ONLY_CHARACTERS[novel['title']] = limit
            except (KeyError, TypeError, ValueError):
                continue  # unrelated JSON in a supplied export directory
    return sources


def plan(manifest, sources):
    jobs, report = {}, []
    for char in manifest['characters']:
        cid = char['id']
        if cid not in CHOICES:
            raise ValueError(f'Author an attack expression for {cid} in tools/attack_emotions.py')
        source = sources.get((char['novel'], char['name']))
        for outfit in [char, *char['costumes']]:
            name = char['outfit'] if outfit is char else outfit['name']
            original = next((o for o in source['outfits'] if o['name'].strip() == name.strip()), None) if source else None
            sprites = outfit['sprites']
            available = {Path(p).stem: p for p in sprites.values()}
            if original:
                available = {e['id']: e['sources']['png'] for e in original['emotions']}
            emotion = pick_attack_emotion(cid, available) or Path(sprites['attack']).stem
            previous = sprites['attack']
            if original:
                folder = previous.rsplit('/', 1)[0].removeprefix('local/')
                selected = f'{folder}/{emotion}.webp'
                jobs[selected] = available[emotion]
            else:
                selected = available[emotion]
            sprites['attack'] = selected
            report.append({'id': cid, 'outfit': name, 'requested': CHOICES[cid], 'emotion': emotion,
                           'path': selected, 'previous': previous, 'sourceAvailable': bool(original)})
    return jobs, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upload', action='store_true')
    parser.add_argument('--source-dir', action='append')
    args = parser.parse_args()
    root = Path(assets.ROOT)
    manifest_path = root / 'game/assets/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    jobs, report = plan(manifest, load_sources(args.source_dir or [root / 'novels']))
    report_path = root / 'game/assets/attack-emotion-report.json'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Reviewed {len(manifest['characters'])} characters / {len(report)} outfits; "
          f"{sum(r['path'] != r['previous'] for r in report)} expression changes.", flush=True)
    print(f'Preview: {report_path}', flush=True)
    if not args.upload:
        return
    existing = assets.r2.list_objects('sprites/') | assets.r2.list_objects('sm/sprites/')
    pending = [(path, src) for path, src in jobs.items() if path not in existing or 'sm/' + path not in existing]

    def upload(job):
        path, src = job
        data = assets.get(src, '1080p/')
        count = 0
        for key, height, quality in [(path, 900, 86), ('sm/' + path, 450, 88)]:
            if key not in existing:
                assets.r2.upload(key, assets.convert_img(data, max_h=height, quality=quality))
                count += 1
        return count

    uploaded = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, count in enumerate(pool.map(upload, pending), 1):
            uploaded += count
            print(f'Prepared {i}/{len(pending)} expressions ({uploaded} uploaded objects)', flush=True)
    config = (root / 'game/js/config.js').read_text(encoding='utf-8')
    base = re.search(r"MB.ASSET_BASE = '([^']+)'", config)[1]
    keys = sorted({prefix + r['path'] for r in report for prefix in ['', 'sm/']})

    def verify(key):
        req = urllib.request.Request(base + key, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    if response.status != 200 or response.headers.get_content_type() != 'image/webp' or int(response.headers.get('Content-Length', 0)) <= 0:
                        raise ValueError(f'Invalid public sprite: {key}')
                return
            except OSError as error:
                if attempt == 4:
                    raise RuntimeError(f'Public sprite verification failed: {key}: {error}') from None
                time.sleep(2 ** (attempt + 1))
        

    # The public r2.dev endpoint is rate limited; do not hammer it during verification.
    with ThreadPoolExecutor(max_workers=2) as pool:
        for i, _ in enumerate(pool.map(verify, keys), 1):
            if i % 100 == 0:
                print(f'Public URLs verified: {i}/{len(keys)}', flush=True)
    manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding='utf-8')
    (manifest_path.with_suffix('.js')).write_text('window.MIKU_MANIFEST = ' + json.dumps(manifest, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'Done: {uploaded} new R2 objects; {len(keys)} public URLs verified; both manifests updated.', flush=True)


if __name__ == '__main__':
    main()
