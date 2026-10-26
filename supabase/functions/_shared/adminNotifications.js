import { textEmailHtml } from './emailBranding.js';
import { verificationEmail } from './claimNotifications.js';

export const adminNotificationRecipient = verificationEmail;
const kinds = { claims: ['ownership claim', 'Ownership claim pending'], 'listing-requests': ['listing request', 'Listing request pending'], locations: ['map location', 'Map location needs review'] };
export function adminNotificationEmail(job, { from, siteUrl }) {
  if (!kinds[job.kind]) throw new Error('Unknown admin notification kind.');
  const origin = new URL(siteUrl);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Invalid site URL.');
  const review = new URL('/admin', origin.origin); review.searchParams.set('section', job.kind);
  const title = kinds[job.kind][1];
  const text = [`A new ${kinds[job.kind][0]} needs attention in Little Herb Places.`, `Place: ${job.place_name}`, `Submitted: ${job.created_at}`, `Review: ${review.href}`, 'Sign in with an administrator account to review the item. This email does not grant access.'].join('\n\n');
  return { from, to: [adminNotificationRecipient], subject: `${title}: ${job.place_name}`.replace(/[\r\n]/g, ' ').slice(0, 200), text, html: textEmailHtml(title, text) };
}
export async function dispatchAdminNotifications({ database, apiKey, from, siteUrl, fetchImpl = fetch }) {
  if (!apiKey || !from || !siteUrl) throw new Error('Admin email delivery is not configured.');
  if (!['https:', 'http:'].includes(new URL(siteUrl).protocol)) throw new Error('Invalid site URL.');
  const { data: jobs, error } = await database.rpc('take_admin_notifications', { p_limit: 10 });
  if (error) throw new Error('Unable to load admin notifications.');
  let sent = 0; let failed = 0;
  for (const job of jobs || []) {
    let emailId = null;
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `place-admin/${job.id}` },
        body: JSON.stringify(adminNotificationEmail(job, { from, siteUrl })),
      });
      if (!response.ok) throw new Error('Email delivery failed.');
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('No message ID.');
      emailId = result.id;
    } catch { /* Keep the durable job for retry without exposing private details. */ }
    const finished = await database.rpc('finish_admin_notification', { p_id: job.id, p_lease_token: job.lease_token, p_email_id: emailId });
    if (emailId && !finished.error) sent++; else failed++;
  }
  return { sent, failed };
}
