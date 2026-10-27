"""Build an escaped, local editorial receipt with photos and evidence links."""
import collections
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'supabase/seeds/national-20261027'
OUT = ROOT / 'docs/listing-images/national-20261027/review.html'
rows = sorted([row for file in DATA.glob('research-*.json') for row in json.loads(file.read_text())], key=lambda row: row['inputIndex'])
receipt = json.loads((DATA / 'receipt.json').read_text()) if (DATA / 'receipt.json').exists() else {}
followup = json.loads((DATA / 'second-pass-receipt.json').read_text()) if (DATA / 'second-pass-receipt.json').exists() else {}
published = {row['name']: row for row in receipt.get('places', []) + followup.get('places', [])}
location_receipt = json.loads((DATA / 'third-pass-location-receipt.json').read_text()) if (DATA / 'third-pass-location-receipt.json').exists() else {}
for location in location_receipt.get('profiles', []):
    if location['name'] in published: published[location['name']].update(location)
e = lambda value: html.escape(str(value or ''), quote=True)
counts = collections.Counter(row['status'] for row in rows)
parts = ['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New place profiles · Little Herb Places</title><style>body{font:17px/1.6 system-ui;background:#f6f3e9;color:#233d2d;max-width:1050px;margin:40px auto;padding:0 24px}h1{line-height:1.15}article{background:#fff;border:1px solid #d1d9c9;border-radius:18px;margin:24px 0;padding:24px}h2{margin:0 0 8px}a{color:#226249}.photos{display:flex;flex-wrap:wrap;gap:12px}figure{margin:12px 0;max-width:460px}img{width:100%;height:260px;object-fit:cover;border-radius:10px}figcaption,small{font-size:13px}strong{font-weight:650}.status{font-size:13px;text-transform:uppercase;letter-spacing:.08em}li{overflow-wrap:anywhere}.hold,.closed{border-left:7px solid #a56b30}</style><header><p>Little Herb Places · Editorial additions · October 27, 2026</p><h1>New place profiles and research outcomes</h1>']
parts.append('<p>' + ' · '.join(f'{e(status)}: {count}' for status, count in sorted(counts.items())) + '</p><p>Sources and photo provenance are recorded below. Uncertain or closed storefronts are held for review. The second pass added verified places and filled the photo gaps. The third pass confirms all five remaining imported map pins and refines the exclusions; current map status supersedes historical receipts. Photos were retrieved at the user’s request; source attribution is not a claim of copyright ownership or a reuse license.</p></header>')
for row in rows:
    parts.append(f'<article class="{e(row["status"])}"><p class="status">{row["inputIndex"]+1} · {e(row["status"])}</p><h2>{e(row["name"])}</h2>')
    if row.get('reason'): parts.append(f'<p><strong>{e(row["reason"])}</strong></p>')
    if row['status'] == 'ready':
        if row['name'] in published:
            live = published[row['name']]
            parts.append(f'<p><a href="{e(live["listingUrl"])}">Open published profile</a></p>')
            if live.get('geocode_status') != 'confirmed':
                parts.append('<p><strong>Map pin awaiting verification.</strong> The street address is retained; an uncertain pin is not shown.</p>')
        parts.append(f'<p>{e(row.get("tagline"))}</p><p>{e(row.get("description"))}</p><p>{e(row.get("address"))}<br>{e(row.get("city"))}, {e(row.get("state"))} {e(row.get("zip"))}<br>{e(row.get("phone"))}<br>{e(row.get("hours") or "Contact the business for current hours.")}</p>')
        parts.append('<div class="photos">')
        for photo in row.get('photoCandidates', []):
            if not photo.get('localFile'): continue
            name = pathlib.Path(photo['localFile']).name
            parts.append(f'<figure><a href="{e(name)}"><img loading="lazy" src="{e(name)}" alt="{e(photo.get("alt"))}"></a><figcaption>{e(photo.get("alt"))}<br><a href="{e(photo.get("sourcePage"))}">Photo source</a></figcaption></figure>')
        parts.append('</div>')
        if row.get('photoUnavailableReason'):
            parts.append(f'<p><strong>Photo unavailable:</strong> {e(row["photoUnavailableReason"])}</p>')
    if row.get('sources'): parts.append('<details><summary>Research sources</summary><ul>' + ''.join(f'<li><a href="{e(url)}">{e(url)}</a></li>' for url in row['sources']) + '</ul></details>')
    parts.append('</article>')
parts.append('</html>')
OUT.write_text(''.join(parts))
print(f'{len(rows)} outcomes; {dict(counts)}; {OUT}')
