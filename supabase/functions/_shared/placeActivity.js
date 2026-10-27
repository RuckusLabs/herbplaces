const kinds = ['profile_view', 'website_click', 'directions_click', 'phone_click', 'primary_click', 'announcement_click', 'offering_click', 'event_click'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPlaceActivityHandler({ origins, secret, record, now = () => new Date() }) {
  return async request => {
    const origin = request.headers.get('Origin');
    const allowed = origins.includes(origin);
    const headers = { 'Access-Control-Allow-Origin': allowed ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    const respond = (body, status) => new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return respond({ error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
    if (!secret) return respond({ error: 'Activity collection is not enabled.' }, 503);
    if (request.headers.get('DNT') === '1' || /bot|crawler|spider|headless/i.test(request.headers.get('User-Agent') || '')) return respond({ accepted: false }, 200);
    try {
      if (Number(request.headers.get('Content-Length')) > 2048) return respond({ error: 'Request too large.' }, 413);
      const raw = await request.text();
      if (raw.length > 2048) return respond({ error: 'Request too large.' }, 413);
      const body = JSON.parse(raw);
      if (!body || typeof body.place_id !== 'string' || !body.place_id || body.place_id.length > 100 || !kinds.includes(body.kind) || !uuid.test(body.event_id) || (body.item_id != null && !uuid.test(body.item_id))) return respond({ error: 'Invalid action.' }, 400);
      // The hosting gateway supplies x-forwarded-for. Never persist its raw value.
      const ip = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unavailable').split(',')[0].trim();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${now().toISOString().slice(0, 10)}:${ip}`)));
      const visitorHash = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
      await record({ p_place_id: body.place_id, p_kind: body.kind, p_item_id: body.item_id || null, p_event_id: body.event_id, p_visitor_hash: visitorHash });
      return respond({ accepted: true }, 200);
    } catch { return respond({ error: 'Action could not be recorded.' }, 400); }
  };
}
