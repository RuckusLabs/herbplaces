import supabase from './supabase';

const ownerSandboxCheckout = import.meta.env.DEV && import.meta.env.VITE_BLOOM_SANDBOX_CHECKOUT === 'true';
export const bloomAvailable = import.meta.env.VITE_BLOOM_ENABLED === 'true' || ownerSandboxCheckout;

export async function managementRpc(name, params = {}) {
  if (!supabase) throw new Error('Place management is temporarily unavailable.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    if (['PGRST202', 'PGRST205', '42P01'].includes(error.code)) throw new Error('Place management is being prepared. Please check back soon.');
    throw error;
  }
  return data;
}

export async function managementAction(action, placeId, extra = {}) {
  if (!supabase) throw new Error('Place management is temporarily unavailable.');
  const body = extra instanceof FormData ? extra : { action, place_id: String(placeId), ...extra };
  if (body instanceof FormData) { body.set('action', action); body.set('place_id', String(placeId)); }
  // The local-only endpoint enforces one approved tester, one place, and test keys.
  const endpoint = action === 'checkout' && ownerSandboxCheckout ? 'bloom-owner-checkout' : 'place-management';
  const { data, error } = await supabase.functions.invoke(endpoint, { body });
  if (error) {
    let message = 'We couldn’t complete that request. Please try again.';
    try { message = (await error.context.json()).error || message; } catch { /* Network or unavailable function. */ }
    throw new Error(message);
  }
  return data;
}

export async function removeManagementUser(userId, email) {
  if (!supabase) throw new Error('User management is temporarily unavailable.');
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'remove', user_id: userId, email } });
  if (error) {
    let message = 'Unable to remove this user. Please try again.';
    try { message = (await error.context.json()).error || message; } catch { /* Network or unavailable function. */ }
    throw new Error(message);
  }
  return data;
}

export async function geocodePublishedPlace(place) {
  if (place.geocode_status !== 'pending') return '';
  try {
    const result = await managementAction('geocode', place.id);
    return result.status === 'review' ? 'Your changes are live. An admin will confirm the map location.' : '';
  } catch { return 'Your changes are live. The map location still needs confirmation.'; }
}

export function openBillingUrl(url) {
  const target = new URL(url);
  if (!['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname) || target.protocol !== 'https:') throw new Error('Unable to open billing. Please try again.');
  window.location.assign(target.href);
}

export async function placeDeletionAction(action, placeId, slug) {
  if (!supabase) throw new Error('Place administration is temporarily unavailable.');
  const { data, error } = await supabase.functions.invoke('admin-places', { body: { action, place_id: String(placeId), ...(slug === undefined ? {} : { slug }) } });
  if (error) {
    let message = 'Unable to complete place deletion. Please try again.';
    try { message = (await error.context.json()).error || message; } catch { /* Preserve a safe fallback. */ }
    throw new Error(message);
  }
  return data;
}
