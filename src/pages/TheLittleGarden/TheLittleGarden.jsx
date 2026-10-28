import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import styles from './thelittlegarden.module.scss';
import { growthEnabled, emailReportsEnabled } from '../../utilities/growthApi';
import { bloomAvailable } from '../../utilities/managementApi';
import { getBusinessPlans, gardenPlanNotes } from '../../utilities/planPages';
import { bloomOffer } from '../../../supabase/functions/_shared/billingCatalog.js';


const noteReference = (number, id) => <sup className={styles.noteReference}><a id={id} href={`#plan-note-${number}`} aria-label={`Read footnote ${number}: ${gardenPlanNotes[number - 1].label}`}>{number}</a></sup>;

export default function TheLittleGarden() {
  const plans = getBusinessPlans({ growthEnabled, bloomAvailable, emailReportsEnabled });
  return <main id="main-content" className={styles.garden}>
    <Helmet><title>The Little Garden | Little Herb Places</title><meta name="description" content="Manage your business listing on Little Herb Places. Learn how free ownership claims, Bloom subscriptions, and the upcoming Thrive plan work." /></Helmet>
    <section className={styles.hero} aria-labelledby="garden-title">
      <div className={styles.heroCopy}>
        <Icon name="garden" size={76} />
        <h1 id="garden-title">The Little<br />Garden.</h1>
        <p>Help the Right People Choose Your Place.</p>
        <p>Give curious visitors a reason to visit, shop, book, or join you. Start with a free business listing, build a useful profile with Bloom, and explore more ways to share your offerings with the Thrive pilot.</p>
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
        {plans.map(plan => <article key={plan.name} className={`${styles.plan} ${plan.name === 'Bloom' ? styles.available : ''}`}>
          <div className={styles.planTop}><Icon name={plan.icon} size={64} />{!plan.available && <span className={styles.comingSoon}>{plan.name === 'Thrive' ? 'Pilot · Paid Plan Coming Soon' : 'Purchases Coming Soon'}</span>}</div>
          <h3>{plan.name}</h3><p className={styles.planDescription}>{plan.description}</p>
          <p className={styles.price}>{plan.price}{noteReference(plan.name === 'Sprout' ? 1 : 2, `plan-ref-${plan.name.toLowerCase()}`)}{plan.name !== 'Sprout' && <span> / month per place</span>}</p>
          <ul>{plan.features.map(feature => <li key={feature}><img src="/assets/icons/checkmark--green.svg" alt="" width="15" height="15" />{feature}</li>)}</ul>
          <Link to={plan.path} className="button">{plan.action} <Icon name="arrow" size={18} /></Link>
        </article>)}
      </div>
    </Reveal>
    <section className={styles.howItWorks} aria-labelledby="business-steps"><h2 id="business-steps">From Your Place to Your People.</h2>
      <ol><li><strong>Find your place.</strong><p>Search the directory, or <Link to="/request-place">request a listing</Link> if it’s missing.</p></li><li><strong>Confirm your connection.</strong><p>Create a free account and send your ownership details for our team to review.{noteReference(3, 'plan-ref-verification')} No payment is taken with a claim.</p></li><li><strong>Make it your own.</strong><p>After approval, correct essential details for free or choose Bloom when checkout is enabled to build a richer profile.</p></li></ol>
      <p>Already approved? <Link to="/my-places">Open My Places</Link>. Here to discover places? <Link to="/the-little-garden/sprout">Explore our free community updates</Link>.</p>
    </section>
    <Reveal className={styles.invitation}><div className={styles.invitationInner}><Icon name="community" size={56} /><div><h2>Good Company Makes All the Difference.</h2><p>Meet the little places and plant people at the heart of our community.</p></div><Link to="/map" className="button">Explore Places <Icon name="arrow" size={18} /></Link></div></Reveal>
    <aside className={styles.footnotes} aria-label="Plan notes">
      {gardenPlanNotes.map(note => <p id={`plan-note-${note.number}`} key={note.number} tabIndex={-1}><sup className={styles.noteReference}>{note.number}</sup>{' '}{note.text}{note.number === 3 && <> <Link to="/help#billing">Billing questions</Link> · <Link to="/membership-terms">Membership terms</Link></>}</p>)}
    </aside>
  </main>;
}
