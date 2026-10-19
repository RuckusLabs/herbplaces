import { authenticated, checked, corsHeaders, allowedOrigin, json, required, serviceClient, stripeClient } from '../_shared/server.ts';
import { reconcileSubscription } from '../_shared/billing.ts';
import { coordinatesFromGeocode, hasImageSignature, PHOTO_BYTES, validatePhotoFile } from '../_shared/entitlements.js';

Deno.serve(async req => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: allowedOrigin(req) ? 204 : 403, headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);
  if (!allowedOrigin(req)) return json({ error: 'Origin not allowed.' }, 403, headers);
  try {
    const db = serviceClient();
    const user = await authenticated(req, db);
    const isUpload = req.headers.get('Content-Type')?.startsWith('multipart/form-data');
    // Bound bodies before parsing multipart data or JSON; do not trust Content-Length.
    const maximum = isUpload ? PHOTO_BYTES + 64 * 1024 : 16 * 1024;
    if (Number(req.headers.get('Content-Length')) > maximum) return json({ error: 'Request too large.' }, 413, headers);
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (!reader) throw new Error('Missing request body.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); return json({ error: 'Request too large.' }, 413, headers); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const bounded = new Request(req.url, { method: 'POST', headers: req.headers, body: bytes });
    const form = isUpload ? await bounded.formData() : null;
    const body = form ? null : await bounded.json();
    const action = form ? form.get('action') : body.action;
    const placeId = String(form ? form.get('place_id') || '' : body.place_id || '');
    if (!placeId || placeId.length > 100) throw new Error('Choose a place.');
    const billingAction = ['checkout', 'portal', 'sync-billing'].includes(String(action));
    const access = await checked(await db.rpc('management_service_access', { p_place_id: placeId, p_user_id: user.id, p_billing: billingAction }));
    if (!access) return json({ error: billingAction ? 'Only the billing contact can manage payment.' : 'Editing access is unavailable. Check your subscription.' }, 403, headers);

    if (action === 'upload') {
      const file = form?.get('file');
      if (!(file instanceof File)) throw new Error('Choose a photo to upload.');
      validatePhotoFile(file);
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      if (!hasImageSignature(imageBytes, file.type)) throw new Error('This file is not a valid JPEG, PNG, or WebP image.');
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
      const path = `${encodeURIComponent(placeId)}/${crypto.randomUUID()}.${extension}`;
      await checked(await db.storage.from('place-photos').upload(path, imageBytes, { contentType: file.type, upsert: false, cacheControl: '31536000' }));
      const { data: { publicUrl } } = db.storage.from('place-photos').getPublicUrl(path);
      try {
        await checked(await db.rpc('register_place_upload', { p_place_id: placeId, p_user_id: user.id, p_path: path, p_url: publicUrl }));
      } catch (error) {
        await db.storage.from('place-photos').remove([path]);
        throw error;
      }
      return json({ url: publicUrl }, 200, headers);
    }

    if (action === 'geocode') {
      if (access.place.geocode_status === 'confirmed') return json({ status: 'confirmed' }, 200, headers);
      const place = await checked(await db.rpc('reserve_place_geocode', { p_place_id: placeId, p_user_id: user.id }));
      if (!place) return json({ status: 'review' }, 200, headers);
      let coordinates = null;
      try {
        const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
        url.search = new URLSearchParams({ access_token: required('MAPBOX_GEOCODING_TOKEN'),
          q: [place.address, place.city, place.state, place.zip].filter(Boolean).join(', '),
          permanent: 'true', autocomplete: 'false', types: 'address', limit: '1' }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Geocoding unavailable.');
        coordinates = coordinatesFromGeocode(await response.json());
      } catch { /* Content is already published. An admin can resolve the location. */ }
      await checked(await db.rpc('apply_place_geocode', { p_place_id: placeId, p_address_version: place.content_version,
        p_latitude: coordinates?.latitude ?? null, p_longitude: coordinates?.longitude ?? null }));
      return json({ status: coordinates ? 'confirmed' : 'review' }, 200, headers);
    }

    const stripe = stripeClient();
    const siteUrl = (allowedOrigin(req) || required('SITE_URL')).replace(/\/$/, '');
    if (action === 'sync-billing') {
      let subscriptionId = access.subscription?.stripe_subscription_id;
      if (access.subscription?.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({ customer: access.subscription.stripe_customer_id, status: 'all', limit: 100 });
        subscriptionId = subscriptions.data.find(item => item.metadata.place_id === placeId && !['canceled', 'incomplete_expired'].includes(item.status))?.id || subscriptionId;
      }
      if (subscriptionId) await reconcileSubscription(subscriptionId, `sync-${crypto.randomUUID()}`, Math.floor(Date.now() / 1000));
      return json({ synced: true }, 200, headers);
    }
    if (action === 'portal') {
      if (!access.subscription?.stripe_customer_id) throw new Error('Start a subscription first.');
      await stripe.customers.update(access.subscription.stripe_customer_id, { email: access.billing_email });
      const portal = await stripe.billingPortal.sessions.create({ customer: access.subscription.stripe_customer_id, return_url: `${siteUrl}/my-places` });
      return json({ url: portal.url }, 200, headers);
    }
    if (action === 'checkout') {
      if (Deno.env.get('BLOOM_ENABLED') !== 'true') throw new Error('Payment signup is not available yet. Please check back soon.');
      const price = await stripe.prices.retrieve(required('STRIPE_BLOOM_PRICE_ID'));
      if (!price.active || price.currency !== 'usd' || price.unit_amount !== 1900 || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
        throw new Error('Bloom price configuration must be an active USD $19 monthly price.');
      }
      const reservation = await checked(await db.rpc('reserve_place_checkout', { p_place_id: placeId, p_user_id: user.id }));
      let customerId = reservation.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: access.billing_email, metadata: { place_id: placeId } }, { idempotencyKey: `place-customer-${placeId}` });
        customerId = customer.id;
        await checked(await db.from('place_subscriptions').update({ stripe_customer_id: customerId }).eq('place_id', placeId).eq('checkout_nonce', reservation.checkout_nonce).select('place_id').single());
      }
      // A completed Checkout may precede its webhook; never create a second subscription.
      const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      if (existing.data.some(subscription => !['canceled', 'incomplete_expired'].includes(subscription.status))) {
        throw new Error('A subscription already exists. Refresh billing status or open billing.');
      }
      if (reservation.checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(reservation.checkout_session_id);
        if (session.status !== 'open' || !session.url) throw new Error('Payment is processing. Refresh billing status in My Places.');
        return json({ url: session.url }, 200, headers);
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', customer: customerId, line_items: [{ price: required('STRIPE_BLOOM_PRICE_ID'), quantity: 1 }],
        metadata: { place_id: placeId }, subscription_data: { metadata: { place_id: placeId } },
        expires_at: Math.floor(Date.parse(reservation.checkout_expires_at) / 1000),
        success_url: `${siteUrl}/my-places?billing=returned&place=${encodeURIComponent(placeId)}`,
        cancel_url: `${siteUrl}/my-places?billing=canceled`,
      }, { idempotencyKey: `place-checkout-${reservation.checkout_nonce}` });
      await checked(await db.from('place_subscriptions').update({ checkout_session_id: session.id }).eq('place_id', placeId).eq('checkout_nonce', reservation.checkout_nonce).select('place_id').single());
      return json({ url: session.url }, 200, headers);
    }
    return json({ error: 'Unknown action.' }, 400, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete this request.';
    // Provider diagnostics stay in server logs; credentials and internal errors never reach the UI.
    console.error('Place management request failed', message);
    const safe = /^(Sign in|Choose |Each photo|This file|Only |Editing |Upload |Daily |Manage |Start |A subscription|Payment is|An approved|Use |Confirm )/.test(message);
    return json({ error: safe ? message : 'Unable to complete this request. Please try again or contact Little Herb Places.' }, 400, headers);
  }
});
