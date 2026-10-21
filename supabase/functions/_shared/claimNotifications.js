export const verificationEmail = 'admin@littleherbplaces.com';

export function claimNotificationEmail(payload, { from, siteUrl }) {
  const origin = new URL(siteUrl);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Invalid site URL.');
  return {
    from, to: [verificationEmail],
    subject: `New place claim: ${payload.place_name}`.replace(/[\r\n]/g, ' ').slice(0, 200),
    text: [
      'A new ownership claim is ready for review.',
      `Place: ${payload.place_name}`,
      `Listing: ${new URL(`/place/${encodeURIComponent(payload.place_slug)}`, origin.origin).href}`,
      `Account email: ${payload.account_email}`,
      `Relationship: ${payload.relationship}`,
      `Submitted: ${payload.submitted_at}`,
      `Claim reference: ${payload.claim_id}`,
      `Supporting details:\n${payload.evidence}`,
      `Review this claim: ${new URL('/admin', origin.origin).href}`,
      'Sign in as an administrator to approve or reject the claim. Verify the business connection before approving.',
    ].join('\n\n'),
  };
}

export async function dispatchClaimNotifications({ database, apiKey, from, siteUrl, fetchImpl = fetch }) {
  // Validate configuration before leasing jobs; missing secrets do not consume retries.
  if (!apiKey || !from || !siteUrl) throw new Error('Claim notification email is not configured.');
  if (!['https:', 'http:'].includes(new URL(siteUrl).protocol)) throw new Error('Invalid site URL.');
  const { data: jobs, error } = await database.rpc('take_claim_notifications', { p_limit: 10 });
  if (error) throw new Error('Unable to load claim notifications.');
  let sent = 0;
  let failed = 0;
  for (const job of jobs || []) {
    let emailId = null;
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `place-claim/${job.claim_id}` },
        body: JSON.stringify(claimNotificationEmail(job.payload, { from, siteUrl })),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('Email provider returned no message ID.');
      emailId = result.id;
    } catch { /* Leave the notification available for a later retry. */ }
    const finished = await database.rpc('finish_claim_notification', {
      p_claim_id: job.claim_id, p_lease_token: job.lease_token, p_email_id: emailId,
    });
    if (emailId && !finished.error) sent++;
    else failed++;
  }
  return { sent, failed };
}

export function createClaimNotificationHandler({ secret, dispatch }) {
  return async request => {
    const respond = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
    if (!secret) return respond({ error: 'Claim notifications are not configured.' }, 503);
    // Only the database webhook and scheduler receive this server-side secret.
    const supplied = request.headers.get('Authorization') || '';
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [actual, expected] = await Promise.all([digest(supplied), digest(`Bearer ${secret}`)]);
    if (actual.reduce((difference, value, index) => difference | (value ^ expected[index]), 0) !== 0) return respond({ error: 'Unauthorized.' }, 401);
    try {
      // Ignore webhook bodies: load authoritative, privately queued claims instead.
      const result = await dispatch();
      return respond(result, result.failed ? 502 : 200);
    } catch { return respond({ error: 'Unable to deliver claim notifications.' }, 503); }
  };
}
