# Simple Analytics as the reporting foundation for Thrive

Assessment: October 27, 2026. The owner has confirmed they use the Free plan. Recommendation for launch: keep Simple Analytics for the operator's website overview and use our own activity collection and monthly reports for Bloom and Thrive. No Simple Analytics upgrade is needed for the implemented reporting flow. A future API integration is technically feasible, with Little Herb Places retaining business permissions, subscription checks, report snapshots, email preferences, and delivery. Analytics strengthens Thrive when combined with discoverable offerings and events; reporting alone is a weak reason to upgrade from Bloom.

## Verified capabilities

| Need | Fit | Implication for Thrive |
| --- | --- | --- |
| Traffic to an individual listing | Stats API supports exact page filters, date windows, and UTC | Query both trailing-slash variants of a verified listing URL. |
| Source and campaign reporting | Stats API exposes referrers and UTM dimensions | Show how people find a business here, rather than promising traffic or sales. |
| Booking, shop, offering, and event clicks | Custom events and metadata are supported; API v6 can filter events by metadata | Add a stable public listing/item reference; never send account emails, private ownership data, search text, or visitor identifiers. |
| Limited customer dashboards | Custom views can limit the visible data subset, on eligible plans | Possible for pilots; our own authenticated dashboard gives tighter control over billing access and branding. |
| Weekly/monthly emails | Native reports exist and compare periods | Useful for the site operator. Do not assume they are the correct place-scoped, branded customer-delivery system without testing. |
| Analytics for a business's own website | The platform guide supports customer-hostname scripts and optional events | A possible later Thrive benefit, but requires permission and installing the script on the business's website. |

Sources: [Stats API](https://docs.simpleanalytics.com/api/stats), [metadata](https://docs.simpleanalytics.com/metadata), [custom views](https://docs.simpleanalytics.com/custom-views), [email reports](https://docs.simpleanalytics.com/email-reports), [platform integration](https://docs.simpleanalytics.com/explained/platform-integration).

## Current integration and account access

The existing website already loads the Simple Analytics script. The code reviewed does not yet send the new business-action events to Simple Analytics. Historical website traffic therefore must not be represented as historical booking/shop/action counts.

A read-only request for `littleherbplaces.com` returned HTTP 400 with “No Api-Key found, specify via header.” This verifies that the intended API access is not publicly available; it does not establish the account's purchased plan or available history. No API key was collected, no plan was changed, and no data was exported from the account.

API keys require an active trial or a plan with API access, belong to the user, and should remain server-side. Confirm the current account's entitlement before connecting the prototype. See [API authentication](https://docs.simpleanalytics.com/api/authenticate).

The documented free plan retains only 30 days of history, which is insufficient to query two completed calendar months directly. Daily snapshots could preserve future aggregates if permitted API access is verified, but cannot recover history already deleted. The authentication documentation requires a trial or API-enabled plan; the free-plan error documentation also describes API lockouts, so do not infer this account's API entitlement from the Free label alone. See [pricing](https://www.simpleanalytics.com/pricing), [API authentication](https://docs.simpleanalytics.com/api/authenticate), and [Stats API errors](https://docs.simpleanalytics.com/api/stats).

Keep the optional adapter disconnected for now. The implemented first-party reports do not require a Simple Analytics key or paid plan. Traffic-source and campaign reporting remain future capabilities, not included in the current email implementation. Any later API integration needs account access, retention, request-volume, and cost verification. Do not assume one Simple Analytics seat per subscriber is economical; see [team roles](https://docs.simpleanalytics.com/explained/team-roles).

## Recommended design

1. Keep verified ownership, Bloom/Thrive entitlements, and report opt-in in Supabase.
2. The server derives the authorized business's public URL from our database. It queries only that listing and its approved item references. Do not accept arbitrary analytics filters from a browser.
3. Fetch exact-period statistics through the Stats API. Cache one snapshot per place/month, shared across approved recipients, to control API volume and preserve a stable emailed report.
4. Use our branded, optional monthly delivery flow. Never share an account-wide API key, public dashboard link, or unsanitized account response with business managers.
5. Reconcile one pilot business against the Simple Analytics dashboard using identical dates, timezone, and metric definitions before making it the source of truth.

A server-only, tested feasibility adapter is included at `supabase/functions/_shared/simpleAnalytics.js`. It uses API version 6, exact listing paths, UTC completed-period dates, header-only credentials, and a restricted response shape. It treats failed or missing statistics as unavailable, not zero traffic. The report worker does not call it; the deployed report worker uses our first-party action totals. A sample recap was delivered only to the owner-authorized admin address; customers remain opted out by default.

If Simple Analytics becomes the main event source, choose one canonical collection path and avoid sending an action twice. Compare its bot filtering, privacy controls, and counting semantics with the current first-party collector. Do not blend the two providers into a single unlabeled count or forward raw visitor IPs through a new integration.

## What to sell

Bloom: a useful profile, clear customer action, basic activity summary, and optional monthly email.

Thrive: discoverable products/services and events, item-level interest, traffic sources and campaign trends, plus a concise next-step recommendation. In a later phase, explore a connected business-website report for owners who explicitly authorize the script installation. This could provide value even while directory traffic is modest.

Avoid claiming proven revenue, search rankings, booked appointments, or unique customers. Traffic-source reporting describes visits to Little Herb Places pages; it does not cover the business's whole website unless that separate site is integrated.

Native reports or custom views may speed up a very small pilot, but our delivery flow already handles place-specific consent, unsubscribe, membership changes, and delayed-send safety. Launch with the first-party reports while keeping the Free Simple Analytics account. Reassess the Stats API as an optional enrichment after account access and cost verification.
