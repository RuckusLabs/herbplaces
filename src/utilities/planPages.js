import { bloomOffer, thriveOffer } from '../../supabase/functions/_shared/billingCatalog.js';

export const ownerSteps = [
  { title: 'Find your place', text: 'Search the directory. If your place is missing, send a free listing request and follow its review status in Your Listing Requests.' },
  { title: 'Claim your listing', text: 'Once the listing is available, open it and choose Claim This Place. Sign in or create a free account, confirm your email, and share your connection to the business.' },
  { title: 'Get approved', text: 'Our team reviews your claim. Adding a listing and approving its managers are separate steps. You can follow your claim in My Places; no payment is taken during review.' },
  { title: 'Make it your own', text: 'After ownership approval, your billing contact can subscribe when Bloom is available. All approved managers can then edit the place page, while the billing contact manages the subscription in My Places.' },
];

export const planPages = {
  bloom: {
    name: 'Bloom', icon: 'sun', heroPhoto: '/assets/pages/home/hero.jpg', heroAlt: 'Hands tending fresh herbs in a wooden planting tray', heroPosition: 'center 32%', eyebrow: 'For the people behind the place',
    heading: 'Your place. Your story. In full bloom.',
    title: 'Bloom | Manage Your Herb Business Listing | Little Herb Places',
    description: 'Keep your herb shop, herbal practice, or garden listing current with Bloom. Share photos, hours, and useful links for $19/month per place, plus applicable tax, after ownership approval.',
    intro: 'You put care into your place. Give people a clear picture of what they’ll find there, from the feeling of your space to the details that help them plan a visit.',
    price: bloomOffer.amount / 100, priceNote: 'USD / month per place · plus applicable tax · renews monthly',
    sectionTitle: 'A little more of what makes you, you.',
    sectionIntro: 'Bloom puts your listing in the hands of the people who know it best. Keep the essentials together, and give visitors a reason to take a closer look.',
    features: [
      { icon: 'book', title: 'Tell your story', text: 'Edit your approved listing’s description and tagline. Introduce your practice, your shop, or the way you welcome people into your space.' },
      { icon: 'polaroid', title: 'Let your space speak', text: 'Add and arrange up to 10 photos. Choose a cover image and show the shelves, garden paths, or small details that make your place feel like yours.' },
      { icon: 'brand-clock', title: 'Make the next step easy', text: 'Keep hours, contact details, your website, and social links together, so visitors can find the information they need before getting in touch.' },
      { icon: 'group', title: 'Care for it together', text: 'One subscription covers one place and all its approved managers. Each manager uses their own account; your designated billing contact handles payment.' },
    ],
    showcaseTitle: 'Help a curious visitor become a familiar face.',
    showcaseText: 'A thoughtful description, current hours, and photos of your space help people decide whether to visit or contact you. Update your listing directly on its place page as your business changes.',
    showcaseNote: 'Bloom gives you editing tools. It does not promise search rankings, leads, or sales.',
    faqs: [
      { question: 'Does my place need Bloom to be listed?', answer: 'No. Requesting a listing and claiming ownership are free. Bloom is the subscription that enables approved managers to edit the listing and upload photos.' },
      { question: 'What if my place isn’t in the directory yet?', answer: 'Send a free listing request first. After our team adds or links the listing, open it and submit an ownership claim. Listing approval does not automatically approve you as a manager.' },
      { question: 'When do I pay?', answer: 'Only after your ownership claim has been approved and you choose to subscribe when purchases are available. There is no charge to send a listing request or ownership claim.' },
      { question: 'Can I cancel?', answer: 'Yes. Cancel future renewals in Manage Billing with Stripe from My Places. Editing continues through the paid period, and your published listing stays visible after editing access ends.' },
      { question: 'Is the price per manager or per place?', answer: 'Bloom is $19 USD per month per place, plus applicable tax. All approved managers of that place are included; a separate place needs its own subscription.' },
    ],
  },
  thrive: {
    name: 'Thrive', icon: 'thrive', heroPhoto: '/assets/pages/home/herb-image-1.jpg', heroAlt: 'A botanical tea blend surrounded by colorful flowers', heroPosition: 'center center', eyebrow: 'A little more room to grow · coming soon',
    heading: 'More of your craft. More to discover.',
    title: 'Thrive | Planned Product & Service Showcase | Little Herb Places',
    description: 'Explore Thrive for herb businesses: Bloom listing tools plus a showcase of up to 10 products or services. $49/month per place. Coming soon.',
    intro: 'Your place is only the beginning. Thrive is a planned next step for sharing the products, services, and thoughtful work that give people another reason to connect with you.',
    price: thriveOffer.amount / 100, priceNote: 'USD / month per place · coming soon',
    sectionTitle: 'Make room for what you make.',
    sectionIntro: 'We’re shaping Thrive around a simple idea: let people discover more of what a little herb place offers, right alongside its story. These features are coming soon.',
    features: [
      { icon: 'sun', title: 'Planned: everything in Bloom', text: 'Bring your listing description, photos, hours, links, and approved managers together in one plan.' },
      { icon: 'craft', title: 'Planned: your offerings, together', text: 'Showcase up to 10 products or services alongside your place listing, so visitors can get a clearer sense of what you offer.' },
      { icon: 'community', title: 'Grow with your community', text: 'Share more of what you offer with people who already come to Little Herb Places to discover plant-focused places. We’ll confirm the included features and promotion details before subscriptions open.' },
    ],
    showcaseTitle: 'A home for the things people ask you about.',
    showcaseText: 'A seasonal tea blend. A consultation. A workshop. The planned showcase would give those offerings a place beside your business story, helping visitors understand what to ask you about.',
    showcaseNote: 'These are examples of potential showcase content. Thrive features are coming soon; a launch date has not been announced.',
    faqs: [
      { question: 'Can I subscribe to Thrive today?', answer: 'Not yet. Thrive is coming soon and is not yet available for purchase. You can email us about your needs without starting a subscription or committing to a purchase.' },
      { question: 'How much does Thrive cost?', answer: 'Thrive is $49 USD per month per place. We’ll confirm the included features and terms before subscriptions open.' },
      { question: 'Will customers buy products on Little Herb Places?', answer: 'The current plan is a showcase of products or services, not a customer checkout or booking system. Any purchasing or booking experience would need to be defined separately.' },
      { question: 'Does Thrive include promotion?', answer: 'Promotion details are still being defined. We are not promising featured placement, newsletter coverage, reach, or sales as part of Thrive.' },
      { question: 'Should I wait for Thrive to claim my place?', answer: 'You can request a listing or submit a free ownership claim now. Bloom will be the option for editing your approved listing when purchases open; you do not need to wait for Thrive.' },
    ],
  },
};
