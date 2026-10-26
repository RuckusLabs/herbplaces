# Place management setup and release

Place management stays in the current React site. Supabase runs trusted operations; Stripe processes Bloom subscriptions. Public listings and favorites retain their IDs. Thrive's external-link product store remains a later release.

## October 21 hosted preparation — ready for review

With the user's instruction to continue, the hosted project `qtpepsebztlremlhpxdt` now has migrations `202610190005`, `202610210001`, and `202610210002`. Updated `place-management`, `stripe-webhook`, `billing-reconcile`, and `claim-notifications` functions are deployed; `admin-users` was preserved. Purchases remain disabled. Hourly billing reconciliation is active and its HTTP invocation returned 200 with no failures. Email dispatch remains off.

Before applying changes, an ignored local backup captured all 12 public tables, the public view and policies, current migration history, deployed function source, authentication return settings, and all 18 objects in the `place-photos` bucket. Its path is recorded in ignored `supabase/.temp/customer-launch-backup-path`. A local PostgreSQL rehearsal using the backed-up listing column types/data retained all 16 listings, the existing claim, and memberships without queuing messages for historical claims.

The canonical Auth site URL was corrected from a bare hostname to `https://littleherbplaces.com`. Exact callback and password-reset paths plus query-return patterns were added for production and controlled local origins. Other hosted Auth, database, and Storage settings were preserved. The local review origin on port 5181 is also allowed by the management function.

The extended `scripts/verify-beta-backend.mjs` passed real hosted confirmation/recovery link generation and consumption, safe return URLs, password update, used-link rejection, listing requests and retry reuse, private access boundaries, admin review, claim rejection/resubmission/approval, independent ownership verification, durable message queues, upload/delivery, publishing/conflicts/restoration, and access revocation. It generated account links directly through the Auth admin API; it did **not** test mailbox delivery or process a Stripe payment. Temporary accounts, listing, requests/messages, and photo were removed. Post-test checks retained 16 listings and the original one claim, with no subscriptions.

**Remaining launch blockers:** Resend/domain and custom Auth email delivery are paused at the owner's request. Sender credentials, notification dispatch secrets, and the email schedule are absent. Signup still auto-confirms email; enable confirmation only after actual signup/recovery delivery is verified. Review the live account's statement name, tax/refund settings, payment-retry policy, and public policies, then configure live billing objects/keys and publish the reviewed frontend. Both purchase flags remain off. Sandbox checkout and subscription lifecycle tests have passed; no live payment was made.

Run `node scripts/check-launch-readiness.mjs` for a read-only configuration report; exit 2 means configuration remains incomplete. It reports presence/status without printing private keys, and never certifies that real delivery/payment tests have passed. The hosted smoke test refuses to run if real notification dispatch is active; use an isolated project for those fixtures after activating email.

## October 21 customer launch milestone — local review

The customer-journey frontend is implemented locally and has not been published. The October 21 hosted preparation below has applied its database and function changes. Keep both purchase flags disabled until the full Stripe and email release gate passes.

Validation for this local milestone: 133 unit/database tests and 90 desktop/phone browser checks passed. Lint has no errors and retains two existing Fast Refresh warnings. All five server-function checks passed. The complete Pages export generated 16 listing cards, 10 website cards, static entry pages, and the sitemap. Hosted Stripe sandbox checks are recorded below; mailbox delivery remains unverified.

Implemented for review:

- Password reset, matching-password update, and resend-confirmation pages. Account emails include a validated return path, so another device can return to the right listing. Add the new recovery URL to Supabase Auth's redirect allowlist and verify callback URLs with their return query parameters.
- Claim drafts recover in another tab of the same browser for up to 24 hours. Another device can resume at the correct listing but must re-enter unsent details. Shared browser drafts are cleared after submission; existing per-tab drafts remain a compatibility fallback.
- My Places is visible to signed-in accounts even while access is loading, when a request is rejected, or when access lookup fails. Previously loaded access stays visible on refresh errors; the database still independently enforces permission for every mutation.
- Missing-place requests have a confirmed-account form, private request history, admin review queue, retry protection, and a five-new-requests-per-day limit. Admins can create a listing from public details, then link it to the request. This does **not** grant management access; the owner must still claim it.
- Migration `202610210001_customer_launch.sql` makes verification independent of payment and adds listing requests plus a private customer email queue. Existing editorial verification is preserved. Review existing editorial flags as part of launch preparation; they are not reinterpreted as a new ownership check.
- The existing claim dispatcher now also handles customer receipts and decisions and listing-request notifications. Both queues use independent leases, stable provider idempotency keys, eight attempts, and a 23-hour automatic retry window. No historical messages are backfilled.
- Billing recovery discovers subscriptions by customer even when the first webhook was lost and the customer never returned. Customer pagination uses a stable place-ID cursor; Stripe discovery traverses all pages. Multiple current subscriptions stop recovery for support review rather than choosing arbitrarily.
- Website and checkout use shared launch-offer definitions. Only the USD $19 monthly Bloom offer is sellable. `STRIPE_BLOOM_PREVIOUS_PRICE_IDS` optionally lists explicitly approved prior Bloom Price IDs for existing subscriptions; it does not change the price for new checkout. Annual billing, Thrive checkout, automatic price increases, and founding-price expiration are **not enabled** in this milestone.
- Unpublished listing edits recover within the same tab/account for 24 hours. A newer published version blocks publishing the recovered draft until the owner resolves the conflict. Successful publishing stays successful even if the directory cannot refresh afterward.
- Business-plan copy, account versus newsletter signup, next-step messages, help/billing FAQs, privacy information, and membership terms are prepared for review. Thrive's promotion scope remains explicitly unconfirmed. No traffic, revenue, or ranking guarantees are advertised.

