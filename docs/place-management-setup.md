# Place management setup and release

Place management stays in the current React site. Supabase runs trusted operations; Stripe processes Bloom subscriptions. Public listings and favorites retain their IDs. Thrive's external-link product store remains a later release.

## Current beta deployment

With the user's approval, migrations `202610190001`, `202610190002`, `202610190003`, and `202610190004` and the four Edge Functions were installed in project `qtpepsebztlremlhpxdt` on October 19, 2026. The nine existing places were retained, and both the legacy `places` endpoint and `public_places` returned HTTP 200 after installation. The existing beta site's public content reads remain compatible; direct browser writes and private table access are denied. The first real administrator was enabled for the verified account designated by the user.

The photo bucket accepts JPEG, PNG, and WebP up to 10 MB. Server configuration allows the public site plus `http://localhost:5173` and `http://127.0.0.1:5173`. Checkout and portal returns use the requesting allowed origin so local testing returns to localhost. The existing Mapbox token is configured for the server's lookup; permanent-geocoding eligibility still needs confirmation before testing a real address change.

An ignored local backup of listing data and original permissions is saved under `supabase/.temp/backups/`. Deployment credentials are kept out of Git. Frontend releases are reviewed through a GitHub pull request before merging to main.

Remaining setup: add Stripe credentials/Price/webhook configuration and schedule reconciliation when billing is enabled. `BLOOM_ENABLED=false`; subscriptions have not been enabled. Public endpoint, CORS, and access-denial checks passed against the hosted functions. After explicit approval, the authenticated hosted test in `scripts/verify-beta-backend.mjs` also passed real sign-in, claim approval, subscription enforcement, photo upload/delivery, publishing, conflict handling, history restoration, and access revocation. Its temporary accounts, listing, and photo were removed. The admin extension additionally passed hosted ownership checks, sorted user/place associations, self-removal and billing-contact protections, and real temporary-account removal with immediate access denial while preserving the listing. The final local suite contains 78 unit/database tests and 26 browser checks across desktop and phone layouts.

The live test identified a hosted PostgREST retry issue when a version conflict used SQLSTATE `40001`. Follow-up migration `202610190002` returns `PT409`/HTTP 409 instead, and the editor shows the reload prompt while retaining the draft. Fresh installations must apply all migrations in order. Database tests cover the corrected response; desktop and phone browser conflict checks passed after the fix.

Migration `202610190004` adds administrator-only place creation. Add Place uses the existing editor for details, categories, generic links, preview, and a suggested editable URL slug. Creating publishes the listing and opens photo editing; canceling the initial form saves nothing. Duplicate URLs preserve the form, and retrying a creation request returns the same place. Creation initializes a subscription record without assigning a manager or starting billing. Imported beta IDs had not advanced their identity sequence, so the migration safely advances an existing sequence when needed, without changing listing IDs or rewinding a sequence.

## Included behavior

- Confirmed users request a claim; admins verify and approve it before payment.
- `/my-places` shows assignments, claims, subscription notices, Checkout, and billing.
- The editor opens on the public place page, with preview, publish, conflict detection, photos, ordering, covers, alt text, phone, hours, generic links with custom text, and categories. Editing appears above the location line. Claiming appears in Plan a Little Visit only for unclaimed places; assigned managers and pending invitations reserve a place even without an active subscription.
- Add Place appears at the top of `/admin`; after creating a listing, admins can add photos and assign managers through the existing controls.
- `/admin` provides searchable, paginated users and places, claim review, multiple manager emails, one billing contact, pending assignments, location review, protected settings, revision restoration, and activity history. Table headings sort the complete filtered result before pagination. Users show assigned places and pending invitations, with a shortcut to manage each place.
- User removal requires typing the account email. Administrator accounts are protected; billing contacts attached to a subscription, customer, or pending checkout must be reassigned first. The server deletes the Auth account, memberships, and outstanding email invitations while retaining published places, photos, and revision history. A database reservation blocks new assignments and editing during removal. If Auth deletion fails, access is restored and the error remains in the dialog.
- Keep Wandering recommends the closest places within 50 km first, then matching types/categories. Matching city and region provide a local fallback when map coordinates are missing.
- Database permissions protect publishing and private records. The public directory uses an explicit projection.
- Failed renewals allow seven days of editing from the first failure. Retries do not reset the deadline. Cancellation retains access through the paid period. Expiry preserves content, photos, and memberships.
- Verified appears from approved membership plus an eligible subscription, or from existing editorial verification. Featured remains editorial.

## 1. Database preflight and migration

The repository previously contained no schema or migrations. Initial read-only inspection confirmed bigint place IDs, bigint ZIP codes, JSON photo arrays, and read-only place policies. The project originally had no management tables or `profiles` table. The local public API key was refreshed after an initial HTTP 401. The approved beta deployment above subsequently installed the management schema and converted ZIP codes to text.

Run `supabase/preflight.sql` in the Supabase SQL editor. Check that existing listing columns match the directory: `id`, `name`, `urlSlug`, `tagline`, `description`, `website`, `address`, `city`, `state`, `zip`, `coverPhoto`, `photos`, `isFeatured`, `isVerified`, `latitude`, and `longitude`. Confirm management table names do not conflict. Camel-case identifiers must match exactly.

