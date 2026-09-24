"""Condense the novels into a design brief: everything needed to write their cards, powers, relationships and
story chapter, and nothing else. Reads game/assets/manifest.json (run tools/fetch_assets.py first, so the ids,
costumes, songs and backgrounds match the game) plus the novel exports in novels/ for the character write-ups.

Usage:  py tools/novel_brief.py [--all] [title ...] > brief.md
By default only novels with characters that have no card in game/js/data.js yet are included.
"""
import glob, json, os, re, sys
from fetch_assets import characters, load_novel, slug

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESC_CHARS = 700  # how much of each character's write-up to keep


def clean(text):
    text = re.sub(r"\{\{(user|char)\}\}", lambda m: "you" if m.group(1) == "user" else "they", text)
    return re.sub(r"\s+", " ", text).strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    manifest = json.load(open(os.path.join(ROOT, "game", "assets", "manifest.json"), encoding="utf-8"))
    data_js = open(os.path.join(ROOT, "game", "js", "data.js"), encoding="utf-8").read()
    has_card = lambda cid: re.search(rf"^\s*'{re.escape(cid)}'\s*:", data_js, re.M)
    novels = {}
    for p in glob.glob(os.path.join(ROOT, "novels", "*.json")):
        n = load_novel(p)
        novels[n["title"]] = n

    out = []
    for title in manifest["novels"]:
        chars = [c for c in manifest["characters"] if c["novel"] == title]
        if args and not any(a.lower() in title.lower() for a in args):
            continue
        if not args and "--all" not in sys.argv and all(has_card(c["id"]) for c in chars):
            continue
        novel = novels.get(title)
        src = {slug(e["name"]): e["src"] for e in characters(novel)} if novel else {}
        names = [c["name"].split()[0] for c in chars]
        out.append(f"# {title}\n")
        if novel:
            out.append(clean(novel.get("description", ""))[:600] + "\n")
        out.append(f"## Characters ({len(chars)})\n")
        for c in chars:
            s = src.get(slug(c["name"]))
            desc = clean(s["card"]["data"].get("description", "")) if s else ""
            mentions = sorted({n for n in names if n != c["name"].split()[0] and re.search(rf"\b{re.escape(n)}\b", desc)})
            done = " (HAS CARD)" if has_card(c["id"]) else ""
            out.append(f"### `{c['id']}` {c['name']}{done}")
            out.append(f"- short: {c['short']}")
            if c["traits"]:
                out.append(f"- traits: {', '.join(c['traits'])}")
            out.append(f"- outfit: {c['outfit']}; costumes: {', '.join(o['id'] for o in c['costumes']) or 'none'}")
            if mentions:
                out.append(f"- mentions: {', '.join(mentions)}")
            out.append(f"- about: {desc[:DESC_CHARS]}{'...' if len(desc) > DESC_CHARS else ''}\n")
        items = [i for i in manifest["items"] if novel and any(slug(x["name"]) == i["id"] for x in (novel.get("inventory") or []))]
        if items:
            out.append("## Items\n")
            out += [f"- `{i['id']}` {i['name']}: {clean(i['desc'])[:200]}" for i in items]
            out.append("")
        if novel:
            bg_ids = {b["id"] for b in novel.get("backgrounds") or []}
            bgs = [b for b in manifest["backgrounds"] if b["id"] in bg_ids]
            out.append("## Backgrounds (story `bg` is the name)\n")
            out.append("; ".join(f"{b['name']}" for b in bgs) + "\n")
        songs = [m for m in manifest["music"] if m["novel"] == title]
        out.append("## Music (story `music` is the id)\n")
        out.append("; ".join(f"`{m['id']}` ({', '.join(m['tags'][:3])})" for m in songs) + "\n")
    sys.stdout.reconfigure(encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
