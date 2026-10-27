import supabase from './supabase';

export const growthEnabled = import.meta.env.VITE_GROWTH_ENABLED === 'true';
export const emailReportsEnabled = growthEnabled && import.meta.env.VITE_ACTIVITY_REPORTS_ENABLED === 'true';
export async function getGrowthProfiles() {
  if (!supabase || !growthEnabled) return [];
  const { data, error } = await supabase.from('public_place_growth').select('*');
  if (error) throw error;
  return data || [];
}

// Counts are first-party action totals, not visitors, bookings, or sales.
// A page-view key is reused for StrictMode/remounts in the same tab session.
const seen = new Map();
export function trackPlaceActivity(placeId, kind, itemId = null) {
  if (!growthEnabled || !supabase || (typeof navigator !== 'undefined' && navigator.doNotTrack === '1')) return;
  let eventId = crypto.randomUUID();
  if (kind === 'profile_view') {
    const key = `place-view:${placeId}`;
    const now = Date.now();
    const previous = seen.get(key);
    if (previous && now - previous.at < 30 * 60 * 1000) return;
    seen.set(key, { at: now, eventId });
  }
  void supabase.functions.invoke('place-activity', { body: { place_id: String(placeId), kind, item_id: itemId, event_id: eventId } }).catch(() => {});
}