### Deployment and hosted release gate

1. Review the customer screens, verification meaning, privacy/retention description, and membership terms. Finalize the refund policy and founding-price duration before advertising either; the current copy accepts refund inquiries and makes no founding-price promise.
2. Back up the database and Storage. Apply any outstanding migrations in order, including `202610190005` and `202610210001`, first to staging. New authenticated request APIs require the latter migration before this frontend is published.
3. Deploy updated `place-management`, `stripe-webhook`, `billing-reconcile`, and `claim-notifications`. Preserve `admin-users`. Configure Resend and the verified sender as described below. Set Stripe test-mode credentials and the correct Price/webhook signing secret. Keep the new-purchase flags off in production.
4. Allow the production and tested local origins for `/auth/callback` (including return destinations in its query string) and `/auth/reset-password`. Test signup confirmation in the same tab, a second tab, and another device; test expired links and password recovery. Keep redirect URLs restricted to controlled origins.
5. Enable `pg_net`/`pg_cron`. Add notification and billing dispatcher URL/secret pairs through Vault. Run `setup-claim-notifications.sql` and `setup-billing-reconciliation.sql`; the latter runs hourly at minute 7 UTC. Check actual scheduled delivery, not just the existence of a job.
6. Configure Stripe portal payment methods, invoices, period-end cancellation, disabled plan switching, renewal reminders/payment failure emails, and renewal retry behavior matching the seven-day grace period. Verify checkout displays the correct amount and recurring terms. Confirm the business account's tax and refund settings match the reviewed customer terms.
7. With controlled accounts, verify claim receipt → admin notification → approval/rejection email; listing request → admin creation/linking → customer decision → separate ownership claim. Confirm notifications arrive once and private details are not publicly readable.
8. Run real Stripe test checkout and lifecycle checks: successful/failed first payment, required card authentication, canceled/expired checkout, duplicate checkout, missed first webhook without a customer return, repeated/out-of-order events, renewal failure, grace expiry/recovery, period-end cancellation, and resubscription. Verify only the billing contact sees payment details and every manager shares editing access.
9. Monitor Stripe webhook failures, scheduled HTTP responses, function failures, both unsent notification queues, and delivery errors. Investigate exhausted jobs before deliberately retrying outside the provider idempotency window. Treat multiple live subscriptions as a support incident; confirm the intended subscription before changing billing or refunding.
10. Review the frontend release through a pull request, deploy it with purchases disabled, and verify the real public pages and account links. Only after the test-mode gate passes, configure live-mode counterparts, verify live configuration, enable both purchase flags, rebuild, and complete an authorized pilot purchase. Re-disabling purchase flags pauses new sales while existing billing and editing remain available.

### Remaining review milestones

- **Hosted launch gate:** complete the setup and real-delivery/payment checks above after the local milestone review. No local check proves that live email, portal configuration, or payment processing is ready.
- **Expanded Bloom:** primary action buttons, events/workshops with timezones and expiration, seasonal announcements, listing completion guidance, owner-excluded interaction analytics, and a concise monthly report. Evaluate $29/month or $290/year only after features and value are validated.
- **Thrive pilot:** up to 10 product/service links, per-offering activity, trackable offers, assisted onboarding, promotion requests, and an admin fulfillment calendar for 5–10 businesses. Confirm audience and delivery capacity before promising a newsletter/social cadence. Measure fulfillment time and retention before testing $79/month or $790/year.
- **Pricing and audience:** build regional guides and opt-in digests, measure real visitor actions and customer renewal, add server-approved plan/annual-price catalogs and upgrade/downgrade rules, then implement explicit founding terms and advance renewal notices. Optional $149 setup needs a defined deliverable and measured labor cost. Reviews, messaging, and marketplace checkout remain deferred.

## Current beta deployment

With the user's approval, migrations `202610190001`, `202610190002`, `202610190003`, and `202610190004` and the four Edge Functions were installed in project `qtpepsebztlremlhpxdt` on October 19, 2026. The nine existing places were retained, and both the legacy `places` endpoint and `public_places` returned HTTP 200 after installation. The existing beta site's public content reads remain compatible; direct browser writes and private table access are denied. The first real administrator was enabled for the verified account designated by the user.

The photo bucket accepts JPEG, PNG, and WebP up to 10 MB. Server configuration allows the public site plus `http://localhost:5173` and `http://127.0.0.1:5173`. Checkout and portal returns use the requesting allowed origin so local testing returns to localhost. The existing Mapbox token is configured for the server's lookup; permanent-geocoding eligibility still needs confirmation before testing a real address change.

