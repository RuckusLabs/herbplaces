import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import styles from './thelittlegarden.module.scss';
import { bloomAvailable } from '../../utilities/managementApi';
import { bloomOffer, thriveOffer } from '../../../supabase/functions/_shared/billingCatalog.js';

const plans = [
  { name: 'Sprout', icon: 'sprout', description: 'For curious people collecting places they love.', price: 'Free', features: ['Create a Free Account', 'Save Your Favorite Places', 'Keep Saves Across Your Devices'], available: true },
  { name: 'Bloom', icon: 'sun', description: 'For owners ready to keep their place up to date.', price: `$${bloomOffer.amount / 100}`, features: ['Edit Your Approved Place Listing', 'Add and Arrange up to 20 Photos', 'Share Hours, Contact Details, and Links', 'Include All Approved Managers'], available: bloomAvailable },
  { name: 'Thrive', icon: 'thrive', description: 'A planned pilot for sharing more of what you offer.', price: `$${thriveOffer.amount / 100}`, features: ['Planned: Everything in Bloom', 'Planned: Showcase up to 10 Products or Services', 'Promotion Details to Be Confirmed Before Launch'], available: false },
];

export default function TheLittleGarden() {
  return <main id="main-content" className={styles.garden}>
    <Helmet><title>The Little Garden | Little Herb Places</title><meta name="description" content="Manage your business listing on Little Herb Places. Learn how free ownership claims, Bloom subscriptions, and the upcoming Thrive pilot work." /></Helmet>
    <section className={styles.hero} aria-labelledby="garden-title">
      <div className={styles.heroCopy}>
        <Icon name="garden" size={76} />
        <h1 id="garden-title">The Little<br />Garden.</h1>
        <p>Help People Get to Know Your Place.</p>
        <p>Give visitors a clear introduction to your herb shop, practice, garden, or workshop space. The Little Garden brings your listing, photos, and useful links together on Little Herb Places.</p>
        <a href="#garden-plans" className="button">Explore the Plans <Icon name="arrow" size={18} /></a>
      </div>
      <div className={styles.heroImage}><img src="/assets/pages/the-little-garden/garden.webp" alt="A leafy archway opening onto a sunlit garden path" width="1000" height="1500" fetchPriority="high" /><span>There’s Room for You to Grow Here.</span></div>
    </section>
    <Reveal className={styles.values} aria-label="A community for your craft"><div className={styles.valuesInner}>
      <div><Icon name="craft" size={58} /><h2>Share Your Craft</h2><p>Bring your plant knowledge, your care, and your own way of making things.</p></div>
      <div><Icon name="community" size={58} /><h2>Find Your People</h2><p>Connect with a community drawn together by a love of plants.</p></div>
      <div><Icon name="sprout" size={58} /><h2>Grow at Your Pace</h2><p>Start with a little seed. There’s no hurry to be anything more.</p></div>
    </div></Reveal>
    <Reveal id="garden-plans" className={styles.plans} aria-labelledby="plans-title">
      <div className={styles.sectionIntro}><h2 id="plans-title">Choose What Helps Your Place Grow.</h2><p>Claiming is free and ownership approval comes before payment. Bloom enables editing for all approved managers of one place. {bloomAvailable ? `Bloom is ${bloomOffer.label}.` : 'You can submit a claim now; Bloom purchases are not available yet.'}</p></div>
      <div className={styles.planGrid}>
        {plans.map(plan => <article key={plan.name} className={`${styles.plan} ${plan.available ? styles.available : ''}`}>
          <div className={styles.planTop}><Icon name={plan.icon} size={64} />{!plan.available && <span className={styles.comingSoon}>{plan.name === 'Thrive' ? 'Planned Pilot' : 'Purchases Coming Soon'}</span>}</div>
          <h3>{plan.name}</h3><p className={styles.planDescription}>{plan.description}</p>
          <p className={styles.price}>{plan.price}{plan.name !== 'Sprout' && <span> / month per place</span>}</p>
          <ul>{plan.features.map(feature => <li key={feature}><img src="/assets/icons/checkmark--green.svg" alt="" width="15" height="15" />{feature}</li>)}</ul>
          {plan.name === 'Thrive' ? <a className="button" href="mailto:help@littleherbplaces.com?subject=Thrive%20pilot%20inquiry">Ask About Thrive</a> : <Link to={plan.name === 'Bloom' ? '/map' : '/register?next=%2Ffavorites'} className="button">{plan.name === 'Bloom' ? 'Find & Claim Your Place' : 'Create a Free Account'} <Icon name="arrow" size={18} /></Link>}
        </article>)}
      </div>
      <p className={styles.planNote}>Bloom renews monthly until canceled. Cancel in Manage Billing to stop the next renewal; editing continues through the paid period. Published listings stay visible after editing access ends. Thrive is not available for purchase.</p>
      <p className={styles.planNote}>Ownership verification is independent of payment. A verified listing is not an endorsement of products or medical advice. <Link to="/help#billing">Billing questions</Link> · <Link to="/membership-terms">Membership terms</Link></p>
    </Reveal>
    <section className={styles.howItWorks} aria-labelledby="business-steps"><h2 id="business-steps">From Your Place to Your People.</h2>
      <ol><li><strong>Find your place.</strong><p>Search the directory, or <Link to="/request-place">request a listing</Link> if it’s missing.</p></li><li><strong>Confirm your connection.</strong><p>Create a free account and send your ownership details for our team to review. No payment is taken with a claim.</p></li><li><strong>Make it your own.</strong><p>After approval, subscribe when Bloom is available, then update your listing and photos.</p></li></ol>
      <p>Already approved? <Link to="/favorites#my-places">Open My Places</Link>. Just exploring? <Link to="/the-little-garden/sprout">Subscribe to Community Updates</Link>.</p>
    </section>
    <Reveal className={styles.invitation}><div className={styles.invitationInner}><Icon name="community" size={56} /><div><h2>Good Company Makes All the Difference.</h2><p>Meet the little places and plant people at the heart of our community.</p></div><Link to="/map" className="button">Explore Places <Icon name="arrow" size={18} /></Link></div></Reveal>
  </main>;
}
