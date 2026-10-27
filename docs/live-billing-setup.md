# Live billing setup

Checkpoint: October 26, 2026. The website is published. New purchases are disabled in the deployed server and frontend. This document records preparation; it does not authorize a live charge or replacing the working sandbox configuration.

## Confirmed live account

Little Herb Places: `acct_1UT1v28pv7NMGO0i`. The sandbox used for lifecycle verification is the separate account `acct_1UT1vP6cqRdXwH7O`. Do not use Out There And or the live account's shared test mode by mistake.

The live read-only check found:

- Payments and payouts disabled; representative/business details and Stripe agreement acceptance incomplete. No payout account is configured.
- Logo/icon present; primary `#2c542f`, accent `#eaff82`.
- No live products/prices, customer portal configurations, or webhook endpoints.
- Tax Settings pending the head-office address; no tax registrations recorded.
- Connector reads work, but the attempted live product creation was rejected with a reauthorization requirement. No successful product creation has been recorded. Refresh access and recheck the catalog before retrying; never blindly repeat a creation after an uncertain outcome.

The owner must complete business identity, payout information, and Stripe agreements directly in the Dashboard. Do not invent a business category, legal entity, representative details, phone number, or tax registration. The confirmed public support inbox is `help@littleherbplaces.com`; the site is `https://littleherbplaces.com`.

## Prepared live offer and portal

Create or reuse one Bloom product with one USD $19/month licensed, per-unit recurring price and quantity one per place. Include listing edits, up to 10 photos, hours/contact/social links, and all approved managers. There is no trial, annual offer, Thrive checkout, or per-manager charge. Use `LITTLE HERB PLACES` as the proposed descriptor, subject to the owner's Stripe business details review. Leave tax classification and inclusive/exclusive treatment unresolved until the tax review; creating a price must not silently decide that policy.

The portal should use published `/privacy/` and `/membership-terms/` URLs and return to `/my-places/`. Enable invoices, payment-method changes, and cancellation at period end. Disable plan switching and the public email-login portal link; authenticated My Places creates each billing-contact portal session. Keep billing identity changes limited to the agreed scope. Confirm the selected configuration is the default because the current app does not supply a configuration ID.

Configure payment-failure emails and retry/end-state behavior to match the seven-day editing grace period. Confirm these account-level settings in the Dashboard; creating a portal alone does not establish them. Review the refund wording and any tax obligations before enabling sales. Do not promise a refund window without the owner's decision.

## Webhook and coherent cutover

The signed live webhook must target `https://qtpepsebztlremlhpxdt.supabase.co/functions/v1/stripe-webhook` and match the pinned SDK/API version `2026-09-30.endive`. Required events:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`
- `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`

Prepare the live price ID, restricted server key, webhook signing secret, and portal as a coherent set. Until the cutover, do not replace the current sandbox key or send live events to a receiver configured with only the sandbox signing secret. Never put credential values in this document, browser code, chat, command logs, or a PR. Use the protected Supabase secret workflow.

The runtime restricted LIVE key needs Customers, Checkout Sessions, and Customer portal Write; Prices, Products, Subscriptions, and Invoices Read. Catalog/webhook administration should use separately authorized setup access. Verify actual permissions through read-only probes and the reviewed purchase flow; don't widen access without a concrete requirement.

Makki Home’s former sandbox subscription was canceled at the owner’s request to unblock listing deletion. The signed webhook updated the app to canceled. After the owner requested live-only operation, its canceled sandbox references were privately archived and detached, preserving the listing, photos, account, and membership. No live subscription was canceled. Do not copy those customer/subscription/Checkout IDs back into live mode. Do not delete the listing merely to change billing environments.

The temporary `bloom-owner-checkout` function was removed during preparation. The follow-up client no longer routes to it, and the read-only launch audit checks for known temporary billing endpoints and missing required functions. Its `configuration_ready` result only covers server configuration; `live_sales_ready` is intentionally unassessed rather than implied by secret-name presence.

After reviewing activation, billing settings, sandbox cleanup, support/refunds, tax, and live credentials, enable both purchase flags with the matching production build. A first live purchase needs explicit approval. Verify the signed webhook, membership, editing, receipts, portal, and cancellation; do not run a live charge as an automatic smoke test.

References: [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live), [account checklist](https://docs.stripe.com/get-started/account/checklist), [customer portal configuration](https://docs.stripe.com/api/customer_portal/configurations), [Stripe Tax setup](https://docs.stripe.com/tax/set-up).


## Live-only setup now prepared

After renewed authorization, the connector exposes only the Little Herb Places live account. The following live objects were created and read back successfully:

- Product: `little_herb_places_bloom`.
- Price: `price_1UUxvw8pv7NMGO0iEWnRIsDq`, active USD 1900 cents/month, licensed, per-unit, quantity one, no trial. Tax behavior remains unspecified pending review.
- Default portal: `bpc_1UUxwM8pv7NMGO0izPH5flaS`, invoices/payment updates enabled, cancellation at period end without proration, plan switching/customer-identity edits/public email portal login disabled. Published privacy/terms links and the My Places return URL are saved.
- Webhook: `we_1UUxzc8pv7NMGO0iItz6jLvN`, API `2026-09-30.endive`, all 13 lifecycle events above. It is deliberately disabled during credential setup. Its signing secret is securely installed in Supabase and is not recorded here.

Supabase has the live price and webhook signing secret, `STRIPE_LIVEMODE_REQUIRED=true`, and `BLOOM_ENABLED=false`. The hosted `place-management`, `stripe-webhook`, `billing-reconcile`, and `admin-places` functions now enforce the live-only key guard before creating a Stripe client. Signed events with a mismatched environment are ignored. This prevents the still-stored old test API key from being used while the owner replaces it with the restricted LIVE key; the key itself is never exposed by the check. The initial credential probe reported a test key and made zero Stripe requests. No further sandbox account operations are performed.

Hourly billing reconciliation is paused using `cron.alter_job`, preserving its configuration. Customer and admin notification schedules remain active. A secret-protected, read-only `live-billing-readiness` helper expires after one hour, refuses any non-live key before contacting Stripe, and checks the live price, product, read permissions, and default portal. Remove this helper and its dedicated setup secret after verification. Once the owner has saved the live key, rerun the private probe, confirm account activation and policy/tax/retry settings, enable the live webhook, and resume billing reconciliation. Keep new purchases off until the final sales review.

The latest live account check still reported payments/payouts disabled and onboarding incomplete. Connector authorization and payment activation are separate. No live purchase or live customer fixture was created to prepare this configuration.
