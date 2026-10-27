import { brandedEmail, escapeEmailHtml } from './emailBranding.js';

const metricNames = { profile_view: 'Profile views', website_click: 'Website clicks', directions_click: 'Direction clicks', phone_click: 'Phone-link clicks', primary_click: 'Main action clicks', announcement_click: 'Announcement clicks', offering_click: 'Offering clicks', event_click: 'Registration-link clicks' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const count = value => { const number = Number(value || 0); if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid activity total.'); return number; };
const date = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) throw new Error('Invalid report period.'); return new Date(`${value}T00:00:00Z`); };
const reportDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const reportPeriod = (start, end) => reportDateFormat.formatRange(date(start), new Date(date(end).getTime() - 86400000)).replace(/[\u2009\u202f]/g, ' ');

export function activityReportEmail(job, { from, siteUrl, unsubscribeUrl }) {
  const p = job.payload;
  if (!p || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.account_email || '') || !uuid.test(p.unsubscribe_token || '')) throw new Error('Invalid report recipient.');
  const site = new URL(siteUrl); const unsubscribe = new URL(unsubscribeUrl);
  if (site.protocol !== 'https:' || unsubscribe.protocol !== 'https:') throw new Error('Use HTTPS report links.');
  unsubscribe.searchParams.set('token', p.unsubscribe_token);
  const preference = new URL('/reports/unsubscribe', site.origin);
  preference.searchParams.set('token', p.unsubscribe_token);
  const dashboard = new URL('/my-places', site.origin).href;
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date(p.period_start));
  if (date(p.period_start) >= date(p.period_end)) throw new Error('Invalid report period.');
  const keys = Object.keys(metricNames).filter(key => p.plan === 'Thrive pilot' || !['offering_click','event_click'].includes(key));
  const metrics = keys.map(key => ({ label: metricNames[key], current: count(p.current?.[key]), previous: count(p.previous?.[key]) }));
  date(p.previous_start);
  const previousPeriod = reportPeriod(p.previous_start, p.period_start);
  const period = reportPeriod(p.period_start, p.period_end);
  const items = (p.items || []).slice(0,5).map(item => ({ title: String(item.title || 'Previously published item'), total: count(item.total), label: item.kind === 'event_click' ? 'registration-link clicks' : 'offering clicks' }));
  const note = 'These are recorded actions, not unique visitors, completed calls, bookings, or sales. Tracking blockers and when collection started can affect counts.';
  const next = count(p.current?.profile_view) === 0 ? 'No profile views were recorded this month. Check your profile details and share your listing with your community.' : count(p.current?.primary_click) === 0 ? 'People explored your profile. Try a clear main action linked to your booking page, online shop, or current classes.' : 'Your main action received interest. Keep its destination current and give people a timely reason to return.';
  const text = [`${month} at ${p.place_name}`, `${p.plan} business activity · ${period} (UTC)`, `Previous month: ${previousPeriod}.`,
    ...metrics.map(metric => `${metric.label}: ${metric.current} (previous month: ${metric.previous})`),
    ...(items.length ? ['Interest in your offerings and events:', ...items.map(item => `${item.title}: ${item.total} ${item.label}`)] : []), note, next, `View your report and profile tools: ${dashboard}`, `Stop monthly reports for this place: ${preference.href}`, 'You opted into these business reports. Community newsletter preferences are separate.'].join('\n\n');
  const rows = metrics.map(metric => `<tr><th scope="row" style="padding:12px 8px;text-align:left;border-bottom:1px solid #dce5d1;font-weight:400">${escapeEmailHtml(metric.label)}</th><td style="padding:12px 8px;text-align:right;border-bottom:1px solid #dce5d1">${metric.current}</td><td style="padding:12px 8px;text-align:right;border-bottom:1px solid #dce5d1">${metric.previous}</td></tr>`).join('');
  const body = `<p>${escapeEmailHtml(p.place_name)} · ${escapeEmailHtml(p.plan)}</p><p>${period} · UTC<br>Previous month: ${previousPeriod}.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><caption style="text-align:left;font-weight:bold;padding:12px 0">Your recorded activity</caption><thead><tr><th scope="col" style="text-align:left;padding:8px">Action</th><th scope="col" style="text-align:right;padding:8px">This month</th><th scope="col" style="text-align:right;padding:8px">Previous</th></tr></thead><tbody>${rows}</tbody></table>${items.length ? `<h2 style="font-size:20px;font-weight:400">What people explored</h2><ul>${items.map(item => `<li>${escapeEmailHtml(item.title)}: ${item.total} ${item.label}</li>`).join('')}</ul>` : ''}<p style="font-size:13px;line-height:1.7">${note}</p><p style="padding:18px;background:#f2f8df;border-radius:12px">${next}</p><p><a href="${dashboard}" style="display:inline-block;padding:12px 20px;background:#eaff82;color:#2c542f;border-radius:20px;text-decoration:none;font-weight:bold">Open Your Business Tools</a></p><p style="font-size:12px;line-height:1.7">You opted into reports for this place. <a href="${escapeEmailHtml(preference.href)}" style="color:#2c542f">Stop monthly business reports</a> or manage your preference in My Places. Community newsletter preferences are separate.</p>`;
  return { from, to: [p.account_email], subject: `${month} activity for ${p.place_name}`.replace(/[\r\n]/g,' ').slice(0,200), text, html: brandedEmail({ title: `A little look at ${month}.`, bodyHtml: `<div style="overflow-wrap:anywhere">${body}</div>` }), headers: { 'List-Unsubscribe': `<${unsubscribe.href}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

export async function dispatchActivityReports({ database, apiKey, from, siteUrl, unsubscribeUrl, fetchImpl = fetch }) {
  if (!apiKey || !from || !siteUrl || !unsubscribeUrl) throw new Error('Business report delivery is not configured.');
  if ([siteUrl,unsubscribeUrl].some(value => new URL(value).protocol !== 'https:')) throw new Error('Use HTTPS report links.');
  const queued = await database.rpc('enqueue_activity_email_reports', { p_limit: 100 });
  if (queued.error) throw new Error('Unable to queue monthly reports.');
  const { data: jobs, error } = await database.rpc('take_activity_email_reports', { p_limit: 10 });
  if (error) throw new Error('Unable to lease monthly reports.');
  let sent = 0; let failed = 0; let skipped = 0;
  for (const lease of jobs || []) {
    let emailId = null;
    try {
      const prepared = await database.rpc('prepare_activity_email_report', { p_id: lease.id, p_lease_token: lease.lease_token });
      if (prepared.error) throw new Error('Unable to verify report access.');
      if (!prepared.data) { skipped++; continue; }
      const response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `place-activity-report/${lease.id}` },
        body: JSON.stringify(activityReportEmail(prepared.data, { from, siteUrl, unsubscribeUrl })) });
      if (!response.ok) throw new Error('Report delivery failed.');
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('No delivery reference.');
      emailId = result.id;
    } catch { /* Durable retries retain the original payload and idempotency key. */ }
    const finished = await database.rpc('finish_activity_email_report', { p_id: lease.id, p_lease_token: lease.lease_token, p_email_id: emailId });
    if (emailId && !finished.error) sent++; else failed++;
  }
  return { sent, failed, skipped };
}

export function createActivityReportHandler({ secret, enabled, dispatch }) {
  return async request => {
    const reply = (value,status) => Response.json(value,{ status });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' },405);
    if (!secret || !enabled) return reply({ error: 'Monthly report delivery is not enabled.' },503);
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
    const [actual,expected] = await Promise.all([digest(request.headers.get('Authorization') || ''),digest(`Bearer ${secret}`)]);
    if (actual.reduce((result,value,index) => result | (value ^ expected[index]),0)) return reply({ error:'Unauthorized.' },401);
    try { const result=await dispatch(); return reply(result,result.failed ? 502 : 200); } catch { return reply({ error:'Unable to deliver monthly reports.' },503); }
  };
}

export function createReportUnsubscribeHandler({ unsubscribe, siteUrl, origins = [] }) {
  return async request => {
    const url = new URL(request.url); const token = url.searchParams.get('token') || '';
    const headers = { 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
    const origin = request.headers.get('Origin');
    headers.Vary = 'Origin';
    if (origin && !origins.includes(origin)) return new Response('Origin not allowed.',{ status:403,headers });
    if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' });
    if (request.method === 'OPTIONS') return new Response(null,{ status:origin ? 204 : 403,headers });
    if (!uuid.test(token)) return new Response('This report link is not valid.',{ status:400,headers });
    if (request.method === 'HEAD') return new Response(null,{ status:200,headers });
    if (request.method === 'GET') {
      try { const target = new URL('/reports/unsubscribe',siteUrl); if (target.protocol !== 'https:') throw new Error(); target.searchParams.set('token',token); return new Response(null,{ status:303,headers:{...headers,Location:target.href} }); }
      catch { return new Response('Manage monthly reports in My Places.',{status:503,headers}); }
    }
    if (request.method !== 'POST') return new Response('Method not allowed.',{ status:405,headers });
    try { await unsubscribe(token); return new Response(brandedEmail({ title:'Monthly reports stopped.',bodyHtml:'<p>You will not receive future monthly business reports for this place. Your membership and community newsletter preferences are unchanged.</p><p>You can turn reports back on in My Places.</p>' }),{ status:200,headers }); }
    catch { return new Response('We could not update the report preference. Please try again or manage reports in My Places.',{ status:503,headers }); }
  };
}
