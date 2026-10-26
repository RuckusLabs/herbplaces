const buckets = new Set(['places', 'place-photos']);
export function storedImage(url, origin) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(origin).origin) return null;
    const prefix = '/storage/v1/object/public/';
    if (!parsed.pathname.startsWith(prefix)) return null;
    const [bucket, ...parts] = decodeURIComponent(parsed.pathname.slice(prefix.length)).split('/');
    if (!buckets.has(bucket) || !parts.length || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) return null;
    return { bucket, path: parts.join('/') };
  } catch { return null; }
}
export function placeDeletionAssets(plan, origin) {
  const key = asset => `${asset.bucket}/${asset.path}`;
  const shared = new Set((plan.other_urls || []).map(url => storedImage(url, origin)).filter(Boolean).map(key));
  const candidates = [...(plan.urls || []).map(url => storedImage(url, origin)).filter(Boolean), ...(plan.folder_assets || [])];
  const assets = new Map(); let sharedCount = 0;
  for (const asset of candidates) {
    if (!buckets.has(asset.bucket) || !asset.path || asset.path.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw new Error('Invalid image cleanup plan.');
    if (shared.has(key(asset))) { sharedCount++; continue; }
    assets.set(key(asset), asset);
  }
  return { assets: [...assets.values()], sharedCount };
}
async function pages(list, params) {
  const values = []; let cursor;
  do {
    const page = await list({ ...params, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    values.push(...page.data);
    if (!page.has_more) return values;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error('Unable to verify billing.');
    cursor = next;
  } while (cursor);
  return values;
}
export async function assertPlaceBillingResolved(stripe, subscription) {
  if (!subscription) return;
  if (!['none', 'canceled', 'incomplete_expired'].includes(subscription.status)) throw new Error('Resolve the subscription in Stripe and refresh before deleting this place.');
  if (!subscription.checkout_session_id && subscription.checkout_expires_at && Date.parse(subscription.checkout_expires_at) > Date.now()) throw new Error('Checkout is being prepared. Wait for it to expire before deleting.');
  const terminal = new Set(['canceled', 'incomplete_expired']);
  const ended = new Set();
  const check = sub => {
    if (!terminal.has(sub.status)) throw new Error('Resolve the subscription in Stripe and refresh before deleting this place.');
    ended.add(sub.id);
  };
  if (subscription.stripe_subscription_id) check(await stripe.subscriptions.retrieve(subscription.stripe_subscription_id));
  if (subscription.stripe_customer_id) {
    for (const sub of await pages(params => stripe.subscriptions.list(params), { customer: subscription.stripe_customer_id, status: 'all' })) check(sub);
    const open = await stripe.checkout.sessions.list({ customer: subscription.stripe_customer_id, status: 'open', limit: 1 });
    if (open.data.length) throw new Error('Resolve open checkout in Stripe before deleting this place.');
    for (const session of await pages(params => stripe.checkout.sessions.list(params), { customer: subscription.stripe_customer_id, status: 'complete' })) {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (session.mode === 'subscription' && session.payment_status === 'unpaid' && !ended.has(subId)) throw new Error('Payment is still processing. Resolve billing before deleting.');
    }
  }
  if (subscription.checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(subscription.checkout_session_id);
    if (session.status === 'open') throw new Error('Resolve open checkout in Stripe before deleting this place.');
    if (session.status === 'complete' && session.payment_status === 'unpaid') {
      const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!ended.has(id)) throw new Error('Payment is still processing. Resolve billing before deleting.');
    }
  }
}
export async function cleanupPlaceImages(storage, assets) {
  for (const bucket of buckets) {
    const paths = assets.filter(asset => asset.bucket === bucket).map(asset => asset.path);
    for (let index = 0; index < paths.length; index += 100) {
      const result = await storage.from(bucket).remove(paths.slice(index, index + 100));
      if (result.error) throw new Error('Image cleanup needs retrying.');
    }
  }
}
