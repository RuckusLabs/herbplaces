import { bloomOffer, thriveOffer } from '../../supabase/functions/_shared/billingCatalog.js';

export const gardenPlanNotes = [
  { number: 1, label: 'free access', text: 'Sprout is our free community plan for discovering and saving places. Businesses can request a listing, claim ownership, and correct essential information for free.' },
  { number: 2, label: 'billing and pilot terms', text: `Bloom is ${bloomOffer.label}, and renews monthly until canceled. Cancel in Manage Billing with Stripe to stop the next renewal; editing continues through the paid period. Published listings stay visible after editing access ends. Thrive is not available for purchase. Its invitation-only pilot has an agreed end date and collects no Thrive payment.` },
  { number: 3, label: 'ownership verification', text: 'Ownership verification is independent of payment. A verified listing is not an endorsement of products or medical advice.' },
];

export const ownerSteps = [
  { title: 'Find your place', text: 'Search the directory. If your place is missing, send a free listing request and follow its review status in Your Listing Requests.' },
  { title: 'Claim your listing', text: 'Once the listing is available, open it and choose Claim This Place. Sign in or create a free account, confirm your email, and share your connection to the business.' },
  { title: 'Get approved', text: 'Our team reviews your claim. Adding a listing and approving its managers are separate steps. You can follow your claim in My Places; no payment is taken during review.' },
  { title: 'Make it your own', text: 'After ownership approval, your billing contact can choose Bloom when checkout is enabled. All approved managers can then edit the place page, while the billing contact manages the subscription in My Places.' },
];

export const planPages = {
  bloom: {
    name: 'Bloom', icon: 'sun', heroPhoto: '/assets/pages/home/hero.jpg', heroAlt: 'Hands tending fresh herbs in a wooden planting tray', heroPosition: 'center 32%', eyebrow: 'For the people behind the place',
    heading: 'Help the right people choose your place.',
    title: 'Bloom | Manage Your Herb Business Listing | Little Herb Places',
    description: 'Keep your herb shop, herbal practice, or garden listing current with Bloom. Share photos, hours, and useful links for $19/month per place, plus applicable tax, after ownership approval.',
    intro: 'Turn a curious visitor into someone ready to visit, shop, or get in touch. Give your business a useful home in a directory built around herbs, plants, and the people who care for them.',
    price: bloomOffer.amount / 100, priceNote: 'USD / month per place · plus applicable tax · renews monthly',
    sectionTitle: 'A profile that helps people take the next step.',
    sectionIntro: 'Bloom puts your listing in the hands of the people who know it best. Keep the essentials together, and give visitors a reason to take a closer look.',
    features: [
      { icon: 'book', title: 'Tell your story', text: 'Edit your approved listing’s description and tagline. Introduce your practice, your shop, or the way you welcome people into your space.' },
      { icon: 'polaroid', title: 'Let your space speak', text: 'Add and arrange up to 10 photos. Choose a cover image and show the shelves, garden paths, or small details that make your place feel like yours.' },
      { icon: 'brand-clock', title: 'Make the next step easy', text: 'Keep hours, contact details, your website, and social links together, so visitors can find the information they need before getting in touch.' },
      { growthOnly: true, icon: 'arrow', title: 'Choose a clear next step', text: 'Add a prominent button to your booking page, online shop, classes, or contact page.' },
      { growthOnly: true, icon: 'sparkles', title: 'Give people a reason to return', text: 'Share one scheduled announcement or seasonal offer, with an expiry date that keeps old information out of the way.' },
      { growthOnly: true, icon: 'book', title: 'See what people explore', text: 'Review the last 30 days of profile views and customer-action clicks, compare with the previous period, and download a daily report.' },
      { growthOnly: true, emailOnly: true, icon: 'brand-clock', title: 'A monthly update in your inbox', text: 'Opt into a business activity email for each completed calendar month, with the previous month for comparison. Each approved manager controls their own report preference.' },
      { growthOnly: true, icon: 'garden', title: 'Help visitors find their fit', text: 'Share specialties, languages, and factual access information. Use a completion checklist to make your profile useful.' },
      { icon: 'group', title: 'Care for it together', text: 'One subscription covers one place and all its approved managers. Each manager uses their own account; your designated billing contact handles payment.' },
    ],
    showcaseTitle: 'Help a curious visitor become a familiar face.',
    showcaseText: 'A thoughtful description, current hours, and photos of your space help people decide whether to visit or contact you. Update your listing directly on its place page as your business changes.',
    showcaseNote: 'People book and shop directly with your business. Recorded activity measures interest; it does not establish bookings or sales.',
    faqs: [
      { question: 'Does my place need Bloom to be listed?', answer: 'No. Requesting a listing and claiming ownership are free. Bloom enables richer listing edits and photo uploads. Essential information corrections remain free; contact our team or use Essential Details when those tools are enabled.' },
      { question: 'What if my place isn’t in the directory yet?', answer: 'Send a free listing request first. After our team adds or links the listing, open it and submit an ownership claim. Listing approval does not automatically approve you as a manager.' },
      { question: 'When do I pay?', answer: 'Only after your ownership claim has been approved and you choose to subscribe. The site shows whether checkout is currently enabled. There is no charge to send a listing request or ownership claim.' },
      { question: 'Can I cancel?', answer: 'Yes. Cancel future renewals in Manage Billing with Stripe from My Places. Editing continues through the paid period, and your published listing stays visible after editing access ends.' },
      { question: 'Is the price per manager or per place?', answer: 'Bloom is $19 USD per month per place, plus applicable tax. All approved managers of that place are included; a separate place needs its own subscription.' },
    ],
  },
  thrive: {
    name: 'Thrive', icon: 'thrive', heroPhoto: '/assets/pages/home/herb-image-1.jpg', heroAlt: 'A botanical tea blend surrounded by colorful flowers', heroPosition: 'center center', eyebrow: 'Invitation-only pilot · paid plan coming soon',
    heading: 'Give people a reason to shop, book, or join you.',
    title: 'Thrive | Offerings & Workshop Pilot | Little Herb Places',
    description: 'Explore the Thrive pilot: business profiles, searchable products and services, workshops, and activity reports. Planned paid price: $49/month per place.',
    intro: 'Put your products, consultations, and workshops in front of people exploring herb businesses. Join a small pilot to help shape a useful next step beyond your listing.',
    price: thriveOffer.amount / 100, priceNote: 'USD / month per place · planned paid price · pilot by invitation',
    sectionTitle: 'Make room for what you make.',
    sectionIntro: 'The pilot tests whether searchable offerings, timely events, and useful reporting help visitors take the next step. Paid Thrive subscriptions are not open.',
    features: [
      { icon: 'sun', title: 'Pilot: everything in Bloom', text: 'Bring your listing description, photos, hours, links, and approved managers together in one plan.' },
      { icon: 'craft', title: 'Pilot: your offerings, together', text: 'Showcase up to 10 products or services alongside your place listing, so visitors can get a clearer sense of what you offer.' },
      { icon: 'group', title: 'Pilot: workshops and events', text: 'Publish up to 10 upcoming events with dates, location, price information, and registration links. Finished events leave the current discovery feed.' },
      { icon: 'search', title: 'Pilot: more ways to be discovered', text: 'Let visitors search your offerings and upcoming events by topic, kind, business, or city, with a dedicated page for each item.' },
      { icon: 'book', title: 'Pilot: understand interest', text: 'See which offerings and event links receive clicks, alongside profile activity and comparisons with the previous 30 days.' },
    ],
    showcaseTitle: 'From discovery to a useful next step.',
    showcaseText: 'Show a seasonal tea blend with a shop link, a consultation with a booking link, or a workshop with registration details. Give each one a clear destination on your existing website.',
    showcaseNote: 'Pilot access is time-limited and agreed individually. No Thrive payment is collected. Newsletter placements, paid spotlights, reach, and sales are not included promises.',
    faqs: [
      { question: 'Can I subscribe to Thrive today?', answer: 'Thrive is not available for purchase. You can ask to join the invitation-only pilot. We agree the pilot scope and end date before access starts; an inquiry creates no payment or commitment.' },
      { question: 'How much does Thrive cost?', answer: 'Thrive is $49 USD per month per place. We’ll confirm the included features and terms before subscriptions open.' },
      { question: 'Will customers buy products on Little Herb Places?', answer: 'Visitors follow your links to shop, book, or register on your existing website. Little Herb Places does not take customer payments or manage your appointment calendar.' },
      { question: 'Does Thrive include promotion?', answer: 'The pilot includes discovery through offering and event pages. Guaranteed newsletter placements and sponsored spotlights are not included. We will define inventory and reporting before selling those separately.' },
      { question: 'Should I wait for Thrive to claim my place?', answer: 'You can request a listing or submit a free ownership claim now. Bloom is the option for maintaining a richer listing when checkout is enabled. You do not need to wait for Thrive.' },
    ],
  },
};

