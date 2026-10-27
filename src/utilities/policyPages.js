import { bloomOffer } from '../../supabase/functions/_shared/billingCatalog.js';

// Shared by the interactive pages and their search-readable HTML export.
const support = { text: 'help@littleherbplaces.com', href: 'mailto:help@littleherbplaces.com' };
export const policyPages = {
  privacy: {
    title: 'Privacy at Little Herb Places',
    sections: [
      { heading: 'Your account and saved places', paragraphs: [
        ['We use Supabase to provide email-code sign-in and store your account email, saved places, ownership claims, and management assignments. Sign-in codes and confirmation links are handled by our authentication provider. Never share them with anyone. Guest saves and sign-in return information are stored in your browser.'],
      ] },
      { heading: 'Claims and listing requests', paragraphs: [
        ['Ownership details, business contact information, verification links, and review notes are used by our team to review requests. They are not shown on public listings. Claim drafts can be stored in this browser for up to 24 hours while you sign in. Avoid entering sensitive identification, sign-in codes, passwords, or payment details.'],
        ['Request receipts and review decisions are sent through Resend. These emails can include a listing name, review note, and account links. Our team receives an alert with the place name and a link to review private request details in the admin area.'],
      ] },
      { heading: 'Public listings and payments', paragraphs: [
        ['Published listing details and photos are public and may appear in search engines and share previews. Published revisions and photos are retained to support restoration until the listing is removed. Canceling a subscription does not remove a listing.'],
        ['Stripe handles checkout, payment methods, and invoices. Our system stores Stripe customer and subscription references and subscription status; our forms do not collect card numbers.'],
      ] },
      { heading: 'Website usage, maps, and community emails', paragraphs: [
        ['The site loads Simple Analytics to measure website usage. See ', { text: 'Simple Analytics privacy information', href: 'https://www.simpleanalytics.com/privacy-policy' }, '.'],
        ['When business activity reporting is enabled, we count profile views and clicks on website, phone, directions, offering, event, and announcement links. We store the action type, listing and item references, timestamp, random event reference, and a daily-changing keyed hash of the request IP to limit repeat actions and abuse. Raw IP addresses and full destination URLs are not stored in these activity records. Records are retained for up to 90 days, and approved managers can view aggregate reports for their own listings. Activity collection honors the browser Do Not Track setting. Our infrastructure providers may separately process standard request logs.'],
        ['Maps use Mapbox. When you choose Places Near Me, your browser asks for location permission and uses your location to show nearby results. Location coordinates can appear in the resulting page URL; take care when sharing it.'],
        ['Community newsletter signup is separate from your website account and is handled through Mailchimp. You can unsubscribe using the link in newsletter emails. External booking, shopping, and social links have their own privacy practices.'],
        ['Optional monthly business activity reports are sent through Resend only after an approved manager opts in for a place. Reports go to that manager’s confirmed account email and include aggregate activity for the completed calendar month. Report delivery snapshots and history are cleared by scheduled cleanup after 13 months; raw activity records have their separate retention period. You can turn reports off in Business Tools or use the unsubscribe link in a report email. Subscription and community newsletter preferences are separate.'],
      ] },
      { heading: 'Access, corrections, and deletion', paragraphs: [
        ['Email ', support, ' to ask about your information, correct a listing, or request account deletion. We may need to verify your identity or transfer billing responsibility first. Removing an account does not automatically remove its public listings, published photos, or revision history. Contact us separately about removing listing content. Browser drafts expire when read after their retention period and are cleared when a claim is submitted; you can also clear this site’s browser storage.'],
      ] },
    ],
  },
  terms: {
    title: 'Membership Terms',
    sections: [
      { heading: 'Accounts, ownership, and access', paragraphs: [
        ['A free account lets you save places and submit requests. Claims are reviewed before management access is granted. Submit accurate details and claim only a business you own or are authorized to manage. Creating an account or receiving claim approval does not start a paid subscription.'],
        ['Ownership verification is independent of payment and is not an endorsement of medical advice, products, or services. Contact us about disputed ownership or inaccurate information.'],
      ] },
      { heading: 'Bloom subscriptions', paragraphs: [
        [`The Bloom launch offer is ${bloomOffer.label}, billed in USD. Checkout shows the charge before you pay. Each place has its own subscription, covering its approved managers. Only its billing contact can manage payment details. Bloom enables editing and photo uploads; it does not guarantee traffic, sales, search rankings, or promotional placements.`],
        ['Subscriptions renew monthly until canceled. Use My Places → Manage Billing with Stripe to cancel the next renewal. Period-end cancellation retains editing through the paid period. Eligible failed renewals allow seven days of editing from the first failure, after which editing pauses until payment is resolved. Published content remains visible.'],
      ] },
      { heading: 'Refunds', paragraphs: [
        ['You can request a refund of the first Bloom subscription payment for a place within seven days of that payment. Email ', support, ' with the listing name and invoice reference. Renewal payments are reviewed for billing errors; the seven-day first-payment refund does not apply to renewals. Requesting a refund does not cancel future renewals. Cancel those separately through My Places → Manage Billing with Stripe.'],
      ] },
      { heading: 'Your listing content', paragraphs: [
        ['Publish accurate information and only text, photos, and links you have permission to share publicly. Our team may correct or remove inappropriate or inaccurate content and review management access. Published revisions and photos are retained for restoration until the listing is removed.'],
        ['Approved managers can correct essential visit and contact information without subscribing when Essential Details tools are enabled, or ask our team for a free correction. Business announcements and events expire according to their published dates. Customers follow external links to shop, book, or register directly with each business. Activity reports count recorded actions and do not establish unique visitors, completed bookings, calls, or sales.'],
      ] },
      { heading: 'Upcoming offers and billing questions', paragraphs: [
        ['Thrive is not available for purchase. Invitation-only pilot access is time-limited and agreed individually; it creates no Thrive subscription or payment. Paid pricing is planned at $49 USD per month per place, with features and terms confirmed before checkout opens. Newsletter coverage, sponsored spotlights, reach, and sales are not guaranteed pilot deliverables. A request for information does not reserve a paid placement or start a subscription.'],
        ['Contact ', support, ' about billing errors, refund requests, or account changes. Include your listing name and invoice reference, never sign-in codes, passwords, or card details.'],
      ] },
    ],
  },
};
