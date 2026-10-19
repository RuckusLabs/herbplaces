import test from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_FAVORITES_KEY, getGuestFavorites, toggleGuestFavorite, clearSyncedGuestFavorites, createAccountFavoritesLoader } from '../utilities/favorites.js';
import { getSafeReturnPath } from '../utilities/authNavigation.js';

function storageWith(ids = []) {
  const values = new Map([[GUEST_FAVORITES_KEY, JSON.stringify(ids)]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function accountClient(initial = []) {
  const state = { rows: [...initial], reads: 0, inserts: [], readError: null, writeError: null, gate: null, omitReturnedRows: false };
  const client = { from(table) {
    assert.equal(table, 'favorites');
    return {
      select: () => ({ eq: (_field, userId) => ({ order: async () => {
        state.reads++;
        if (state.gate) await state.gate;
        return { data: state.rows.filter(row => row.user_id === userId), error: state.readError };
      } }) }),
      insert: rows => ({ select: async () => {
        state.inserts.push(...rows);
        if (state.writeError) return { data: null, error: state.writeError };
        const added = rows.map((row, i) => ({ ...row, id: `favorite-${state.rows.length + i}` }));
        state.rows.push(...added);
        return { data: state.omitReturnedRows ? [] : added, error: null };
      } }),
    };
  } };
  return { client, state };
}

test('guest saves persist and removing a place reports a removal', () => {
  const storage = storageWith(['1']);
  assert.deepEqual(toggleGuestFavorite(2, storage), { favorites: ['1', '2'], saved: true });
  assert.deepEqual(getGuestFavorites(storage), ['1', '2']);
  assert.deepEqual(toggleGuestFavorite('2', storage), { favorites: ['1'], saved: false });
});
test('invalid and duplicate guest IDs cannot create duplicate account saves', () => {
  const storage = storageWith([1, '1', '', null, {}, '2']);
  assert.deepEqual(getGuestFavorites(storage), ['1', '2']);
});
test('failed local storage does not report a successful save', () => {
  const storage = storageWith();
  storage.setItem = () => { throw new Error('storage blocked'); };
  assert.throws(() => toggleGuestFavorite('1', storage));
  assert.deepEqual(getGuestFavorites(storage), []);
});
test('account merge adds missing places while preserving existing favorites', async () => {
  const { client, state } = accountClient([{ id: 'existing', user_id: 'member', item_id: '1' }]);
  const load = createAccountFavoritesLoader(client, () => ['1', '2', '2']);
  const result = await load('member');
  assert.deepEqual(result.favorites.map(row => row.item_id), ['2', '1']);
  assert.deepEqual(state.inserts, [{ user_id: 'member', item_id: '2', item_type: 'place' }]);
});
test('concurrent session loads share the merge and do not insert duplicates', async () => {
  const { client, state } = accountClient();
  let release;
  state.gate = new Promise(resolve => { release = resolve; });
  const load = createAccountFavoritesLoader(client, () => ['saved']);
  const first = load('member');
  const second = load('member');
  assert.equal(first, second);
  release();
  await Promise.all([first, second]);
  assert.equal(state.reads, 1);
  assert.equal(state.inserts.length, 1);
});
test('account read errors preserve local saves and can be retried', async () => {
  const storage = storageWith(['1']);
  const { client, state } = accountClient();
  state.readError = new Error('offline');
  const load = createAccountFavoritesLoader(client, () => getGuestFavorites(storage));
  await assert.rejects(load('member'), /offline/);
  assert.deepEqual(getGuestFavorites(storage), ['1']);
  assert.equal(state.inserts.length, 0);
  state.readError = null;
  const result = await load('member');
  clearSyncedGuestFavorites(result.syncedIds, storage);
  assert.equal(result.favorites[0].item_id, '1');
  assert.deepEqual(getGuestFavorites(storage), []);
});
test('failed account inserts retain guest saves until a successful retry', async () => {
  const storage = storageWith(['1']);
  const { client, state } = accountClient();
  state.writeError = new Error('permission denied');
  const load = createAccountFavoritesLoader(client, () => getGuestFavorites(storage));
  await assert.rejects(load('member'), /permission denied/);
  assert.deepEqual(getGuestFavorites(storage), ['1']);
  state.writeError = null;
  const result = await load('member');
  clearSyncedGuestFavorites(result.syncedIds, storage);
  assert.deepEqual(getGuestFavorites(storage), []);
});
test('unconfirmed inserts do not silently discard local saves', async () => {
  const { client, state } = accountClient();
  state.omitReturnedRows = true;
  const load = createAccountFavoritesLoader(client, () => ['1']);
  await assert.rejects(load('member'), /could not be confirmed/);
});
test('guest saves added in another tab during sync are kept', () => {
  const storage = storageWith(['1', '2', 'new-save']);
  clearSyncedGuestFavorites(['1', '2'], storage);
  assert.deepEqual(getGuestFavorites(storage), ['new-save']);
});
test('account reads remain scoped to the signed-in user', async () => {
  const { client } = accountClient([{ user_id: 'a', item_id: 'one' }, { user_id: 'b', item_id: 'two' }]);
  const load = createAccountFavoritesLoader(client, () => []);
  const [a, b] = await Promise.all([load('a'), load('b')]);
  assert.deepEqual(a.favorites.map(row => row.item_id), ['one']);
  assert.deepEqual(b.favorites.map(row => row.item_id), ['two']);
});
test('post-auth redirects only accept paths within this app', () => {
  assert.equal(getSafeReturnPath('/favorites'), '/favorites');
  assert.equal(getSafeReturnPath('/place/earth-commons?q=herbs'), '/place/earth-commons?q=herbs');
  for (const unsafe of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', null]) assert.equal(getSafeReturnPath(unsafe), '/map');
});
