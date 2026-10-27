# Business growth rollout

This release keeps the existing $19 Bloom billing integration. Paid Thrive checkout stays closed. No existing customer is charged or moved to another plan.

## Release order

1. Apply `supabase/migrations/202610270001_business_growth.sql` to the intended environment after all preceding migrations. It adds growth profiles, pilot access, activity data, and private reporting RPCs. Existing place IDs retain their native type.
2. Enable pg_cron and run `supabase/setup-business-growth.sql`. This installs daily 90-day activity retention and connects growth edits to the existing website rebuild queue if available.
3. Deploy `place-activity`. Configure `ACTIVITY_HASH_SECRET` with a randomly generated value of at least 32 characters. Use the existing `SITE_URL`, `ALLOWED_ORIGINS`, and Supabase server configuration. Never place service keys or the hashing secret in a frontend environment file.
4. Verify that public visitors can read only public profiles; an owner can read only their own report; an unpaid owner can correct essential details; Bloom cannot publish offerings; and an admin can grant and end a Thrive pilot.
5. Set repository variable `VITE_GROWTH_ENABLED=true` and rebuild the frontend. Use the same setting locally for previews. Leave it false until the migration, endpoint, and retention schedule are ready. `VITE_BLOOM_ENABLED` continues to control Bloom checkout independently.
6. Inspect static `/browse/`, a city/category page, a listing, and an offering/event page with JavaScript disabled. Verify canonicals and sitemap URLs. Inspect representative URLs in Search Console and submit the updated sitemap.

The schema, activity endpoint, reporting functions, and scheduled cleanup were deployed to the hosted project on October 27, 2026 after a private backup. The matching frontend release is being published through a separate release branch. Apply the release steps to other environments separately. Rolling the feature flag back hides the new tools and stops browser activity collection without removing existing listings or canceling subscriptions.

## What owners receive

Sprout remains the free community plan for saving places. Businesses can request listings, claim ownership, and correct address, phone, hours, and operating status for free. Other free corrections remain available through support.

Bloom: richer story and photo management, all approved managers, a main customer action, specialties, language and access information, one scheduled/expiring announcement or seasonal offer, profile completion guidance, and a report covering the last 30 calendar days. The current day is partial. Owners can compare the preceding 30 days and export daily counts.

Thrive pilot: Bloom editing and growth tools, up to 10 products/services and 10 events, searchable discovery pages, direct external purchase/booking/registration links, and per-item click counts. Admins grant access for a maximum of 90 days at a time. Access ends automatically; published content remains visible, while ended events and expired announcements leave current displays.

Monthly summaries are available in the dashboard. Optional automated monthly email reports are implemented behind a separate release flag; see the monthly report release steps below. Announcement expiry reminders appear in business tools. Booking calendars, customer checkout, order fulfillment, coupon redemption reporting, and guaranteed promotional placements are not included.

## Activity interpretation and privacy

Record profile views, website clicks, directions clicks, phone-link clicks, main actions, announcement clicks, offering clicks, and registration-link clicks. These are actions, not confirmed visits, customers, calls, sales, or conversion revenue.

The browser avoids recording managers' own listing activity, honors Do Not Track, and suppresses repeated profile views in a tab. The endpoint filters recognized bot user agents and restricts origins. Database writes are service-only. A keyed hash of IP and UTC date supports repeat/rate filtering; raw IP addresses and full link destinations are not stored in activity records. Shared networks and blocking tools can affect counts. The infrastructure provider may retain separate request logs. Anonymous counts are not independently verified attribution.

Review the gateway's forwarded-IP configuration before enabling collection. Rotate the hashing secret through the server's secret store. Daily retention must remain operational. No newsletter subscriptions are created by these tools.

## First five-business pilot

Recruit only after the release checks pass. Agree each pilot's start/end date, offerings, and feedback expectations directly with the owner before granting access. Grant access in Admin → place administration → Thrive pilot access. No pilot invitation or customer email is sent automatically.

Use a small mix of a retail herb shop, consultation practice, workshop provider, and businesses with an active online shop. Start with an owner who can publish real content and respond to feedback.

For each business, capture:

| Measure | Baseline / week 1 | Day 30 | Day 60 |
| --- | --- | --- | --- |
| Profile complete | | | |
| At least one live offering or event | | | |
| Profile views / main-action clicks | | | |
| Offering / registration-link clicks | | | |
| Owner-reported useful inquiries (self-reported) | | | |
| Time spent setting up and providing support | | | |
| Owner willingness to renew at $49 | | | |

For an assisted setup pilot, agree a bounded session and a maximum number of deliverables before work begins. A practical test scope is one profile, selected existing photos, up to three offerings, and one upcoming event. Agree any one-time price separately; no setup fee is charged by the site. Measure the support time before including assistance in a recurring plan.

Do not infer bookings or sales from clicks. Ask owners what the directory helped them accomplish and whether that makes $49 worthwhile. Keep $19/$49 unchanged while testing the package. Evaluate actual paid renewal cohorts once paid Thrive is deliberately launched; pilot participation is not evidence of paid retention.

