# Little Herb Places launch checklist

Current checkpoint: October 26, 2026. Hosted email delivery is active. PR #11 was merged and the updated frontend is published at https://littleherbplaces.com. Public Bloom purchases are disabled. A configuration-ready audit does not mean sales are live.

## Completed

- Passwordless existing-account sign-in, new signup, and secure email changes verified with real email; account identity and saved places retained.
- Branded Auth emails and confirmed sender `admin@littleherbplaces.com` configured.
- New pending-item alerts delivered to `lhp@ruckuslabs.co`.
- Customer listing receipt and review decision delivered through the real workflow. Customer and admin retry schedules active; historical setup messages suppressed honestly.
- Sandbox checkout, declined payment, paid editing, portal, renewal failure/recovery, grace expiry, scheduled cancellation, duplicate prevention, and missed-webhook recovery verified. Full evidence is in `place-management-setup.md`, “Hosted sandbox lifecycle verified.”
- Owner onboarding, listing requests, private editing/preview, 10-photo Bloom gallery, account settings, and separate Liked Places/My Places prepared.
- Admin review badges, map review, collapsible navigation, scrolling dialogs, bulk user removal, and permanent listing/image removal prepared and tested.

## Completed milestone: published frontend with purchases off

Production repository variables are explicitly set to `VITE_PASSWORDLESS_ENABLED=true` and `VITE_BLOOM_ENABLED=false`; the deployed server purchase flag remains off. The release build verifies the disabled owner checkout on desktop and phone. The confirmed support inbox is `help@littleherbplaces.com`.

Review the local owner/basic-user navigation, sign-in, listing request, My Places, editing/preview, and admin workflows. Review Bloom/Thrive copy, support contact details, membership terms, privacy copy, and the refund wording. Bloom is the implemented $19/month offer; Thrive advertises $49/month per place as an upcoming offering and must not imply its checkout or promotion fulfillment is available.

The approved release was merged as `cf3b0205ee1189b2cc3a6cfed0530257520d0a1b` and published through the normal Pages workflow with `VITE_BLOOM_ENABLED=false` and server `BLOOM_ENABLED=false`. Live read-only desktop/mobile checks verified the email-code sign-in screen, owner sales entry, protected My Places redirect, Bloom purchase-disabled messaging, and unavailable Thrive plan. Full policy HTML, robots.txt, and sitemap.xml are served. Actual account verification and saved-place continuity were previously tested against the same hosted backend; the release smoke check did not send another email or submit customer data.

## Current milestone: live Stripe configuration and final sales review

The Little Herb Places live account `acct_1UT1v28pv7NMGO0i` now has payments and payouts enabled with no outstanding verification. The restricted live key passed read checks; the live price, default portal, enabled webhook, signed receiver, and hourly reconciliation are verified. Arizona registration and exclusive tax are configured; automatic-tax checkout collects the billing address. A $19 preview at the checked Arizona address returned $1.16 tax; rates vary by customer address. See `live-billing-setup.md` for IDs and practical verification limits.

Review PR #12's "$19/month per place, plus applicable tax" copy, payment-reminder emails, required-payment confirmation, seven-day retries/grace alignment, and refund handling. Dashboard email switches are currently off; Smart Retries are eight attempts over two weeks. Purchases remain off. No live customer payment was created.
Preserve the sandbox evidence and inventory temporary billing endpoints/test records before switching. The temporary `bloom-owner-checkout` endpoint has been removed. The client bypass is retired in the follow-up branch, and the launch audit now refuses any remaining known temporary billing endpoint. The owner requested unblocking Makki Home deletion, so its sandbox subscription was canceled and its canceled billing references were then archived/detached for the requested live-only transition. Listing content, images, and memberships were preserved. Do not start/cancel a live subscription as an automated test.

After final approval, enable both purchase flags together with the matching frontend build. Complete an expressly approved first live purchase and verify the signed webhook, membership state, editing, portal, cancellation terms, and receipt. Do not charge an account merely to finish a checklist.

## Operational follow-through

- Confirm permanent geocoding entitlement before enabling real stored Mapbox lookups. Until then, keep uncertain locations in admin review and use the existing manual confirmation workflow.
- Support inbox receipt was confirmed by the owner on October 26. Finalize refund handling before live sales; current copy invites refund inquiries and makes no automatic refund promise.
- Confirm recoverable database and Storage backups before release; database backups alone do not preserve image objects.
- Check delivery failures, exhausted queues, webhook failures, reconciliation errors, pending map reviews, and unfinished image cleanup after launch. `node scripts/check-launch-readiness.mjs` checks configuration and backlog without printing credentials; investigate exhausted jobs before resetting their retry window.
- Repeat real delivery checks after sender/template changes. The owner requested live-only operation; use local/mocked checks for further development and obtain explicit approval for any real purchase. Disposable billing scripts intentionally refuse to create mail-producing fixtures while delivery triggers are active; adapt fixture isolation before reusing them.

## After customers can subscribe reliably

Prioritize listing-completion guidance, useful action links, announcements/events, and measured owner reporting for Bloom. Build Thrive's offering links and a manageable promotion-request/fulfillment workflow before selling it. Define the deliverable and capacity first; validate higher prices against actual customer usage, owner outcomes, and fulfillment time. Annual offers, price increases, and promised promotion cadence need a separate product/pricing review.