An ignored local backup of listing data and original permissions is saved under `supabase/.temp/backups/`. Deployment credentials are kept out of Git. Frontend releases are reviewed through a GitHub pull request before merging to main.

Remaining setup: complete transactional email, live billing review/configuration, and the frontend release. Sandbox Stripe and hourly reconciliation are verified. `BLOOM_ENABLED=false`; subscriptions have not been enabled. Public endpoint, CORS, and access-denial checks passed against the hosted functions. After explicit approval, the authenticated hosted test in `scripts/verify-beta-backend.mjs` also passed real sign-in, claim approval, subscription enforcement, photo upload/delivery, publishing, conflict handling, history restoration, and access revocation. Its temporary accounts, listing, and photo were removed. The admin extension additionally passed hosted ownership checks, sorted user/place associations, self-removal and billing-contact protections, and real temporary-account removal with immediate access denial while preserving the listing. The current local suite contains 133 unit/database tests and 90 browser checks across desktop and phone layouts.

The live test identified a hosted PostgREST retry issue when a version conflict used SQLSTATE `40001`. Follow-up migration `202610190002` returns `PT409`/HTTP 409 instead, and the editor shows the reload prompt while retaining the draft. Fresh installations must apply all migrations in order. Database tests cover the corrected response; desktop and phone browser conflict checks passed after the fix.

Migration `202610190004` adds administrator-only place creation. Add Place uses the existing editor for details, categories, generic links, preview, and a suggested editable URL slug. Creating publishes the listing and opens photo editing; canceling the initial form saves nothing. Duplicate URLs preserve the form, and retrying a creation request returns the same place. Creation initializes a subscription record without assigning a manager or starting billing. Imported beta IDs had not advanced their identity sequence, so the migration safely advances an existing sequence when needed, without changing listing IDs or rewinding a sequence.

## Included behavior

- Claim This Place opens a two-step ownership form for guests and signed-in users: full name, role, business email, optional phone and verification link, supporting ownership details, then review and authorization confirmation. Guests keep a per-place draft in session storage (up to 24 hours) while signing in; confirmed users send it to the existing private admin claim queue. Admins verify and approve the claim before payment.
- `/my-places` shows assignments, claims, subscription notices, Checkout, and billing.
- The editor opens on the public place page, with preview, publish, conflict detection, photos, ordering, covers, alt text, phone, hours, generic links with custom text, and categories. Editing appears above the location line. Claiming appears in Plan a Little Visit only for unclaimed places; assigned managers and pending invitations reserve a place even without an active subscription.
- Add Place appears at the top of `/admin`; after creating a listing, admins can add photos and assign managers through the existing controls.
- `/admin` provides searchable, paginated users and places, claim review, multiple manager emails, one billing contact, pending assignments, location review, protected settings, revision restoration, and activity history. Table headings sort the complete filtered result before pagination. Users show assigned places and pending invitations, with a shortcut to manage each place.
- User removal requires typing the account email. Administrator accounts are protected; billing contacts attached to a subscription, customer, or pending checkout must be reassigned first. The server deletes the Auth account, memberships, and outstanding email invitations while retaining published places, photos, and revision history. A database reservation blocks new assignments and editing during removal. If Auth deletion fails, access is restored and the error remains in the dialog.
- Keep Wandering recommends the closest places within 50 km first, then matching types/categories. Matching city and region provide a local fallback when map coordinates are missing.
- Database permissions protect publishing and private records. The public directory uses an explicit projection.
- Failed renewals allow seven days of editing from the first failure. Retries do not reset the deadline. Cancellation retains access through the paid period. Expiry preserves content, photos, and memberships.
- In the October 21 migration, Verified appears from approved membership or existing editorial verification, independently of payment. Featured remains editorial.

## Claim notification email (prepared locally; not yet activated)

Migration `202610190005` queues an email job in the same transaction as each new claim. The `claim-notifications` Edge Function sends the saved place name, account email, relationship, ownership evidence, claim reference, and links to the listing and `/admin` to **admin@littleherbplaces.com** through Resend. The destination is fixed on the server. It does not approve claims. The October 21 migration adds a separate customer queue for receipts and decisions; review notes also remain in My Places. Existing claims are not backfilled.

Activation requires a Resend account, a verified sending domain/address, and these server-only Supabase secrets:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | Resend key with permission to send from the verified domain |
| `CLAIM_EMAIL_FROM` | `Little Herb Places <admin@littleherbplaces.com>` after Resend verifies the domain |
| `CLAIM_NOTIFICATION_SECRET` | New random secret of at least 32 characters, shared only with the database dispatcher |
| `SITE_URL` | Public website origin used for review links; already required by management |

Apply migrations `202610190005` and `202610210001`, deploy `claim-notifications` with `supabase/config.toml`, enable the hosted `pg_net` and `pg_cron` extensions, and add `claim_notification_url` and `claim_notification_secret` through the Supabase Vault dashboard. The URL is the deployed `/functions/v1/claim-notifications` endpoint, and the Vault secret must match `CLAIM_NOTIFICATION_SECRET`. Then run `supabase/setup-claim-notifications.sql`. The setup script installs an immediate asynchronous dispatch trigger and a one-minute retry schedule, reads secrets from Vault, and can be rerun without duplicating the schedule.

