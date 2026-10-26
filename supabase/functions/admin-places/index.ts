import { authenticated, checked, corsHeaders, allowedOrigin, json, serviceClient, stripeClient, required } from '../_shared/server.ts';
import { placeDeletionAssets, assertPlaceBillingResolved, cleanupPlaceImages } from '../_shared/placeDeletion.js';
Deno.serve(async req => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: allowedOrigin(req) ? 204 : 403, headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);
  if (!allowedOrigin(req)) return json({ error: 'Origin not allowed.' }, 403, headers);
  let contentRemoved = false;
  try {
    const db = serviceClient(); const actor = await authenticated(req, db);
    const reader = req.body?.getReader(); if (!reader) throw new Error('Choose a place.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); return json({ error: 'Request too large.' }, 413, headers); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!['preview','delete'].includes(body.action) || typeof body.place_id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(body.place_id)) throw new Error('Choose a place.');
    const plan = await checked(await db.rpc('plan_place_deletion', { p_actor_id: actor.id, p_place_id: body.place_id }));
    if (plan.already_removed) return body.action === 'delete' ? json({ removed: true, content_removed: true }, 200, headers) : json({ error: 'Place not found. Refresh the directory.' }, 404, headers);
    const selection = plan.cleanup_pending ? { assets: plan.job.assets, sharedCount: 0 } : placeDeletionAssets(plan, required('SUPABASE_URL'));
    const slug = plan.cleanup_pending ? plan.slug : plan.place.slug;
    if (body.action === 'preview') return json({ slug, name: plan.place?.name || slug, image_count: selection.assets.length, shared_images: selection.sharedCount,
      managers: plan.managers || 0, revisions: plan.revisions || 0, cleanup_pending: !!plan.cleanup_pending,
      billing_blocked: !plan.cleanup_pending && !['none','canceled','incomplete_expired'].includes(plan.subscription?.status || 'none') }, 200, headers);
    if (typeof body.slug !== 'string' || body.slug !== slug) throw new Error('The confirmation does not match the place.');
    let job = plan.job;
    if (!plan.cleanup_pending) {
      const sub = plan.subscription;
      const linked = sub?.stripe_customer_id || sub?.stripe_subscription_id || sub?.checkout_session_id;
      await assertPlaceBillingResolved(linked ? stripeClient() : null, sub);
      job = await checked(await db.rpc('delete_place_records', { p_actor_id: actor.id, p_place_id: body.place_id, p_slug: body.slug, p_version: plan.place.version, p_subscription: sub || null, p_assets: selection.assets }));
    }
    contentRemoved = true;
    await cleanupPlaceImages(db.storage, job.assets);
    await checked(await db.rpc('finish_place_deletion', { p_place_id: body.place_id, p_token: job.token }));
    return json({ removed: true, content_removed: true }, 200, headers);
  } catch (error) {
    if (contentRemoved) return json({ removed: false, content_removed: true, cleanup_pending: true, error: 'The listing and its content are deleted. Stored image cleanup needs retrying.' }, 200, headers);
    const message = error instanceof Error ? error.message : '';
    const safe = /^(Sign in|Administrator access|Choose a place|Place not found|Place changed|Billing changed|Resolve |Checkout is|Payment is|The confirmation)/.test(message);
    return json({ error: safe ? message : 'Unable to delete this place. Billing and image cleanup must be verified before proceeding.' }, 400, headers);
  }
});
