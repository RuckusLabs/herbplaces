# Little Herb Places launch checklist

Current checkpoint: October 26, 2026. Hosted email delivery is active; the updated frontend is on the launch branch and has not been published. Public Bloom purchases are disabled. A configuration-ready audit does not mean sales are live.

## Completed

- Passwordless existing-account sign-in, new signup, and secure email changes verified with real email; account identity and saved places retained.
- Branded Auth emails and confirmed sender `admin@littleherbplaces.com` configured.
- New pending-item alerts delivered to `lhp@ruckuslabs.co`.
- Customer listing receipt and review decision delivered through the real workflow. Customer and admin retry schedules active; historical setup messages suppressed honestly.
- Sandbox checkout, declined payment, paid editing, portal, renewal failure/recovery, grace expiry, scheduled cancellation, duplicate prevention, and missed-webhook recovery verified. Full evidence is in `place-management-setup.md`, “Hosted sandbox lifecycle verified.”
- Owner onboarding, listing requests, private editing/preview, 10-photo Bloom gallery, account settings, and separate Liked Places/My Places prepared.
- Admin review badges, map review, collapsible navigation, scrolling dialogs, bulk user removal, and permanent listing/image removal prepared and tested.

## Next milestone: publish the reviewed frontend with purchases off

Production repository variables are explicitly set to `VITE_PASSWORDLESS_ENABLED=true` and `VITE_BLOOM_ENABLED=false`; the deployed server purchase flag remains off. The release build verifies the disabled owner checkout on desktop and phone. The confirmed support inbox is `help@littleherbplaces.com`.

Review the local owner/basic-user navigation, sign-in, listing request, My Places, editing/preview, and admin workflows. Review Bloom/Thrive copy, support contact details, membership terms, privacy copy, and the refund wording. Bloom is the implemented $19/month offer; Thrive advertises $49/month per place as an upcoming offering and must not imply its checkout or promotion fulfillment is available.

After approval, merge the launch PR and publish with `VITE_BLOOM_ENABLED=false` and server `BLOOM_ENABLED=false`. Passwordless should use its production default; do not set the legacy password override. This release is a priority because the original password hashes were already removed at the user's request. Check production email-code sign-in, redirects, saved places, owner access, admin permissions, SEO output, and published support/legal links. Keep the disabled-purchase message clear.

## Following milestone: live Stripe configuration and final sales review

Use the Little Herb Places live account, not the old Out There And account. Verify account activation, business/public details, statement descriptor, branding, payout readiness, and the intended recurring offer. Prepare the live product/price, restricted server key, webhook signing secret and subscribed events, portal, allowed return URLs, payment emails/retries, cancellation behavior, and tax configuration. Review the refund policy and seven-day payment-failure grace wording together. Configure each environment coherently; do not mix sandbox prices, keys, webhook secrets, or the remaining sandbox subscription with live billing.

Preserve the sandbox evidence and inventory temporary billing endpoints/test records before switching. Remove the temporary owner-checkout endpoint when it is no longer needed. Review the Makki Home sandbox subscription/listing with the owner before cleanup; do not delete owner edits or start/cancel a live subscription as an automated test.

After final approval, configure live counterparts and enable both purchase flags together with the matching frontend build. Complete an expressly approved first live purchase and verify the signed webhook, membership state, editing, portal, cancellation terms, and receipt. Do not charge an account merely to finish a checklist.

## Operational follow-through

- Confirm permanent geocoding entitlement before enabling real stored Mapbox lookups. Until then, keep uncertain locations in admin review and use the existing manual confirmation workflow.
- Support inbox receipt was confirmed by the owner on October 26. Finalize refund handling before live sales; current copy invites refund inquiries and makes no automatic refund promise.
- Confirm recoverable database and Storage backups before release; database backups alone do not preserve image objects.
- Check delivery failures, exhausted queues, webhook failures, reconciliation errors, pending map reviews, and unfinished image cleanup after launch. `node scripts/check-launch-readiness.mjs` checks configuration and backlog without printing credentials; investigate exhausted jobs before resetting their retry window.
- Repeat real delivery checks after sender/template changes and sandbox lifecycle checks after billing changes. Disposable billing scripts intentionally refuse to create mail-producing fixtures while delivery triggers are active; adapt fixture isolation before reusing them.

## After customers can subscribe reliably

Prioritize listing-completion guidance, useful action links, announcements/events, and measured owner reporting for Bloom. Build Thrive's offering links and a manageable promotion-request/fulfillment workflow before selling it. Define the deliverable and capacity first; validate higher prices against actual customer usage, owner outcomes, and fulfillment time. Annual offers, price increases, and promised promotion cadence need a separate product/pricing review.
