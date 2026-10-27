// Server-side feasibility adapter. It is not enabled by the report worker yet.
// Never import this client into the browser or return the account-wide response.
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const total = value => Number.isSafeInteger(value) && value >= 0;
const rows = value => Array.isArray(value) ? value.filter(row => typeof row.value === 'string' && total(row.pageviews)).slice(0,10).map(row => ({ name:row.value.slice(0,200),pageviews:row.pageviews })) : [];

export function listingTrafficUrl({ slug, start, endExclusive }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '') || slug.length > 200) throw new Error('Invalid listing slug.');
  if (!isoDate(start) || !isoDate(endExclusive) || start >= endExclusive) throw new Error('Invalid traffic period.');
  const end = new Date(Date.parse(`${endExclusive}T00:00:00Z`)-86400000).toISOString().slice(0,10);
  const url = new URL('https://simpleanalytics.com/littleherbplaces.com.json');
  url.search = new URLSearchParams({version:'6',fields:'pageviews,referrers,utm_sources,device_types',start,end,timezone:'UTC',limit:'10',pages:`/place/${slug},/place/${slug}/`}).toString();
  return url;
}

export async function fetchListingTraffic({ apiKey, slug, start, endExclusive, fetchImpl=fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sa_api_key_')) throw new Error('A server-side Simple Analytics API key is required.');
  const url = listingTrafficUrl({slug,start,endExclusive});
  const response = await fetchImpl(url.href,{headers:{'Api-Key':apiKey,Accept:'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});
  if (!response.ok) throw new Error(`Simple Analytics traffic is unavailable (HTTP ${response.status}).`);
  const data = await response.json();
  if (data.ok === false || !total(data.pageviews)) throw new Error('Simple Analytics did not return a valid listing total.');
  return {source:'simpleanalytics',start,end_exclusive:endExclusive,pageviews:data.pageviews,referrers:rows(data.referrers),utm_sources:rows(data.utm_sources),device_types:rows(data.device_types)};
}