Back up the database and apply all files in `supabase/migrations/` in order to a staging copy first, including the conflict-response follow-up. New foreign keys preserve the existing ID type. The first migration converts ZIP codes to text, preserving existing values and allowing blank values, leading zeros, and ZIP+4 in future edits. Previously discarded leading zeros cannot be recovered automatically. Local PostgreSQL tests exercise UUID/JSON-photo and bigint/text-array-photo configurations, including numeric ZIP conversion; reconcile any other existing types before applying to production.

The migration removes all browser writes to the base `places` table and grants only an explicit list of public content columns for compatibility with the currently published beta site. Future private columns receive no read grants. The new website uses the narrower `public_places` projection. The migration closes browser writes to the dedicated `place-photos` bucket even if legacy permissive Storage policies exist, and preserves `profiles`, `favorites`, and unrelated Storage policies. Do not restore base-table writes to work around editor errors.

The compatibility grants let the beta backend be installed before publishing the new frontend. The new frontend reads `public_places` and falls back to explicit legacy public columns while that view is missing. Apply migrations through your existing Supabase deployment process. Enable email confirmation in Supabase Auth and allow each tested origin's `/auth/callback` URL.

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
| `STRIPE_SECRET_KEY` | Stripe test key for verification, live key for production |
| `STRIPE_BLOOM_PRICE_ID` | USD $19/month recurring Price ID in the same Stripe mode |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the deployed Stripe destination |
| `MAPBOX_GEOCODING_TOKEN` | Server token for an account eligible for permanent geocoding |
| `BILLING_RECONCILE_SECRET` | Random secret for the hourly reconciliation scheduler |
| `BLOOM_ENABLED` | `false` during setup, `true` after verification |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Keep local function secrets in ignored `.env.local` files. Never commit secrets or expose the service key in frontend configuration.

Deploy `place-management`, `stripe-webhook`, `billing-reconcile`, and `admin-users` with `supabase/config.toml`. Platform JWT checks are disabled intentionally: management validates the token with Supabase Auth and checks current database permissions, the webhook verifies Stripe signatures, reconciliation checks its scheduler secret, and user removal validates the confirmed administrator against current database roles before using the Auth admin API.

Stripe SDK 18.5.0 is pinned. Configure the webhook destination to the SDK's default API version, `2025-08-27.basil`; update code and tests together when upgrading. Invoice subscription references and subscription-item billing periods use this API's shapes.

### Stripe settings

Create a Bloom product with one USD $19/month recurring price and no trial. Configure the customer portal for payment methods, invoices, and cancellation at period end. Disable plan switching until Thrive is implemented. Enable Stripe payment-failure emails. Configure retries to keep subscriptions `past_due` for the seven-day grace window before marking them `unpaid` or `canceled`.

Register `/functions/v1/stripe-webhook` on your Supabase project for:

- `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`
- `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`

Eligibility follows verified webhooks, not browser return URLs. Checkout reservations and Stripe idempotency keys prevent duplicate purchases. Existing subscriptions and completed sessions block another checkout. Paid-through dates extend from paid invoices; renewal retries retain the first grace deadline.

### Reconciliation, maps, and storage

Schedule an hourly POST to `/functions/v1/billing-reconcile` with `Authorization: Bearer YOUR_BILLING_RECONCILE_SECRET` through your scheduler or Supabase Cron. Store the header as a scheduler secret. Monitor its non-200 responses, Stripe webhook failures, and Supabase function logs. Reconciliation catches missed events; database-time checks still enforce paid and grace expiry.

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
deno check --node-modules-dir=none supabase/functions/place-management/index.ts supabase/functions/stripe-webhook/index.ts supabase/functions/billing-reconcile/index.ts supabase/functions/admin-users/index.ts
```

Database tests run real PostgreSQL roles, grants, policies, migrations, and RPCs in an embedded instance. Browser tests use test-only auth/API fixtures on a separate local port and never contact production or charge cards. They cover desktop and phone layouts, claims, uploads, publishing, conflicts, billing lockouts, admin assignments, sortable tables, linked users and places, account-removal confirmation and failures, and denied admin access.

In staging, verify real confirmed accounts can claim, receive approval, and subscribe using Stripe test payments. Confirm multiple managers share editing while only the billing contact sees payment information. Exercise failed first payment, renewal, retries, grace expiry, recovery, period-end cancellation, duplicate checkout, and replayed/out-of-order events. Test direct API denial after membership revocation and check fresh content and restored photos in another browser.

## 5. Enable and pause purchases

After verifying the migration, functions, and Stripe lifecycle, set server `BLOOM_ENABLED=true` and frontend `VITE_BLOOM_ENABLED=true`, then rebuild. GitHub Pages reads the frontend flag from repository variable `VITE_BLOOM_ENABLED` and public keys from the existing secrets. The workflow now passes `VITE_MAPBOX_TOKEN` as well.

To pause new subscriptions, turn both flags off and rebuild. Existing paid editing and portal access continue. Existing beta builds retain read access to known public listing columns, allowing a frontend rollback without reopening writes. Preserve memberships, subscriptions, revisions, and Storage objects when reverting application code.
