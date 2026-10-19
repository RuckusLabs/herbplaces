export const GUEST_FAVORITES_KEY = 'guest_favorites';

export function getGuestFavorites(storage) {
  try {
    const data = JSON.parse((storage || globalThis.localStorage).getItem(GUEST_FAVORITES_KEY) || '[]');
    return Array.isArray(data)
      ? [...new Set(data.filter(id => typeof id === 'string' || typeof id === 'number').map(id => String(id).trim()).filter(Boolean))]
      : [];
  } catch { return []; }
}

export function toggleGuestFavorite(itemId, storage = globalThis.localStorage) {
  const id = String(itemId);
  const current = getGuestFavorites(storage);
  const saved = !current.includes(id);
  const favorites = saved ? [...current, id] : current.filter(item => item !== id);
  storage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(favorites));
  return { favorites, saved };
}

export function clearSyncedGuestFavorites(syncedIds, storage) {
  try {
    const target = storage || globalThis.localStorage;
    const synced = new Set(syncedIds.map(String));
    const remaining = getGuestFavorites(target).filter(id => !synced.has(id));
    if (remaining.length) target.setItem(GUEST_FAVORITES_KEY, JSON.stringify(remaining));
    else target.removeItem(GUEST_FAVORITES_KEY);
  } catch { /* A later merge safely deduplicates any guest IDs left behind. */ }
}

// Share the request during Strict Mode, route changes, and simultaneous consumers.
export function createAccountFavoritesLoader(client, readGuest = getGuestFavorites) {
  const pending = new Map();
  return function loadAccountFavorites(userId) {
    if (pending.has(userId)) return pending.get(userId);
    const request = (async () => {
      const guestIds = [...new Set(readGuest().map(String))];
      const { data, error } = await client.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      const existing = data || [];
      const existingIds = new Set(existing.map(favorite => String(favorite.item_id)));
      const missing = guestIds.filter(id => !existingIds.has(id));
      let added = [];
      if (missing.length) {
        const result = await client.from('favorites').insert(missing.map(id => ({ user_id: userId, item_id: id, item_type: 'place' }))).select();
        if (result.error) throw result.error;
        added = result.data || [];
        const addedIds = new Set(added.map(favorite => String(favorite.item_id)));
        if (missing.some(id => !addedIds.has(id))) throw new Error('Some saved places could not be confirmed.');
      }
      return { favorites: [...added, ...existing], syncedIds: guestIds };
    })();
    pending.set(userId, request);
    const clear = () => { if (pending.get(userId) === request) pending.delete(userId); };
    request.then(clear, clear);
    return request;
  };
}
