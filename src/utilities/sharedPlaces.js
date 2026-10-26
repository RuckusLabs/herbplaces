// Public data only. Private account and billing records never enter this store.
export function createSharedPlaces(load) {
  let state = { places: [], loading: true, error: '' };
  const listeners = new Set();
  let pending;
  let generation = 0;
  const emit = () => listeners.forEach(listener => listener());
  const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  const snapshot = () => state;
  const publish = place => {
    generation++;
    state = { places: [...state.places.filter(item => String(item.id) !== String(place.id)), place].sort((a, b) => String(a.city || '').localeCompare(String(b.city || ''))), loading: false, error: '' };
    emit();
  };
  const remove = id => {
    generation++; state = { ...state, places: state.places.filter(place => String(place.id) !== String(id)) }; emit();
  };
  function refresh({ force = true } = {}) {
    if (pending) return pending;
    const request = generation;
    state = { ...state, loading: !state.places.length, error: '' };
    emit();
    pending = Promise.resolve().then(() => load({ force })).then(places => {
      if (request === generation) state = { places, loading: false, error: '' };
    }).catch(() => {
      if (request === generation) state = { ...state, loading: false, error: 'We couldn’t refresh the places right now. Give it another try in a moment.' };
    }).finally(() => {
      pending = undefined; emit();
      if (request !== generation) return refresh();
    });
    return pending;
  }
  return { subscribe, snapshot, publish, remove, refresh };
}
