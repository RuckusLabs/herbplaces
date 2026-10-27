from pathlib import Path
import json,html,collections
R=Path(__file__).resolve().parent.parent;D=R/'supabase/seeds/national-expansion-20261027';O=R/'docs/listing-images/national-expansion-20261027';e=lambda s:html.escape(str(s or ''),quote=True)
rows=[r for f in sorted(D.glob('research-*.json')) for r in json.loads(f.read_text())];held=json.loads((D/'excluded.json').read_text());receipt=json.loads((D/'receipt.json').read_text()) if (D/'receipt.json').exists() else {};followup=json.loads((D/'second-pass-receipt.json').read_text()) if (D/'second-pass-receipt.json').exists() else {};published={r['name']:r for r in receipt.get('places',[])+followup.get('places',[])}
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>National expansion · Little Herb Places</title><style>body{font:16px/1.6 system-ui;background:#f6f3e9;color:#233d2d;max-width:1100px;margin:40px auto;padding:0 24px}article{background:white;border:1px solid #ccd6ca;border-radius:16px;margin:22px 0;padding:24px}h1,h2{line-height:1.2}img{max-width:100%;height:230px;object-fit:contain}.photos{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;max-width:450px}figcaption,small{font-size:13px}a{color:#226249}li{overflow-wrap:anywhere}</style><h1>National directory expansion</h1>']
parts.append(f'<p>{len(rows)} verified new places · {len(set(r["state"] for r in rows))} states in this batch · {sum(bool(r["photoCandidates"]) for r in rows)} profiles photographed · {sum(len(r["photoCandidates"]) for r in rows)} selected photos</p><p>Checked October 27, 2026. Current operator visitor addresses are retained. Public map points use exact Census street/address matches or separately documented government records. Shared-brand product photos are labeled as products, not branch interiors. Photos are retrieved at the user’s request; source attribution does not establish a reuse license.</p>')
for r in rows:
 parts.append(f'<article><h2>{e(r["name"])}</h2><p>{e(r["tagline"])}</p>')
 if r['name'] in published:parts.append(f'<p><a href="{e(published[r["name"]]["listingUrl"])}">Published profile</a></p>')
 parts.append(''.join(f'<p>{e(p)}</p>' for p in r['description'].split('\n\n')))
 parts.append(f'<p>{e(r["address"])}<br>{e(r["city"])}, {e(r["state"])} {e(r["zip"])}<br>{e(r["phone"])}<br>{e(r["hours"] or "Contact the shop for current hours.")}</p><small>{e(r.get("verificationNote"))}</small><div class="photos">')
 for p in r['photoCandidates']:parts.append(f'<figure><img loading="lazy" src="{e(Path(p["localFile"]).name)}" alt="{e(p["alt"])}"><figcaption>{e(p["alt"])} · <a href="{e(p["sourcePage"])}">Photo source</a></figcaption></figure>')
 parts.append('</div>')
 if not r['photoCandidates']:parts.append(f'<p><strong>No photo:</strong> {e(r.get("photoUnavailableReason"))}</p>')
 parts.append('<details><summary>Sources</summary><ul>'+''.join(f'<li><a href="{e(u)}">{e(u)}</a></li>' for u in r['sources'])+'</ul></details></article>')
parts.append('<h2>Excluded or held leads</h2>')
for r in held:parts.append(f'<article><h3>{e(r.get("name"))}</h3><p>{e(r.get("reason") or r.get("verificationNote"))}</p><ul>'+''.join(f'<li><a href="{e(u)}">{e(u)}</a></li>' for u in r.get('sources',[]))+'</ul></article>')
parts.append('</html>');(O/'review.html').write_text(''.join(parts))
print('Built local profile review.')
