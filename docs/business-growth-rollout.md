# Bloom and free maps: combined release

This branch reconciles the prepared frontend and backend work against current main. It is a draft for review. No hosted migration, function deployment, merge, customer email, or payment is authorized by opening this PR.

## Product scope

Bloom remains $19 USD/month per place plus applicable tax, using the existing Stripe price, checkout, subscription lifecycle, grace period, and customer portal. Existing tax collection settings remain in place. There is no new Stripe product, price, or plan switch.

The separate Thrive offer and pilot application/access flows are retired. Bloom includes the existing story, up to 10 photos, customer action, announcement, specialties/access details, up to 10 products or services, up to 10 workshops or events, public discovery pages, item activity insights, rolling 30-day reports/CSV, and optional monthly emails. Checkout, booking, and registration for a business's customers happen on that business's external website. No promised promotional placements or guaranteed sales are included.

Approved ownership is still required. Essential visit/contact corrections remain free. Paid editing requires a confirmed approved manager and the existing paid subscription eligibility; administrators retain maintenance access. Cancellation or loss of eligibility pauses editing and reports, while published content remains visible under existing rules. Legacy pilot database rows are retained as history and confer no access. The old grant RPC is removed. `can_thrive` is returned only as a temporary compatibility alias for an older frontend during backend-first rollout; the new client uses `can_manage_offerings`. Deployed migration files remain immutable history.

## Separately authorized rollout order

1. Confirm current hosted migration history. The October 27 growth and monthly-report migrations are already deployed; do not run them twice.
2. Apply the new `202610290001_business_journey.sql` then `202611020001_bloom_advanced_features.sql` after those existing migrations. The first adds optional anonymous interest and committed system milestone records, with private admin totals. The second enables advanced tools for paid Bloom, removes pilot grants, and updates paid email eligibility and item snapshots. Apply and verify the backend before publishing frontend marketing that describes these tools.
3. Deploy updated `place-management` (unused geocoding parser cleanup) and `activity-reports` (Bloom item metrics and contextual advice) with existing settings. If desired, deploy `business-journey` with existing `ACTIVITY_HASH_SECRET` and explicit `ALLOWED_ORIGINS`. Its `BUSINESS_JOURNEY_ENABLED` flag defaults off. Reject old pilot requests; no application data is accepted.
4. Verify paid Bloom, canceled/expired, unconfirmed, unrelated, free manager, and administrator access using test fixtures. Confirm existing per-item limits, conflict protection, public projections, reports, and email opt-in/unsubscribe behavior. Do not enroll existing customers automatically or send customer test emails.
5. Publish the frontend only after authorization. Keep existing `VITE_GROWTH_ENABLED`, `VITE_ACTIVITY_REPORTS_ENABLED`, and `VITE_BLOOM_ENABLED` values appropriate to the deployed backend. Set `VITE_BUSINESS_JOURNEY_ENABLED=true` only after the optional endpoint is ready; it otherwise remains false. The admin page explains when measurement is disabled and still shows listing completeness.
6. Verify the free-map deployment, then complete the credential cleanup below. No merge or deployment is performed by this draft PR.

## Mapbox credentials for the owner to remove

- After the replacement frontend is live and verified, delete the GitHub Actions secret **`VITE_MAPBOX_TOKEN`** and revoke the site's old public tokens in the Mapbox account. Revocation also stops old cached/open builds from billing through those tokens.
- **`MAPBOX_GEOCODING_TOKEN`** was already removed from the hosted backend. Check and remove any remaining development, hosting, or CI copies. Keep **`AUTOMATIC_GEOCODING_ENABLED=false`** as a safeguard against older deployments.
- MapLibre/OpenFreeMap needs no account or API key. The new renderer allows map resources only from `tiles.openfreemap.org` and has no paid fallback. Changed/new addresses use manual admin coordinate review.
- Regression tests deliberately mention Mapbox and inject a legacy token to prove it is ignored. Transitive `@mapbox` open-source utility packages do not configure or call a metered service.

## Preserved and excluded work

Current main's directory entries/images, billing, opt-in reports, navigation recovery, pricing footnotes, and missing-photo rendering are preserved. The combined release includes mobile and Explore search cleanup, footer changes, hidden signup links, Garden spacing, marketing/onboarding improvements, owner checklists/advice, city guides, and admin completeness checks. Direct account registration and newsletter routes remain accessible to existing flows, but public signup links are hidden.

Alternate-logo research and bulk import/research artifacts are excluded. Existing backup workflows are unchanged.

## Measurement and report behavior

Business-interest events accept only fixed labels, random 30-minute tab-session references, and daily-changing keyed IP hashes. They honor Do Not Track and reject arbitrary metadata. Anonymous rows expire after 90 days when collection runs; add separately approved scheduled cleanup if strict wall-clock deletion is required. No names, search strings, full URLs, emails, or raw IP addresses enter those records.

System milestones come from committed claim, checkout, subscription, and owner-publish records; browser success pages cannot assert payment. Retries are deduplicated, with no historical backfill. Browser session totals and distinct-place stage totals are separate counts, not a joined conversion funnel or retention cohort.

Monthly email remains an explicit per-manager/place opt-in. Existing scheduling, verified recipients, membership/paid checks, stable retry payloads, bounded retries, scanner-safe confirmation, one-click unsubscribe, and retention remain in place. Reports measure recorded interest rather than sales, bookings, or unique visitors. The rolling dashboard and completed-calendar-month email have separately labeled windows.

## Local validation for this draft

- 198 unit/database tests passed, including paid Bloom access, unpaid/legacy-pilot denial, ten-item limits, cancellation preserving published items, monthly item snapshots, and existing billing boundaries.
- 244 desktop/mobile browser tests passed.
- Production map suite: 12 passed; two development-only camera instrumentation cases skipped (covered in the main browser run). Legacy-token and forbidden-Mapbox-request checks passed.
- Email-code sign-in production suite: 28 passed.
- Full static export generated 187 place cards, 11 site cards, static pages, sitemap, and robots from the existing public listing snapshot.
- Lint passed with the two pre-existing Fast Refresh warnings; whitespace checks passed.

These checks used local browser/database fixtures and a read-only directory snapshot. Hosted migrations, live email delivery, payment mutations, and deployment were not performed.


## Owner workspace follow-up

Business Tools & Activity now lives at `/business-tools`, linked from the owner account menu and each managed place in My Places. Overview, Listing & Highlights, Activity, and Email Reports separate setup, editing, reporting, and consent. The detailed checklist and complete metric breakdown are collapsed by default. Reports and email preferences load only on their respective tabs. Multiple-place selection preserves the active section in the URL; server RPCs remain the authority for access.

Public listings and My Places no longer embed the dashboard. Editing actions open the listing with a specific `business` action, retaining the on-page private preview and sticky publishing toolbar. Existing report action links still work, including the sharing path to the new activity workspace. The new route requires sign-in and is included in the static export as non-indexable.

Validation for this follow-up: 198 unit/database tests, 40 desktop/mobile workspace/highlights checks, and 12 existing owner-navigation checks passed. Lint passed with the two existing warnings. The complete static export passed for 187 listings and includes the new private route. No hosted change or deployment was performed.
