import { authenticated, checked, corsHeaders, allowedOrigin, json, serviceClient } from '../_shared/server.ts';

Deno.serve(async req => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: allowedOrigin(req) ? 204 : 403, headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, headers);
  if (!allowedOrigin(req)) return json({ error: 'Origin not allowed.' }, 403, headers);
  const db = serviceClient();
  let reservation: { user_id: string; token: string } | null = null;
  let deleted = false;
  try {
    const actor = await authenticated(req, db);
    const reader = req.body?.getReader();
    if (!reader) throw new Error('Choose a user.');
    let bodyText = '';
    const decoder = new TextDecoder();
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); return json({ error: 'Request too large.' }, 413, headers); }
      bodyText += decoder.decode(value, { stream: true });
    }
    bodyText += decoder.decode();
    const body = JSON.parse(bodyText);
    if (body.action !== 'remove' || typeof body.email !== 'string' || typeof body.user_id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) throw new Error('Choose a user and confirm their email.');
    reservation = await checked(await db.rpc('prepare_user_removal', { p_actor_id: actor.id, p_user_id: body.user_id, p_email: body.email }));
    if (!reservation) throw new Error('Unable to reserve account removal.');
    const { error } = await db.auth.admin.deleteUser(reservation.user_id);
    // An interrupted request can have deleted Auth already but still need cleanup.
    if (error && error.status !== 404 && error.code !== 'user_not_found') throw new Error('Account removal failed. The user may own stored files. Reassign those files and try again.');
    deleted = true;
    await checked(await db.rpc('finish_user_removal', { p_user_id: reservation.user_id, p_token: reservation.token }));
    return json({ removed: true }, 200, headers);
  } catch (error) {
    if (reservation && !deleted) {
      const canceled = await db.rpc('finish_user_removal', { p_user_id: reservation.user_id, p_token: reservation.token, p_cancel: true });
      if (canceled.error) console.error('User removal cancellation failed', canceled.error.code);
    }
    const message = error instanceof Error ? error.message : '';
    console.error('User removal failed', message);
    const safe = /^(Sign in|Choose a user|Administrator |You cannot|User not found|The confirmation|Reassign this|Removal is already|Account removal failed)/.test(message);
    return json({ error: deleted ? 'The account was removed, but access cleanup needs retrying. Please retry this removal.'
      : safe ? message : 'Unable to remove this user. Refresh the directory and try again.' }, 400, headers);
  }
});
