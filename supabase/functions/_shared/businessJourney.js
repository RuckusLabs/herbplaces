const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const browserKinds = ['plan_view', 'plan_cta', 'business_selected', 'listing_request_started'];

export function createBusinessJourneyHandler({ origins, secret, recordEvent, eventsEnabled = true, now = () => new Date() }) {
  return async request => {
    const origin = request.headers.get('Origin'); const allowed = origins.includes(origin);
    const headers = { 'Access-Control-Allow-Origin': allowed ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return reply({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    if (!secret) return reply({ error: 'Business measurement is not connected yet.' }, 503);
    try {
      if (Number(request.headers.get('Content-Length')) > 12000) return reply({ error: 'Request too large.' }, 413);
      const raw = await request.text(); if (new TextEncoder().encode(raw).length > 12000) return reply({ error: 'Request too large.' }, 413);
      const body = JSON.parse(raw);
      if (!body || body.action !== 'event') return reply({ error: 'Invalid request.' }, 400);
      if (!eventsEnabled) return reply({ error: 'Business measurement is not enabled.' }, 503);
      if (body.action === 'event' && (request.headers.get('DNT') === '1' || /bot|crawler|spider|headless/i.test(request.headers.get('User-Agent') || ''))) return reply({ accepted: false });
      const ip = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unavailable').split(',')[0].trim();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${now().toISOString().slice(0, 10)}:${ip}`)));
      const hash = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
      if (body.action === 'event') {
        if (Object.keys(body).some(key => !['action', 'event_id', 'session_id', 'kind', 'plan', 'entry', 'device'].includes(key)) || !uuid.test(body.event_id) || !uuid.test(body.session_id) || !browserKinds.includes(body.kind) || !['comparison', 'bloom'].includes(body.plan) || !['existing', 'missing'].includes(body.entry) || !['desktop', 'mobile'].includes(body.device)) return reply({ error: 'Invalid action.' }, 400);
        await recordEvent({ p_event_id: body.event_id, p_session_id: body.session_id, p_kind: body.kind, p_plan: body.plan, p_entry: body.entry, p_device: body.device, p_hash: hash });
      }
      return reply({ accepted: true });
    } catch (failure) {
      if (failure?.code === 'P0001' && failure.message === 'Please try again tomorrow.') return reply({ error: failure.message }, 429);
      return reply({ error: 'Your request could not be saved. Please try again; your details are still here.' }, 400);
    }
  };
}
