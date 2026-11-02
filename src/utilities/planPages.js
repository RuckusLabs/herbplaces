import { bloomOffer } from '../../supabase/functions/_shared/billingCatalog.js';

export const gardenPlanNotes = [
  { number: 1, label: 'free access', text: 'Businesses can request a listing, claim ownership, and correct essential information for free.' },
  { number: 2, label: 'billing terms', text: `Bloom is ${bloomOffer.label}, and renews monthly until canceled. Cancel in Manage Billing with Stripe to stop the next renewal; editing continues through the paid period. Published listings stay visible after editing access ends.` },
  { number: 3, label: 'ownership verification', text: 'Ownership verification is independent of payment. A verified listing is not an endorsement of products or medical advice.' },
];

export const ownerSteps = [
  { title: 'Find your place', text: 'Search the directory. If your place is missing, send a free listing request and follow its review status in Your Listing Requests.' },
  { title: 'Claim your listing', text: 'Once the listing is available, open it and choose Claim This Place. Sign in or create a free account, confirm your email, and share your connection to the business.' },
  { title: 'Get approved', text: 'Our team reviews your claim. Adding a listing and approving its managers are separate steps. You can follow your claim in My Places; no payment is taken during review.' },
  { title: 'Make it your own', text: 'After ownership approval, your billing contact can choose Bloom. If purchases are paused, the site explains that before checkout. All approved managers can then edit the place page, while the billing contact manages the subscription in My Places.' },
];

export const planPages = {
  bloom: {
    name: 'Bloom', icon: 'sun', heroPhoto: '/assets/examples/shop-interior.webp', heroAlt: 'A sunlit botanical shop with a wooden workshop table', heroPosition: 'center 48%', eyebrow: 'For the people behind the place',
    heading: 'Help the right people choose your place.',
    title: 'Bloom | Manage Your Herb Business Listing | Little Herb Places',
    description: 'Keep your herb shop, herbal practice, or garden listing current with Bloom. Share photos, hours, and useful links for $19/month per place, plus applicable tax, after ownership approval.',
    intro: 'Give your business a profile you can care for: your story and photos, products, services, workshops, and a clear link to shop or book, and activity reports that help you choose what to improve next. Start with a free ownership claim; Bloom is $19/month per place after approval.',
    price: bloomOffer.amount / 100, priceNote: 'USD / month per place · plus applicable tax · renews monthly',
    priceFootnote: 'USD, plus applicable tax. Renews monthly; cancel future renewals in Manage Billing.',
    sectionTitle: 'A profile that helps people take the next step.',
    sectionIntro: 'Bloom puts your listing in the hands of the people who know it best. Keep the essentials together, and give visitors a reason to take a closer look.',
    features: [
      { icon: 'plan-story', title: 'Tell Your Story', text: 'Edit your approved listing’s description and tagline. Introduce your practice, your shop, or the way you welcome people into your space.' },
      { icon: 'plan-gallery', title: 'Let Your Space Speak', text: 'Add and arrange up to 10 photos. Choose a cover image and show the shelves, garden paths, or small details that make your place feel like yours.' },
      { icon: 'plan-contact', title: 'Make the Next Step Easy', text: 'Keep hours, contact details, your website, and social links together, so visitors can find the information they need before getting in touch.' },
      { growthOnly: true, icon: 'plan-action', title: 'Choose a Clear Next Step', text: 'Add a prominent button to your booking page, online shop, classes, or contact page.' },
      { growthOnly: true, icon: 'plan-announcement', title: 'Give People a Reason to Return', text: 'Share one scheduled announcement or seasonal offer, with an expiry date that keeps old information out of the way.' },
      { growthOnly: true, icon: 'plan-offerings', title: 'Show What You Offer', text: 'Showcase up to 10 products or services with descriptions, prices, photos, and links to your existing shop or booking page.' },
      { growthOnly: true, icon: 'plan-events', title: 'Welcome People to Your Events', text: 'Publish up to 10 workshops or events with dates, time zones, locations, and registration links. Visitors can discover your offerings and upcoming events by topic, business, or city.' },
      { growthOnly: true, icon: 'plan-report', title: 'See What People Explore', text: 'Review profile views, customer-action clicks, and interest in individual offerings and events over the last 30 days, compare with the previous period, and download a daily report.' },
      { growthOnly: true, emailOnly: true, icon: 'plan-email', title: 'A Monthly Update in Your Inbox', text: 'Opt into a business activity email for each completed calendar month, with the previous month for comparison. Each approved manager controls their own report preference.' },
      { growthOnly: true, icon: 'plan-access', title: 'Help Visitors Find Their Fit', text: 'Share specialties, languages, and factual access information. Use a completion checklist to make your profile useful.' },
      { icon: 'plan-team', title: 'Care for It Together', text: 'One subscription covers one place and all its approved managers. Each manager uses their own account; your designated billing contact handles payment.' },
    ],
    showcaseTitle: 'Help a curious visitor become a familiar face.',
    showcaseText: 'A thoughtful description, current hours, and photos of your space help people decide whether to visit or contact you. Update your listing directly on its place page as your business changes.',
    showcaseNote: 'People shop and book on your website. Activity reports measure interest, not confirmed bookings or sales.',
    faqs: [
      { question: 'Does my place need Bloom to be listed?', answer: 'No. Requesting a listing and claiming ownership are free. Bloom enables richer listing edits and photo uploads. Essential information corrections remain free; contact our team or use Essential Details when those tools are enabled.' },
      { question: 'What if my place isn’t in the directory yet?', answer: 'Send a free listing request first. After our team adds or links the listing, open it and submit an ownership claim. Listing approval does not automatically approve you as a manager.' },
      { question: 'When do I pay?', answer: 'Only after your ownership claim has been approved and you choose to subscribe. There is no charge to send a listing request or ownership claim.' },
      { question: 'Can I cancel?', answer: 'Yes. Cancel future renewals in Manage Billing with Stripe from My Places. Editing continues through the paid period, and your published listing stays visible after editing access ends.' },
      { question: 'Is the price per manager or per place?', answer: 'Bloom is $19 USD per month per place, plus applicable tax. All approved managers of that place are included; a separate place needs its own subscription.' },
    ],
  },

};

export const getPlanFeatures = (plan, growthEnabled = false, emailReportsEnabled = false) => planPages[plan].features.filter(feature => (!feature.growthOnly || growthEnabled) && (!feature.emailOnly || emailReportsEnabled));
export const getPlanIntro = (plan, growthEnabled = false) => plan === 'bloom' && !growthEnabled
  ? 'Give your business a profile you can care for: your story, up to 10 photos, and useful website and contact links. Start with a free ownership claim; Bloom is $19/month per place after approval.'
  : planPages[plan].intro;

export const getBusinessPlans = ({ growthEnabled = false, bloomAvailable = false, emailReportsEnabled = false } = {}) => [
  { name: 'Bloom', icon: 'sun', description: 'Help the right people choose your business.', price: `$${bloomOffer.amount / 100}`, features: ['Your Story and up to 10 Photos', 'Hours, Contact Details, and Links', ...(growthEnabled ? ['A Clear Booking or Shopping Action', '10 Products or Services', '10 Workshops or Events', 'Specialties and a Current Announcement', '30-day Activity Report and CSV'] : []), ...(growthEnabled && emailReportsEnabled ? ['Optional Monthly Email Summary'] : []), 'All Approved Managers Included'], available: bloomAvailable, path: '/the-little-garden/bloom', action: 'Explore Bloom' },
];
