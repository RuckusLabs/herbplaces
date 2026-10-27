import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validSlug } from '../../src/utilities/seo.js';
import { publicGrowth } from '../../src/utilities/placeGrowth.js';

export function validatePlaces(places) {
  if (!Array.isArray(places) || !places.length) throw new Error('No public places were returned; refusing to publish an empty directory.');
  const seen = new Set();
  for (const place of places) {
    if (!validSlug(place.urlSlug) || !place.name || seen.has(place.urlSlug)) throw new Error('Place names and unique, safe URL slugs are required for SEO generation.');
    seen.add(place.urlSlug);
  }
  return places;
}

export async function fetchPublicPlaces(env) {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Public Supabase configuration is required for a complete GitHub Pages build.');
  const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) } });
  const places = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('public_places').select('id,name,urlSlug,tagline,description,coverPhoto,photos,city,state,address,zip,phone,hours,website,latitude,longitude,category_ids,social_links,photo_alt,content_version,updated_at').order('id').range(offset, offset + 499);
    if (error) throw new Error(`Unable to read public listings for SEO (${error.code || 'request failed'}).`);
    places.push(...data);
    if (data.length < 500) break;
  }
  if (env.VITE_GROWTH_ENABLED === 'true') {
    const profiles = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('public_place_growth').select('*').order('place_id').range(offset, offset + 499);
      if (error) throw new Error('Business growth tools are enabled but their public data could not be read. Apply the growth migration before enabling them.');
      profiles.push(...data);
      if (data.length < 500) break;
    }
    const byId = new Map(profiles.map(profile => [String(profile.place_id),profile]));
    for (const place of places) if (byId.has(String(place.id))) place.growth = byId.get(String(place.id));
  }
  return validatePlaces(places);
}

// Stable across object key order and database row order; any public content edit,
// addition, or removal changes the deployed fingerprint.
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export function directoryHash(places) {
  validatePlaces(places);
  // Scheduled/expired announcements and events also invalidate static exports.
  const sorted = places.map(place => place.growth ? { ...place, active_growth: publicGrowth(place.growth) } : place).sort((a, b) => a.urlSlug.localeCompare(b.urlSlug, 'en'));
  return createHash('sha256').update(JSON.stringify(stable(sorted))).digest('hex');
}

export function needsBuild(places, previousHash, force = false) {
  return force || directoryHash(places) !== previousHash?.trim();
}
