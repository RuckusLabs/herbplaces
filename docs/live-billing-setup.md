# Live billing setup

Checkpoint: October 26, 2026. The website is published; new purchases remain disabled in both the frontend and hosted server. This document records preparation, not authorization to charge a customer.

## Verified live configuration

Use only Little Herb Places LIVE, `acct_1UT1v28pv7NMGO0i`. The latest account read reports payments and payouts enabled, details submitted, no currently due requirements, and no pending verification. The owner completed private onboarding directly in Stripe. Branding uses primary `#2c542f`, accent `#eaff82`, and the uploaded logo/icon. Support is `help@littleherbplaces.com`.

- Product: `little_herb_places_bloom`, listing-management software for business use, up to 10 photos and all approved managers. Statement descriptor: `LITTLE HERB PLACES`.
- Price: `price_1UUxvw8pv7NMGO0iEWnRIsDq`, active USD 1900 cents/month, licensed, per-unit, quantity one per place, no trial. Tax behavior is exclusive, following the owner's choice to add applicable tax at checkout.
- Default portal: `bpc_1UUxwM8pv7NMGO0izPH5flaS`. Invoices, payment-method updates, address updates, and period-end cancellation without proration enabled. Plan switching, email/name identity edits, and public email-login link disabled. Published privacy and membership terms linked; return URL is `/my-places/`.
- Enabled webhook: `we_1UUxzc8pv7NMGO0iItz6jLvN`, endpoint `https://qtpepsebztlremlhpxdt.supabase.co/functions/v1/stripe-webhook`, API `2026-09-30.endive` matching the pinned SDK. Events: Checkout completed/async success; subscription created/updated/deleted/paused/resumed; invoice created/finalized/paid/payment failed/payment action required/finalization failed.

The restricted live server key passed reads for prices, products, customers, subscriptions, invoices, and the default portal. Required write permissions are Customers, Checkout Sessions, and Customer portal; these have not been exercised by creating live customer fixtures. Signing configuration passed a harmless signed live no-op event (HTTP 200); invalid signatures were rejected (HTTP 400). This is not evidence of a Stripe-delivered paid subscription lifecycle.

Hourly reconciliation is active again; its authenticated dispatch returned HTTP 200 with zero failures and zero subscriptions to reconcile. Customer and admin email schedules remain active. The temporary `live-billing-readiness` helper and dedicated secret were removed after verification; the older `bloom-owner-checkout` bypass was also removed.

## Tax

The owner confirmed an existing United States, Arizona registration. Stripe's active record is `taxreg_1UV0W98pv7NMGO0iYE5Frz9N`; adding this record does not register the business with a government agency. Tax Settings are active and the owner supplied the head-office address directly.

Bloom uses product tax code `txcd_10103001`, Software as a service (SaaS) - business use, based on the implemented listing-management tools. Promotion and paid placement are outside this offer. Revisit classification if the offer changes.

One live calculation preview on a $19 item at the private Arizona sample address returned $1.16 tax, $20.16 total, standard-rated. This is address-specific, not a statewide rate. Stripe charges for live calculation API calls; no customer payment was created.

The hosted `STRIPE_AUTOMATIC_TAX_ENABLED=true` enables Checkout automatic tax, requires a billing address, and updates the Stripe customer's address for calculation. The server refuses tax-enabled checkout unless the price is exclusive. Public offer copy in PR #12 says "$19/month per place, plus applicable tax."

## Environment and retained data

Hosted `STRIPE_LIVEMODE_REQUIRED=true` rejects non-live keys before contacting Stripe in all four billing functions. Signed events from other environments are ignored. Live price, server key, and signing secret are installed securely; never record credential values in documentation, chat, browser code, logs, or PRs. `BLOOM_ENABLED=false`; frontend `VITE_BLOOM_ENABLED=false` remains published.

The owner requested no further test-account operations. Earlier sandbox lifecycle evidence is retained as history. Makki Home's former sandbox subscription was canceled to unblock deletion; canceled billing references were privately archived/detached for live-only operation. Content, photos, accounts, and memberships were preserved. Do not restore sandbox IDs or delete the listing merely to change billing environments.

## Remaining sales review

