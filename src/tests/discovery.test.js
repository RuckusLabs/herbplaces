import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceLoader } from '../utilities/placeCache.js';
import { filterPlaces } from '../utilities/placeFilters.js';

const storage = initial => {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
};
const rows = [{ id: 1, name: 'Moss Apothecary', city: 'Denver', state: 'CO', tagline: 'Herbal teas and workshops' }, { id: 2, name: 'Sage Garden', city: null, state: 'NM', description: 'A garden and nursery' }];

test('search matches multiple words across fields regardless of case', () => { assert.deepEqual(filterPlaces(rows, 'DENVER tea').map(p => p.id), [1]); });
test('categories match relevant descriptions, with query applied together', () => { assert.equal(filterPlaces(rows, '', 'gardens')[0].id, 2); assert.equal(filterPlaces(rows, 'Denver', 'gardens').length, 0); assert.equal(filterPlaces(rows, '', 'workshops')[0].id, 1); });
test('blank and unknown categories preserve all places and tolerate missing fields', () => { assert.equal(filterPlaces(rows, '  ', 'unknown').length, 2); });
test('valid persisted cache avoids a request', async () => { const loader = createPlaceLoader({ request: () => { throw new Error('Unexpected request'); }, getStorage: () => storage(JSON.stringify({ data: rows, timestamp: 100 })), now: () => 150 }); assert.deepEqual(await loader(), rows); });
test('corrupt cache is replaced and nullable cities sort safely', async () => { const store = storage('{broken'); const loader = createPlaceLoader({ request: async () => rows, getStorage: () => store }); assert.deepEqual((await loader()).map(p => p.id), [2, 1]); assert.equal(JSON.parse(store.getItem()).data.length, 2); });
test('blocked storage does not prevent requests or memory caching', async () => { let requests = 0; const loader = createPlaceLoader({ request: async () => { requests++; return rows; }, getStorage: () => { throw new Error('SecurityError'); } }); await loader(); await loader(); assert.equal(requests, 1); });
test('concurrent consumers share one pending request', async () => { let requests = 0; let finish; const loader = createPlaceLoader({ request: () => { requests++; return new Promise(resolve => { finish = resolve; }); }, getStorage: () => storage(null) }); const a = loader(); const b = loader(); finish(rows); assert.deepEqual(await a, await b); assert.equal(requests, 1); });
test('expired and future cache entries are rejected', async () => { for (const timestamp of [0, 101]) { let requests = 0; const loader = createPlaceLoader({ request: async () => { requests++; return rows; }, getStorage: () => storage(JSON.stringify({ data: [], timestamp })), now: () => 100, duration: 10 }); await loader(); assert.equal(requests, 1); } });
test('a rejected request can be retried', async () => { let requests = 0; const loader = createPlaceLoader({ request: async () => { if (++requests === 1) throw new Error('offline'); return rows; }, getStorage: () => storage(null) }); await assert.rejects(loader()); assert.equal((await loader()).length, 2); });
test('force refresh bypasses memory and persisted caches', async () => { let requests = 0; const loader = createPlaceLoader({ request: async () => { requests++; return rows; }, getStorage: () => storage(null) }); await loader(); await loader({ force: true }); assert.equal(requests, 2); });
test('valid JSON with malformed cached rows is ignored', async () => { const loader = createPlaceLoader({ request: async () => rows, getStorage: () => storage(JSON.stringify({ data: [null, 'invalid'], timestamp: Date.now() })) }); assert.equal((await loader()).length, 2); });
