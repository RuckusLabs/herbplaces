"""Resolve researched storefront addresses against the US Census address service.
Unmatched/ambiguous addresses remain for review; never substitute city centroids.
"""
import concurrent.futures
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIRECTORY = ROOT / 'supabase/seeds/national-expansion-20261027'
DESTINATION = DIRECTORY / 'geocodes.json'
existing = json.loads(DESTINATION.read_text()) if DESTINATION.exists() else {}
rows = [row for file in sorted(DIRECTORY.glob('research-*.json')) for row in json.loads(file.read_text()) if row['status'] == 'ready']

def resolve(row):
    key = row['name']
    street = re.split(r',?\s+(?:Suite|Ste\.?|Unit|inside)\b', row['address'], flags=re.I)[0]
    address = f"{street}, {row['city']}, {row['state']} {row['zip']}"
    if existing.get(key, {}).get('query') == address:
        return key, existing[key]
    endpoint = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?'
    url = endpoint + urllib.parse.urlencode({'address': address, 'benchmark': 'Public_AR_Current', 'format': 'json'})
    result = {'query': address, 'source': url}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'LittleHerbPlaces editorial address verification'})
        with urllib.request.urlopen(request, timeout=55) as response:
            matches = json.load(response)['result']['addressMatches']
        result['matches'] = matches
    except Exception as error:
        result['error'] = str(error)
    return key, result

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    for key, result in executor.map(resolve, rows):
        existing[key] = result
        print(key, result['query'], len(result.get('matches', [])), result.get('error', ''))
        DESTINATION.write_text(json.dumps(existing, indent=2) + '\n')