export const getPlanFeatures = (plan, growthEnabled = false, emailReportsEnabled = false) => planPages[plan].features.filter(feature => (!feature.growthOnly || growthEnabled) && (!feature.emailOnly || emailReportsEnabled));

export const getBusinessPlans = ({ growthEnabled = false, bloomAvailable = false, emailReportsEnabled = false } = {}) => [
  { name: 'Sprout', icon: 'sprout', description: 'For curious people collecting places they love.', price: 'Free', features: ['Create a Free Account', 'Save Your Favorite Places', 'Keep Saves Across Your Devices'], available: true, path: '/the-little-garden/sprout', action: 'Explore Sprout' },
  { name: 'Bloom', icon: 'sun', description: 'Help the right people choose your business.', price: `$${bloomOffer.amount / 100}`, features: ['Your Story and up to 10 Photos', 'Hours, Contact Details, and Links', ...(growthEnabled ? ['A Clear Booking or Shopping Action', 'Specialties and a Current Announcement', '30-day Activity Report and CSV'] : []), ...(growthEnabled && emailReportsEnabled ? ['Optional Monthly Email Summary'] : []), 'All Approved Managers Included'], available: bloomAvailable, path: '/the-little-garden/bloom', action: 'Explore Bloom' },
  { name: 'Thrive', icon: 'thrive', description: 'Help people discover what they can shop, book, or join.', price: `$${thriveOffer.amount / 100}`, features: ['Pilot: Everything in Bloom', 'Up to 10 Searchable Products or Services', 'Up to 10 Upcoming Workshops or Events', 'Offering and Event Activity Reports'], available: false, path: '/the-little-garden/thrive', action: 'Explore the Thrive Pilot' },
];
