import supabase from './supabase';

export const businessJourneyEnabled = import.meta.env.VITE_BUSINESS_JOURNEY_ENABLED === 'true';
const seen = new Set();
let memorySession;

// Only allowlisted labels leave the browser. No names, searches, URLs or emails.
export function trackBusinessJourney(kind, plan = 'bloom', entry = 'existing') {
  if (!businessJourneyEnabled || !supabase || navigator.doNotTrack === '1') return;
  if (!['plan_view', 'plan_cta', 'business_selected', 'listing_request_started'].includes(kind)) return;
  if (!['bloom', 'comparison'].includes(plan) || !['existing', 'missing'].includes(entry)) return;
  const validSession = saved => saved?.expires > Date.now() && /^[a-f0-9-]{36}$/i.test(saved.id);
  let session;
  try {
    const saved = JSON.parse(sessionStorage.getItem('lhp-business-journey'));
    if (validSession(saved)) session = saved.id;
    else { session = crypto.randomUUID(); sessionStorage.setItem('lhp-business-journey', JSON.stringify({ id: session, expires: Date.now() + 30 * 60 * 1000 })); }
  } catch {
    if (!validSession(memorySession)) memorySession = { id: crypto.randomUUID(), expires: Date.now() + 30 * 60 * 1000 };
    session = memorySession.id;
  }
  const key = `${session}:${kind}:${plan}:${entry}`;
  if (seen.has(key)) return;
  seen.add(key);
  void supabase.functions.invoke('business-journey', { body: { action: 'event', event_id: crypto.randomUUID(), session_id: session, kind, plan, entry, device: matchMedia('(max-width: 900px)').matches ? 'mobile' : 'desktop' } }).catch(() => {});
}
