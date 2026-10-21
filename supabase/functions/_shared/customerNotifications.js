import { verificationEmail } from './claimNotifications.js';

export function customerNotificationEmail(job, { from, siteUrl }) {
  const origin = new URL(siteUrl);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Invalid site URL.');
  const details = job.payload;
  const account = new URL('/favorites#my-places', origin.origin).href;
  const requests = new URL('/request-place', origin.origin).href;
  const listing = details.place_slug ? new URL(`/place/${encodeURIComponent(details.place_slug)}`, origin.origin).href : '';
  const messages = {
    claim_received: ['We received your ownership claim', `Thanks for requesting access to ${details.place_name}. Our team will review your connection to the business. No payment has been taken.`, `Follow your claim: ${account}`],
    claim_approved: ['Your ownership claim is approved', `Your connection to ${details.place_name} has been approved. Sign in to My Places to check subscription availability and start editing when Bloom is active. No subscription has been started by this approval.`, `Continue: ${account}`],
    claim_rejected: ['An update on your ownership claim', `We couldn’t approve your current claim for ${details.place_name}. Read the review note below, then submit updated details or contact us for help.`, `Review your claim: ${account}`],
    listing_received: ['We received your listing request', `Thanks for suggesting ${details.place_name}. Our team will check the details and review it for the directory. This request does not grant management access or start a subscription.`, `Follow your request: ${requests}`],
    listing_reviewed: [details.status === 'listed' ? 'Your requested place is in the directory' : 'An update on your listing request', details.status === 'listed' ? `${details.place_name} is now available in the directory. If you own or manage the business, open the listing to submit an ownership claim. If it already has a manager, contact us for access.` : `We couldn’t add ${details.place_name} from this request. Read the review note below for details.`, `Review your request: ${requests}`],
    listing_admin: ['New listing request', `Place: ${details.place_name}\nLocation: ${details.city}, ${details.region}\nWebsite: ${details.website}\nAccount: ${details.account_email}\nDetails: ${details.notes}`, `Review requests: ${new URL('/admin', origin.origin).href}`],
  };
  const message = messages[job.kind];
  if (!message) throw new Error('Unknown notification kind.');
  if (job.kind !== 'listing_admin' && (typeof details.account_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.account_email))) throw new Error('Invalid notification recipient.');
  return {
    from, to: [job.kind === 'listing_admin' ? verificationEmail : details.account_email],
    subject: `${message[0]}: ${details.place_name}`.replace(/[\r\n]/g, ' ').slice(0, 200),
    text: [message[1], details.review_note && `Review note:\n${details.review_note}`, message[2], listing && `Place: ${listing}`, 'Questions? Email help@littleherbplaces.com.'].filter(Boolean).join('\n\n'),
  };
}

export async function dispatchCustomerNotifications({ database, apiKey, from, siteUrl, fetchImpl = fetch }) {
  if (!apiKey || !from || !siteUrl) throw new Error('Customer notification email is not configured.');
  if (!['https:', 'http:'].includes(new URL(siteUrl).protocol)) throw new Error('Invalid site URL.');
  const { data: jobs, error } = await database.rpc('take_customer_notifications', { p_limit: 10 });
  if (error) throw new Error('Unable to load customer notifications.');
  let sent = 0; let failed = 0;
  for (const job of jobs || []) {
    let emailId = null;
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `place-customer/${job.id}` },
        body: JSON.stringify(customerNotificationEmail(job, { from, siteUrl })),
      });
      if (!response.ok) throw new Error('Email delivery failed.');
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('No message ID.');
      emailId = result.id;
    } catch { /* Retry through the durable queue without logging private details. */ }
    const finished = await database.rpc('finish_customer_notification', { p_id: job.id, p_lease_token: job.lease_token, p_email_id: emailId });
    if (emailId && !finished.error) sent++; else failed++;
  }
  return { sent, failed };
}
