import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validSlug } from '../../src/utilities/seo.js';

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
  return validatePlaces(places);
}

// Stable across object key order and database row order; any public content edit,
// addition, or removal changes the deployed fingerprint.
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export function directoryHash(places) {
  validatePlaces(places);
  const sorted = [...places].sort((a, b) => a.urlSlug.localeCompare(b.urlSlug, 'en'));
  return createHash('sha256').update(JSON.stringify(stable(sorted))).digest('hex');
}

export function needsBuild(places, previousHash, force = false) {
  return force || directoryHash(places) !== previousHash?.trim();
}