Following explicit owner approval, the live Dashboard now sends upcoming-renewal emails seven days ahead, expiring-card emails, failed-card emails, and Stripe-hosted required-payment-confirmation links. Required-payment confirmation reminders retain Stripe's existing three/five/seven-day schedule; incomplete subscriptions cancel after seven days. Card Smart Retries allow four attempts within one week, with the existing cancel-on-exhaustion action. These settings were saved and read back after a reload. Trial/bank-debit emails, invoice handling, and unrelated preferences were preserved.

Following separate explicit owner approval of Stripe's irreversible migration, billing-email payment-update links now use Stripe-hosted pages. The selected hosted option persisted after reloading the live Dashboard. Required-payment-confirmation links also use Stripe-hosted pages.

The owner approved a seven-day refund of the first Bloom subscription payment per place; renewals are reviewed for billing errors. Membership terms and Help now state this policy, the support contact, and that a refund request does not cancel future renewals. Refund processing remains a manual support operation in Stripe. Review this copy before publication. Confirm database and Storage recovery coverage and permanent geocoding entitlement/manual-review handling. Keep purchases off until the final sales review. Then publish the matching frontend/server flags together and obtain explicit approval for a first live purchase; verify actual Stripe delivery, membership, editing, receipt, portal, and cancellation. Do not charge a customer as an automatic smoke test.

References: [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live), [customer portal configuration](https://docs.stripe.com/api/customer_portal/configurations), [Stripe Tax setup](https://docs.stripe.com/tax/set-up), [Checkout tax](https://docs.stripe.com/payments/checkout/taxes?ui=full-page).


## Final review checkpoint

PR #12 passed CI at `8713b7f` before the final refund-copy update. Both purchase flags remain false. A fresh private supplemental snapshot contains 16 application tables and all 18 place-photos objects (4,570,198 bytes); saved photo bytes were hashed and checked. This local snapshot excludes Auth, SQL schema, secrets, platform configuration, and Stripe records. It does not establish automated off-device backup coverage or a tested full restore. Keep the October 21 schema/function evidence as history. Permanent Mapbox geocoding entitlement remains unverified; a geocoding credential is present, so verify entitlement before relying on stored automatic lookups.

Supabase Dashboard's Scheduled backups page explicitly reports the organization is on Free and project backups are not included. Automated hosted database recovery is therefore a confirmed launch gap, not merely unverified. No plan upgrade was purchased. The owner is reviewing Pro plus separate photo backups versus an off-device backup system, and permanent-geocoding entitlement/manual placement. Publication and purchases remain unchanged pending this milestone.


## Separate backup preparation and geocoding pause

The owner chose separate off-device backups and explicitly paused automatic geocoding. Hosted `AUTOMATIC_GEOCODING_ENABLED=false` and the deployed management function prevent Mapbox calls; existing confirmed coordinates are preserved and new/unconfirmed addresses enter manual review. Re-enable only after permanent-storage entitlement is confirmed.

The dedicated private repository `RuckusLabs/herbplaces-backups` contains a gated daily encrypted export job. It remains disabled pending `BACKUP_DATABASE_URL`, a secure second copy of the private recovery key, an actual export, isolated restore verification, and a scheduled-run check. No Storage admin key is required: the job uses the database object index and public photo downloads. Database URL credentials and private recovery keys must never enter chat, logs, source commits, or public artifacts.

A local AES-GCM/RSA-wrapped copy of the supplemental safety snapshot passed decryption/hash round-trip verification. Unit tests verify round trip, tamper rejection, wrong-key rejection, and failed-decryption cleanup. This is not a complete database restore. The owner chose to keep the encrypted snapshot local; no customer records or photos were uploaded to GitHub. Do not upload it or activate scheduled exports without a new explicit instruction authorizing the data and destination. See `ops/backups/README.md` for activation, retention, recovery limits, and the private-repository gate. Public purchases remain off.


## Owner-directed launch scope

The owner explicitly asked to set aside backups and map placement and continue. Leave backup activation/data uploads out of this release, keep the safety snapshot local, and preserve the geocoding pause/manual map workflow. Proceed to the final publication and live-sales approval milestone without treating those deferred tasks as prerequisites. Do not describe automated backup recovery as complete.