## Promotion and upsell decisions

The release supplies organic discovery via offering/event pages and seasonal announcements. Sponsored spotlight inventory and newsletter placements remain unsold until audience and capacity are known.

Before selling a spotlight, define the surface, labeled sponsored treatment, rotation length, maximum concurrent businesses, geographic/category eligibility, reporting, and remedy for a missed placement. Display those exact deliverables before checkout. Keep ownership verification separate from payment. Do not treat the existing editorial Featured badge as paid inventory.

Before selling newsletter coverage, verify subscriber permission, recent delivered audience and link engagement, editorial capacity, and available placement dates. Sell a specific deliverable rather than unsubstantiated reach. Additional newsletters or paid promotions require a separate implementation and terms review.

## Remaining external verification

- Search Console: indexing, queries, sitemap processing, canonical selection, and real search demand.
- Core Web Vitals: mobile field data, including listing galleries and map loading.
- Accessibility: manual screen-reader coverage of claims, billing, forms, maps, new editors, and reports; 200%/400% zoom; keyboard navigation and touch target spacing. Automated checks do not certify WCAG conformance.
- Billing: existing Bloom sandbox regression before release; no new Stripe product/price or subscription change is needed for the invitation-only pilot.


## Monthly email report release

1. Apply `202610270002_activity_email_reports.sql` after the growth migration. Preferences default to off. Each approved manager controls their own place-specific report preference.
2. Deploy `activity-reports` and `activity-report-unsubscribe`. Configure `ACTIVITY_REPORT_SECRET` with a random value of at least 32 characters, keep `ACTIVITY_REPORTS_ENABLED=false` while verifying configuration, and reuse the verified Resend sender, API key, and `SITE_URL`. A clearly labeled sample report was delivered only to the owner-authorized admin test address; no customer was automatically enrolled.
3. Preview the branded email and test with an explicit consenting test recipient in a non-production environment. Check unsubscribe GET (redirects to the website confirmation) and HEAD (read-only), the signed-out website confirmation POST, and RFC 8058 one-click POST. The unsubscribe endpoint must remain available if report sending is paused.
4. Configure Vault entries `activity_report_url` and `activity_report_secret`, then run `supabase/setup-activity-email-reports.sql`. Its five-minute wakeup queues one report per opted-in manager/place/completed UTC calendar month and processes bounded retry batches; it does not send a report every five minutes.
5. Enable server flag `ACTIVITY_REPORTS_ENABLED=true` and frontend repository variable `VITE_ACTIVITY_REPORTS_ENABLED=true` only after verification. `VITE_GROWTH_ENABLED` must also be true for report preferences to appear. No existing customer is automatically opted in.
6. Verify the first completed-month delivery and monitor failed jobs. The owner UI exposes queued, sent, stopped, or needs-attention status. Retries stop after eight attempts or 23 hours from the first attempt, before the delivery provider's idempotency window ends. Review delivery failures instead of blindly requeuing old sends.

Report snapshots contain aggregate metrics, the verified delivery address, and a place-specific unsubscribe token. They stay stable across retries. The worker rechecks opt-in, membership, paid/pilot eligibility, and current verified email just before delivery. Changing the verified email after an attempt suppresses the old report instead of disclosing it to an outdated address. Membership removal cascades report preferences and queued jobs. A report already in flight can still arrive after opting out.

Completed-month email comparisons and the rolling 30-day dashboard use different date windows, explicitly labeled in each. Collection start and blockers affect counts. The emails do not equate clicks with sales or bookings.

### Bloom availability verification — October 27, 2026

Production repository variable `VITE_BLOOM_ENABLED` and Supabase server flag `BLOOM_ENABLED` both verified true, with successful recent deployments. The local `.env.local` flag was false; it has been aligned with production so the local preview does not label Bloom as coming soon. No production flag, price, subscription, or payment was changed, and no charge or checkout session was created for this verification.

### Hosted reporting verification — October 27, 2026

The owner authorized deployment and a recap to the owner-authorized admin inbox. The existing confirmed admin account was used with a clearly labeled disposable listing and sample activity; no additional account was created. Resend reported the sample email delivered. A repeat dispatch sent no duplicate. Report preference defaults, no historical send for a new opt-in, allowed-origin collection, Do Not Track, scanner-safe links, and one-click unsubscribe were checked against the hosted services. All 187 original listing rows were compared with the pre-release snapshot and retained unchanged; the fixture, membership, pilot, preference, activity, and report job were removed. The protected temporary provider-status checker was removed afterward.

The live test found that the function host serves HTML as plain text. Human unsubscribe links now open `/reports/unsubscribe` on the website; legacy function links redirect there. The confirmation works without signing in and changes preferences only after an explicit button press. Email-client one-click headers continue to POST directly to the service. A real scheduler invocation returned successfully with no pending recipients. Collection and email-history retention schedules are active. No real business has been enrolled in a pilot or opted into reports.
