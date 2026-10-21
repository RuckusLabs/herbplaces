export const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
export const PHOTO_LIMIT = 20;
export const PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const CATEGORY_IDS = ['shops', 'herbalists', 'gardens', 'workshops'];

export function subscriptionAllowsEditing(subscription, now = Date.now()) {
  if (!subscription) return false;
  const paidUntil = Date.parse(subscription.paid_until || '');
  if (subscription.status === 'active') return paidUntil > now || (Number.isFinite(paidUntil) && !subscription.cancel_at_period_end && Date.parse(subscription.grace_ends_at || '') > now);
  return subscription.status === 'past_due' && Date.parse(subscription.grace_ends_at || '') > now;
}

export function getSubscriptionLabel(subscription, now = Date.now()) {
  if (!subscription) return 'Subscription needed';
  if (subscription.status === 'past_due' && subscriptionAllowsEditing(subscription, now)) return 'Payment overdue · grace period';
  if (subscription.status === 'active' && Date.parse(subscription.paid_until || '') <= now && subscriptionAllowsEditing(subscription, now)) return 'Renewal processing';
  if (subscriptionAllowsEditing(subscription, now)) return subscription.cancel_at_period_end ? 'Active · ends after this billing period' : 'Bloom active';
  if (subscription.status === 'incomplete') return 'Payment pending';
  return 'Editing paused';
}

export function validatePhotoFile(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (!file.size || file.size > PHOTO_BYTES) throw new Error('Each photo must be no larger than 10 MB.');
}

export function hasImageSignature(bytes, type) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

// A repeated failure must not restart the seven-day window.
export function renewalGraceDeadline(existing, failureAt) {
  return existing || new Date(failureAt + GRACE_MS).toISOString();
}

export function coordinatesFromGeocode(result) {
  const feature = result?.features?.[0];
  const match = feature?.properties?.match_code;
  const coords = feature?.geometry?.coordinates;
  if (feature?.properties?.feature_type !== 'address' || !['exact', 'high'].includes(match?.confidence)) return null;
  if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 85.051129) return null;
  return { longitude: coords[0], latitude: coords[1] };
}