Delivery failures preserve the claim and notification. Jobs use five-minute leases, up to eight attempts, and a stable Resend idempotency key per claim. Automatic retries stop 23 hours after the first attempt, within Resend's 24-hour idempotency window. Keep the sender and site URL stable during retries. Missing email configuration returns 503 without consuming attempts. Monitor the scheduler, `net._http_response`, and unsent rows in `public.place_claim_notifications`; exhausted jobs require investigation before a deliberate retry. No API keys, ownership evidence, or provider response bodies are logged. Keep this table private and include it in the same retention policy as claims.

Verify with a claim from an account you control, confirm the email arrives once at admin@littleherbplaces.com, and confirm `/admin` still requires administrator access. Local tests cover the durable queue, private grants, overlapping leases, retries, limits, recipient, email contents, authentication, and provider failures using mocks. Real provider delivery and hosted scheduling remain unverified until activation.

References: [Resend sending API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), and [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

## 1. Database preflight and migration

The repository previously contained no schema or migrations. Initial read-only inspection confirmed bigint place IDs, bigint ZIP codes, JSON photo arrays, and read-only place policies. The project originally had no management tables or `profiles` table. The local public API key was refreshed after an initial HTTP 401. The approved beta deployment above subsequently installed the management schema and converted ZIP codes to text.

Run `supabase/preflight.sql` in the Supabase SQL editor. Check that existing listing columns match the directory: `id`, `name`, `urlSlug`, `tagline`, `description`, `website`, `address`, `city`, `state`, `zip`, `coverPhoto`, `photos`, `isFeatured`, `isVerified`, `latitude`, and `longitude`. Confirm management table names do not conflict. Camel-case identifiers must match exactly.

Back up the database and apply all files in `supabase/migrations/` in order to a staging copy first, including the conflict-response follow-up. New foreign keys preserve the existing ID type. The first migration converts ZIP codes to text, preserving existing values and allowing blank values, leading zeros, and ZIP+4 in future edits. Previously discarded leading zeros cannot be recovered automatically. Local PostgreSQL tests exercise UUID/JSON-photo and bigint/text-array-photo configurations, including numeric ZIP conversion; reconcile any other existing types before applying to production.

The migration removes all browser writes to the base `places` table and grants only an explicit list of public content columns for compatibility with the currently published beta site. Future private columns receive no read grants. The new website uses the narrower `public_places` projection. The migration closes browser writes to the dedicated `place-photos` bucket even if legacy permissive Storage policies exist, and preserves `profiles`, `favorites`, and unrelated Storage policies. Do not restore base-table writes to work around editor errors.

The compatibility grants let the beta backend be installed before publishing the new frontend. The new frontend reads `public_places` and falls back to explicit legacy public columns while that view is missing. Apply migrations through your existing Supabase deployment process. Before customer launch, verify custom account email delivery, then enable email confirmation in Supabase Auth. The October 21 preflight found auto-confirmation still enabled. Allow each tested origin’s callback and recovery URLs, including validated return-query patterns.

## 2. Bootstrap an administrator

Create and confirm the administrator's normal account. From a privileged SQL session, insert the actual verified account ID:

```sql
insert into public.site_admins (user_id)
select id from auth.users
where id = 'REPLACE_WITH_VERIFIED_ADMIN_UUID'::uuid
  and email_confirmed_at is not null
on conflict do nothing;
```

Sign in and open `/admin`. Additional site-admin grants also use privileged SQL. The website manages place managers, not site-admin promotions.

Confirmed manager emails receive access immediately. Other emails stay pending until that email is verified and signs in; access then binds to the account ID and survives email changes. Pending assignments do not send custom emails. Share the normal sign-in link with the manager. Claim decisions and notes appear in My Places.

Removing the billing contact does not cancel the subscription; assign a replacement. Each place has a separate Stripe customer so billing portal access cannot expose another place. Refunds and card ownership are managed in Stripe.

## 3. Server configuration

Set these Supabase project secrets. Never use `VITE_` prefixes for private credentials:

| Secret | Value |
| --- | --- |
| `SITE_URL` | Canonical origin, e.g. `https://littleherbplaces.com` |
| `ALLOWED_ORIGINS` | Comma-separated exact allowed origins; include canonical and `www` origins as appropriate |
| `STRIPE_SECRET_KEY` | Restricted sandbox API key (`rk_test_…`) for verification; live restricted key only after launch review |
| `STRIPE_BLOOM_PRICE_ID` | USD $19/month recurring Price ID in the same Stripe mode |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the deployed Stripe destination |
| `MAPBOX_GEOCODING_TOKEN` | Server token for an account eligible for permanent geocoding |
| `BILLING_RECONCILE_SECRET` | Random secret for the hourly reconciliation scheduler |
| `BLOOM_ENABLED` | `false` during setup, `true` after verification |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Keep local function secrets in ignored `.env.local` files. Never commit secrets or expose the service key in frontend configuration.

Deploy `place-management`, `stripe-webhook`, `billing-reconcile`, and `admin-users` with `supabase/config.toml`. Platform JWT checks are disabled intentionally: management validates the token with Supabase Auth and checks current database permissions, the webhook verifies Stripe signatures, reconciliation checks its scheduler secret, and user removal validates the confirmed administrator against current database roles before using the Auth admin API.

Stripe SDK 23.0.0 and API version `2026-09-30.endive` are explicitly pinned together. The sandbox webhook uses that version; update code, endpoint configuration, and tests together when upgrading. Invoice subscription references and subscription-item billing periods use this API's shapes.

### Stripe settings

Create a Bloom product with one USD $19/month recurring price and no trial. Configure the customer portal for payment methods, invoices, and cancellation at period end. Disable plan switching until Thrive is implemented. Enable Stripe payment-failure emails. Configure retries to keep subscriptions `past_due` for the seven-day grace window before marking them `unpaid` or `canceled`.

Register `/functions/v1/stripe-webhook` on your Supabase project for:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded` (only paid sessions are reconciled)
- `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`
- `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`

Eligibility follows verified webhooks, not browser return URLs. Checkout reservations and Stripe idempotency keys prevent duplicate purchases. Existing subscriptions and completed sessions block another checkout. Paid-through dates extend from paid invoices; renewal retries retain the first grace deadline.

### Reconciliation, maps, and storage

Use `supabase/setup-billing-reconciliation.sql` with its Vault URL/secret pair, or schedule an hourly POST to `/functions/v1/billing-reconcile` with `Authorization: Bearer YOUR_BILLING_RECONCILE_SECRET` through your scheduler or Supabase Cron. Store the header as a scheduler secret. Monitor its non-200 responses, Stripe webhook failures, and Supabase function logs. Reconciliation catches missed events; database-time checks still enforce paid and grace expiry.

Mapbox lookups use permanent storage mode, accept only high-confidence address matches, and allow one attempt per place per minute. Failed matches publish the address while hiding stale map pins. Admin Location Review supports retry and manual confirmation. A delayed lookup cannot overwrite a newer content version.

Photo paths are immutable. Published and previously published photos are retained for restoration. Unpublished canceled uploads are also retained in this release; monitor the bucket's size. Back up Storage objects separately from database backups.

## 4. Verification

```sh
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:ui
deno check --node-modules-dir=none supabase/functions/place-management/index.ts supabase/functions/stripe-webhook/index.ts supabase/functions/billing-reconcile/index.ts supabase/functions/admin-users/index.ts supabase/functions/claim-notifications/index.ts
```

Database tests run real PostgreSQL roles, grants, policies, migrations, and RPCs in an embedded instance. Browser tests use test-only auth/API fixtures on a separate local port and never contact production or charge cards. They cover desktop and phone layouts, claims, uploads, publishing, conflicts, billing lockouts, admin assignments, sortable tables, linked users and places, account-removal confirmation and failures, and denied admin access.

In staging, verify real confirmed accounts can claim, receive approval, and subscribe using Stripe test payments. Confirm multiple managers share editing while only the billing contact sees payment information. Exercise failed first payment, renewal, retries, grace expiry, recovery, period-end cancellation, duplicate checkout, and replayed/out-of-order events. Test direct API denial after membership revocation and check fresh content and restored photos in another browser.

## 5. Enable and pause purchases

After verifying the migration, functions, and Stripe lifecycle, set server `BLOOM_ENABLED=true` and frontend `VITE_BLOOM_ENABLED=true`, then rebuild. GitHub Pages reads the frontend flag from repository variable `VITE_BLOOM_ENABLED` and public keys from the existing secrets. The workflow now passes `VITE_MAPBOX_TOKEN` as well.

To pause new subscriptions, turn both flags off and rebuild. Existing paid editing and portal access continue. Existing beta builds retain read access to known public listing columns, allowing a frontend rollback without reopening writes. Preserve memberships, subscriptions, revisions, and Storage objects when reverting application code.

## October 21 provider handoff

The owner confirmed `admin@littleherbplaces.com` for both the transactional sender and private claim/listing review inbox. The fixed review recipient is deployed; sending remains unconfigured until Resend verifies `littleherbplaces.com`. Configure Supabase custom SMTP as well as the notification API, verify actual receipt in both directions, and then enable email confirmation. The owner connected the separate Little Herb Places account and its isolated sandbox. All Bloom configuration in this checkpoint targets the sandbox; the existing Out There And account remains outside this setup.

Dependency maintenance removed unused Swiper, updated compatible packages, and pinned the manual deployment helper to the audited version 6.1.1. Supabase SDK 2.118.0 is used in browser and server code; CI/builds require Node.js 22 or later. The dependency audit reports zero known vulnerabilities as of this verification; deprecated transitive deployment packages still warrant future replacement. Publishing now confirms the committed save before background directory retries finish.

### Stripe sandbox checkpoint

The Little Herb Places account is connected, along with its separate sandbox. Resend setup is paused at the owner's request. These objects exist only in **Little Herb Places sandbox** (`acct_1UT1vP6cqRdXwH7O`):

| Object | Value |
| --- | --- |
| Bloom product | `prod_VU02O5KvcPuKrF` |
| USD $19/month recurring price | `price_1UT22P6cqRdXwH7O9UTp0b47` |
| Price lookup key | `bloom_monthly_usd_v1` |
| Default billing portal | `bpc_1UT22a6cqRdXwH7OtLPSFub8` |
| Webhook | `we_1UT24c6cqRdXwH7OKYZVP8Oa` |
| API version | `2026-09-30.endive` |

The portal permits invoice history, payment-method updates, customer detail updates, and period-end cancellation; plan switching and public email login are off. The product descriptor is `LITTLE HERB PLACES`; live public business details and actual statement display still require verification. Privacy/terms URLs are not set in the sandbox portal until those frontend pages are published. The Price ID and webhook signing secret have been securely saved to Supabase. Purchases remain off. The sandbox lifecycle is verified as described below; no live charges were made.

A restricted **sandbox** API key is stored as `STRIPE_SECRET_KEY`. Hosted verification confirmed it belongs to the separate sandbox and all required read permissions now pass. Grant Customers, Checkout Sessions, and Customer portal Write permissions, and Prices, Products, Subscriptions, and Invoices Read permissions. Keep all other permissions off unless a concrete API error demonstrates a further requirement. Do not put the key in chat, frontend variables, or source control. Repeat the sandbox lifecycle verification after changing billing behavior or API versions before enabling new purchases.

Use `node scripts/verify-stripe-sandbox.mjs setup` to prepare disposable confirmed accounts and a listing with a privately scoped test checkout endpoint, without enabling public purchases. `probe` checks required read permissions without returning provider records or keys. `checkout` verifies price validation and duplicate-session reuse; after paying with a Stripe test card, `status`, `publish`, `portal`, `sync`, and `deny-edit` support lifecycle verification. Cancel the test subscription before `cleanup`, which removes the temporary endpoint, listing, queued messages, and accounts. Setup requires inactive notification dispatch; do not run it after real email delivery is enabled. Tokens and temporary function sources stay in ignored, private `supabase/.temp/stripe-sandbox/`.

### Hosted sandbox lifecycle verified

Using a disposable confirmed owner and listing, the hosted server created the advertised $19/month Checkout and reused its session on retry. A declined test card left editing locked. A successful test payment triggered the signed webhook and unlocked real owner publishing without a manual refresh. The portal showed invoices and permitted payment-method updates, period-end cancellation, and reversal of a scheduled cancellation. A Stripe test clock simulated monthly renewal, failed renewal, recovery through the portal, and final period-end cancellation. Successful renewal/recovery extended the paid-through date; failed renewal received a full seven-day grace period. The fixture's database grace deadline was explicitly expired to verify write-time denial (advancing Stripe's clock does not advance PostgreSQL time). Reconciliation recovered a deliberately removed initial subscription link using its saved customer. Final cancellation stopped editing.

Testing found and fixed two integration gaps:

- The portal can set `cancel_at` while leaving the legacy `cancel_at_period_end` flag false. Reconciliation now recognizes either representation so My Places accurately shows scheduled cancellation.
- Stripe can keep a subscription active while preparing its cycle invoice. Migration `202610210002` permits a fixed 24-hour processing window only for previously paid, unscheduled renewals. It uses the Bloom subscription item's cycle start, not the invoice header's older accounting period. Repeated events cannot extend the window, first unpaid invoices cannot gain access, and scheduled cancellation cannot outlive the paid period. Actual payment failures receive the separate full seven-day grace period, and payment recovery clears it. My Places labels this state “Renewal processing.”

All 133 unit/database tests, 90 desktop/mobile browser checks, server checks, lint (two existing warnings), and the production Pages export pass. The temporary test endpoint, listing, accounts, claims, and queued test messages were removed. Canceled sandbox billing records remain in Stripe as test evidence. The hourly job `bloom-billing-reconciliation` runs at minute 7 with Vault-held credentials; its manual verification returned `{reconciled:1,failures:0}` over HTTP 200. Claim-email delivery and its schedule remain off.


### Listing request addresses — October 21, 2026

Migration `202610210003_listing_request_address.sql` is applied to the linked project. Requests retain private `address` and `zip` fields; old six-argument clients remain supported. Pending-request deduplication includes street address so separate branches in the same city can be submitted. Reviewers see both fields, and Create Listing prefills them into the place editor. Creating a place marks its location pending and invokes the existing server geocoder; sufficiently precise matches store latitude/longitude in Supabase, while failed or uncertain lookups remain in Location Review. No geocoding is performed on an unreviewed listing request. The existing permanent-geocoding account eligibility gate above still applies to real lookups.

Validation: 136 unit/database tests and 118 desktop/mobile checks pass. Address capture, signup draft retention, admin prefill, the geocoding handoff, and actual PostgreSQL coordinate persistence are covered; provider calls are mocked. The full Pages export passes with 16 place cards and 12 site cards.


### Owner checkout preview (2026-10-21)

At the owner’s request, Makki Home (place 22) was created as a clearly labeled sandbox checkout listing and its requester was granted management membership and billing-contact access. Street address, city, region, and postal code were deliberately omitted from the public test listing; the original listing request stays private. No payment or editing entitlement was granted.

The temporary `bloom-owner-checkout` function uses the existing Checkout implementation, but requires the specific requester, place 22, localhost port 5181, and a test-mode Stripe key. It supports only checkout. Public server `BLOOM_ENABLED` and frontend `VITE_BLOOM_ENABLED` remain false. Local `.env.local` enables only `VITE_BLOOM_SANDBOX_CHECKOUT=true`; that override and endpoint routing apply only to Vite development, never production builds. All other actions use the regular authenticated management endpoint. Browser tests explicitly disable the local sandbox override.

The private deployment source and setup receipt are in ignored `supabase/.temp/owner-checkout/`. The temporary endpoint must be removed when owner testing ends, after canceling any sandbox subscription. The test listing should also be removed or replaced with reviewed business content before public launch. The owner’s previously saved session was rejected by Auth because its server-side session no longer existed. After the owner signed in again, the actual browser opened Little Herb Places sandbox Checkout for Bloom at $19/month. No payment details were entered and no subscription was submitted; the open Checkout is left for the owner to test.


### Bloom photo allowance (2026-10-21)

Bloom now permits at most 10 photos per published gallery. Migration `202610210004_bloom_photo_limit.sql` is applied and enforces the limit on content writes; client content preparation and upload selection enforce the same allowance. Existing galleries were checked before applying it: none exceeded ten, so no image removal or content rewrite was necessary. Sales-page copy, SEO output, and help text use the same limit. Photo file formats and the 10 MB per-image size limit are unchanged.

Place galleries use a stable-height horizontal rail with natural-width portrait and landscape slides, full-image thumbnails, centered navigation, and a synchronized full-size viewer. Keyboard navigation, touch scrolling, resizing, and reduced motion remain supported.


### Account settings (October 26, 2026)

All signed-in accounts, including browsing-only accounts and approved managers, can open `/settings` from the account dropdown. Names and the default directory view are stored in the current Auth user's metadata through `updateUser`; metadata does not grant management privileges. An explicit directory view in a URL overrides the saved preference. Settings is excluded from search indexing and signed-out visitors return through login.

Email changes use Auth's email-update API and the existing controlled `/auth/callback?next=%2Fsettings` destination. The UI distinguishes an immediate completed change from a pending `new_email`, keeps the current sign-in address visible, and reports provider errors without replacing it. Do not update management-directory email or billing authorization from editable metadata; the existing Auth trigger handles confirmed email changes. Verify secure email-change confirmations from both inboxes and expired links once custom SMTP is configured. Real email delivery is still a launch gate. The existing password-recovery route remains available until the separate passwordless milestone. No new database migration or hosted configuration change is needed for this page.


### Resend activation progress (October 26, 2026)

The owner reports `littleherbplaces.com` is verified in Resend. The server now has `RESEND_API_KEY`, `CLAIM_EMAIL_FROM` (`Little Herb Places <admin@littleherbplaces.com>`), and a generated `CLAIM_NOTIFICATION_SECRET`. Private setup material is kept only in ignored `supabase/.temp/email-activation/`; the temporary API-key input file was removed after setting the server secret. The owner saved Supabase Auth SMTP with the verified sender, `smtp.resend.com`, port 465, and username `resend`; enabled SMTP and the stored-password state were verified after a reload. The notification server key was also replaced after the original key was revoked. Email confirmation, notification triggers/scheduling, and public purchases remain disabled.

The three unsent customer notifications are `listing_received`, `listing_admin`, and `listing_reviewed`, all from the owner's Makki Home test request. Review their disposition before enabling dispatch; do not treat them as new launch messages. The original authorized setup test bounced before the admin mailbox existed. The owner then confirmed the iCloud mailbox was created. A retry using the replacement server key was suppressed because of that original bounce. The suppression was removed only after verifying its origin and source matched the original setup-test message and the exact admin address; a final idempotent retry was reported `delivered` by Resend. Private receipts are in ignored `supabase/.temp/email-activation/`. An expiring, shared-secret-authenticated `email-delivery-check` function was used so the replacement provider key stayed server-side. It was restricted to the admin recipient, never dispatched queues, and was removed afterward (HTTP 404 verified). The three queued messages remain unsent. Supabase signup/recovery/email-change delivery and passwordless sign-in still need end-to-end mailbox testing before email confirmation enforcement or public account launch.


### Passwordless local preview (October 26, 2026)

Sign-in and registration have an email-code preview, shared with the account step of listing requests. `VITE_PASSWORDLESS_ENABLED=true` enables it only in Vite development; `src/utilities/authFeatures.js` also requires `import.meta.env.DEV`, so production builds keep the current password-based flow until reviewed. The ignored local environment enables the preview. Existing browser regressions explicitly disable it; `npx playwright test --config playwright.passwordless.config.js` exercises the new flow.

Existing-account sign-in uses `signInWithOtp` with `shouldCreateUser: false`; registration permits account creation after required terms consent. Code verification uses `verifyOtp` with type `email`, waits for profile setup, and preserves the existing user's identity and saved-place syncing. The UI supports a six-digit code, paste normalization, resend countdown, email correction, and invalid/expired-code retry. Email addresses and codes are kept in component memory, never in listing drafts. Supabase still persists the authenticated session normally. Listing requests preserve only place fields and a stable request ID for 24 hours; clicking Verify & Send Request verifies the account and sends the request once. A failed request retains its ID for retry without registering or verifying again. Ownership claims retain their separate explicit review and submission after sign-in. Existing recovery/callback routes stay compatible.

Prepared template: `supabase/templates/email-code.html`, intended for both Confirm signup and Magic Link, subject “Your Little Herb Places code”. It includes `{{ .Token }}` and a fallback `{{ .ConfirmationURL }}` link for older clients. **Not applied to hosted Auth yet.** Supabase sends magic links by default; the hosted templates must include the token before the code flow is usable with real mail. See [Supabase passwordless email documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Review the local flow first. Then apply the reviewed templates, check the hosted code length, expiry and send-rate settings, verify Site URL/allowed callback URLs, and authorize real Auth email tests. Test existing-account sign-in, new-account registration, invalid/reused/expired codes, email changes from both inboxes, and recovery-link compatibility using controlled accounts. Confirm favorites and management access remain attached to the same user ID. Only after those pass should email confirmation enforcement and the production passwordless switch be enabled. Notification dispatch and public billing remain separate launch gates; the three old queued test messages stay paused.

Validation: all 141 unit/database tests, 152 existing desktop/mobile browser checks, and 12 new passwordless desktop/mobile checks pass. Targeted lint has no errors (one existing Fast Refresh warning); the production client build passes with the current bundle-size advisory. Email-entry and code-entry layouts were visually checked on desktop and phone. Provider emails are mocked in browser tests; no real Auth code email was sent during this milestone.

### Existing password credentials removed (October 26, 2026)

The owner explicitly chose to remove all 14 existing passwords immediately after being informed that the live site still uses password sign-in and that this would interrupt that method. A guarded transaction cleared only the existing nonempty `auth.users.encrypted_password` values and updated their modification timestamps. No hashes were read, exported, or backed up. Account records, identities, sessions, favorites, and listing permissions were not deleted. An independent post-commit query verified 14 accounts, zero accounts with password credentials, five favorites, and one management membership; favorites and membership counts match the pre-cleanup audit. No public application table had a password-named column.

Old passwords no longer work. Hosted email templates and the production passwordless switch remain pending, so completing the Auth email/passwordless cutover is now urgent before normal sign-in can resume. This one-time cleanup does not disable Supabase password signup, password updates, or recovery APIs; they can create new password credentials until separately restricted. Existing database backups may retain historical hashes under the provider's backup retention policy; this operation changed the active database only.

### Hosted code-email templates configured (October 26, 2026)

Both Confirm sign up and Magic link or OTP now use the prepared branded code email, with subject “Your Little Herb Places code”, `{{ .Token }}`, and a legacy `{{ .ConfirmationURL }}` fallback. Saved previews show the code placeholder. Email OTP length is six digits; expiry was reduced from 86,400 seconds to 600 seconds. Secure email change was enabled, requiring confirmation from both old and new inboxes. The 60-second minimum email interval and existing verification/sign-in rate limits were retained. Site URL and the controlled production/local callback allowlist were reviewed and retained.

The owner chose `lhp@makki.pro` for the real existing-account test. Before sending, the account had zero favorites and one management membership. The local browser signed out of a different account and requested a code for the selected inbox with return destination `/my-places`; Supabase accepted the request and displayed the code-entry screen. Mailbox receipt and completion of sign-in are awaiting the owner's code entry. Do not treat accepted sending as verified delivery or authentication. Email confirmation enforcement and the production passwordless switch remain pending that check. Notification dispatch and checkout launch gates remain off.

Old recovery and resend-confirmation routes now return to email-code sign-in when passwordless is enabled instead of offering to create another password. All 18 passwordless desktop/mobile checks pass, including these old-route handoffs; targeted lint passes. Legacy password-based behavior is retained only behind the existing disabled passwordless flag for rollback compatibility.


### Real passwordless sign-in verified (October 26, 2026)

The owner received the Supabase code at the selected existing-account inbox and completed sign-in. The local browser reached `/my-places`, displayed the approved Makki Home listing with Bloom active, and retained editing and Stripe billing actions. Confirm email is now enabled and saved in hosted Auth after this delivery/sign-in check. The application defaults to passwordless in both development and production; the Pages workflow explicitly enables it unless the repository variable is set to `false`. These frontend changes are prepared on the draft PR and are **not published yet**. Existing-account code delivery is verified; new-account mailbox verification and real two-inbox email-change testing remain separate launch checks. Notification dispatch, its old test queue, and public purchases remain off.

Old password/recovery forms remain available only with an explicit `VITE_PASSWORDLESS_ENABLED=false` compatibility override; public passwordless routes no longer offer password creation. Supabase's underlying password APIs have not been disabled by this UI change. The dedicated passwordless browser suite now builds and serves the production bundle to verify the released flow rather than relying on the development server.

Final verification: 141 unit/database tests, 152 existing browser regressions, and 18 production-built passwordless desktop/mobile checks pass. Targeted lint and the complete Pages export pass (17 place cards, 12 site cards). Hosted readiness confirms email confirmation is required, purchases remain off, and the same three customer test notifications remain unsent. An independent Auth query confirms all 14 accounts remain, zero password hashes were recreated, and the signed-in test owner still has the original owner UUID and one management membership.
