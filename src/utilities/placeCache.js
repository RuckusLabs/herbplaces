// One request is shared by concurrent consumers. Storage is an optional optimization.
export function createPlaceLoader({ request, getStorage = () => globalThis.localStorage, now = Date.now, duration = 72 * 60 * 60 * 1000 }) {
  let memory;
  let pending;
  const key = 'places_cache';
  const valid = cache => Array.isArray(cache?.data) && cache.data.every(place => place && typeof place === 'object' && !Array.isArray(place)) && typeof cache.timestamp === 'number' && now() - cache.timestamp >= 0 && now() - cache.timestamp < duration;
  return async function loadPlaces({ force = false } = {}) {
    if (!force && valid(memory)) return memory.data;
    if (!force) {
      try {
        const cached = JSON.parse(getStorage()?.getItem(key) || 'null');
        if (valid(cached)) { memory = cached; return cached.data; }
      } catch { /* Corrupt or blocked storage must never stop discovery. */ }
    }
    if (pending) return pending;
    pending = (async () => {
      const rows = await request();
      const data = [...(rows || [])].sort((a, b) => String(a.city || '').localeCompare(String(b.city || '')));
      memory = { data, timestamp: now() };
      try { getStorage()?.setItem(key, JSON.stringify(memory)); } catch { /* Storage may be full or disabled. */ }
      return data;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
