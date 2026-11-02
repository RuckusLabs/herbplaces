import test from 'node:test';
import assert from 'node:assert/strict';
import { createBusinessJourneyHandler } from '../../supabase/functions/_shared/businessJourney.js';
import { activityAdvice } from '../../supabase/functions/_shared/activityAdvice.js';
import { readableReportRange } from '../utilities/activityAdvice.js';
import { localVisitGuide } from '../utilities/browse.js';

const event = () => ({ action: 'event', event_id: crypto.randomUUID(), session_id: crypto.randomUUID(), kind: 'plan_view', plan: 'bloom', entry: 'existing', device: 'mobile' });
const application = () => ({ action: 'pilot', request_id: crypto.randomUUID(), business: 'Moss Apothecary', email: 'Owner@Example.com', website: 'https://example.com', goal: 'Help people discover our monthly tea workshops.', company: '' });
const request = (body, headers = {}) => new Request('https://example.test/business-journey', { method: 'POST', headers: { Origin: 'https://littleherbplaces.com', 'x-forwarded-for': '192.0.2.123', ...headers }, body: JSON.stringify(body) });

test('business measurement rejects untrusted origins, arbitrary metadata and client payment milestones', async () => {
  const records = [];
  const handler = createBusinessJourneyHandler({ origins: ['https://littleherbplaces.com'], secret: 'local-test-secret', recordEvent: async params => records.push(params), saveApplication: async () => {} });
  for (const [body, headers, expected] of [[event(), { Origin: 'https://untrusted.test' }, 403], [{ ...event(), email: 'private@example.com' }, {}, 400], [{ ...event(), kind: 'subscription_active' }, {}, 400], [event(), { DNT: '1' }, 200], [event(), { 'User-Agent': 'HeadlessChrome' }, 200]]) assert.equal((await handler(request(body, headers))).status, expected);
  assert.equal(records.length, 0);
  assert.equal((await handler(request(event()))).status, 200);
  assert.equal(records.length, 1);
  assert.equal(records[0].p_hash.length, 64);
  assert.ok(!JSON.stringify(records).includes('192.0.2.123'));
  assert.ok(!JSON.stringify(records).includes('example.com'));
});

test('removed pilot intake and retired plan labels are rejected without writes', async () => {
  let called = false;
  const handler = createBusinessJourneyHandler({ origins: ['https://littleherbplaces.com'], secret: 'local-test-secret', recordEvent: async () => { called = true; } });
  assert.equal((await handler(request(application()))).status, 400);
  assert.equal((await handler(request({ ...event(), plan: 'thrive' }))).status, 400);
  assert.equal(called, false);
});

test('activity advice selects a useful editor action and readable dates without inferring revenue', () => {
  const current = { current: { profile_view: 10, primary_click: 2 } };
  const profile = { content: { primary_action: { url: 'https://example.com/shop' }, announcement: { title: 'Old offer', expires_at: '2026-09-01T00:00:00Z' } } };
  assert.equal(activityAdvice(current, profile, Date.parse('2026-10-29')).target, 'announcement');
  assert.match(activityAdvice(current, profile, Date.parse('2026-10-29')).text, /expired/);
  assert.equal(activityAdvice(current, null).target, 'action');
  assert.equal(activityAdvice({ current: {} }, { content: { primary_action: { url: 'https://example.com' } } }).target, 'share');
  assert.equal(readableReportRange('2026-09-28', '2026-10-27'), 'September 28, 2026 – October 27, 2026');
});

test('server feature flags can close measurement independently of the browser', async () => {
  let called = false;
  const handler = createBusinessJourneyHandler({ origins: ['https://littleherbplaces.com'], secret: 'local-test-secret', eventsEnabled: false, applicationsEnabled: false, recordEvent: async () => { called = true; }, saveApplication: async () => { called = true; } });
  assert.equal((await handler(request(event()))).status, 503);
  assert.equal((await handler(request(application()))).status, 400);
  assert.equal(called, false);
});

test('local visit guides use real categories and never imply inventory or opening times', () => {
  const guide = localVisitGuide({ city: 'Austin', places: [{ category_ids: ['shops'] }, { category_ids: ['shops','workshops'] }, { category_ids: ['gardens'] }] });
  assert.deepEqual(guide.map(item => [item.id, item.count]), [['shops',2], ['gardens',1], ['workshops',1]]);
  assert.ok(guide.every(item => item.href.includes('q=Austin')));
  assert.deepEqual(localVisitGuide({ places: [] }), []);
});
