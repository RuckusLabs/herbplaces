import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import Reveal from '../../components/Reveal/Reveal';
import styles from './thelittlegarden.module.scss';
import { bloomAvailable } from '../../utilities/managementApi';

const plans = [
  { name: 'Sprout', icon: 'sprout', description: 'Plant the seed and start your journey.', price: 'Free', features: ['Join the Community', 'Save Your Favorite Places'], available: true },
  { name: 'Bloom', icon: 'sun', description: 'Let your offerings unfurl and reach more hearts.', price: '$19', features: ['Everything in Sprout', 'Verified Place Badge', 'Claim Your Place', 'Add Images', 'Update Your Place'], available: bloomAvailable },
  { name: 'Thrive', icon: 'thrive', description: 'Deepen your roots and share your wisdom.', price: '$49', features: ['Everything in Bloom', 'Feature up to 10 products', 'Social media feature'], available: false },
];

export default function TheLittleGarden() {
  return <main id="main-content" className={styles.garden}>
    <Helmet><title>The Little Garden | Little Herb Places</title><meta name="description" content="A place for herbalists, growers, and makers to share their craft and connect with a community rooted in plants. Come grow with The Little Garden." /></Helmet>
    <section className={styles.hero} aria-labelledby="garden-title">
      <div className={styles.heroCopy}>
        <Icon name="garden" size={76} />
        <h1 id="garden-title">The Little<br />Garden.</h1>
        <p>A Place to Share, Grow, and Be Seen.</p>
        <p>You put care into everything you grow and create. Find a community that cares just as much. The Little Garden connects herbalists, growers, and makers with people who love the world of plants.</p>
        <a href="#garden-plans" className="button">Put Down Roots <Icon name="arrow" size={18} /></a>
      </div>
      <div className={styles.heroImage}><img src="/assets/pages/the-little-garden/garden.webp" alt="A leafy archway opening onto a sunlit garden path" width="1000" height="1500" fetchPriority="high" /><span>There’s Room for You to Grow Here.</span></div>
    </section>
    <Reveal className={styles.values} aria-label="A community for your craft"><div className={styles.valuesInner}>
      <div><Icon name="craft" size={58} /><h2>Share Your Craft</h2><p>Bring your plant knowledge, your care, and your own way of making things.</p></div>
      <div><Icon name="community" size={58} /><h2>Find Your People</h2><p>Connect with a community drawn together by a love of plants.</p></div>
      <div><Icon name="sprout" size={58} /><h2>Grow at Your Pace</h2><p>Start with a little seed. There’s no hurry to be anything more.</p></div>
    </div></Reveal>
    <Reveal id="garden-plans" className={styles.plans} aria-labelledby="plans-title">
      <div className={styles.sectionIntro}><h2 id="plans-title">A Little Support for Your Next Chapter.</h2><p>{bloomAvailable ? 'Start free with Sprout, or claim your business with Bloom. Bloom is $19/month per place and includes all approved managers. Claim approval comes before payment.' : 'Start with Sprout, our free community plan. More ways to grow are taking root.'}</p></div>
      <div className={styles.planGrid}>
        {plans.map(plan => <article key={plan.name} className={`${styles.plan} ${plan.available ? styles.available : ''}`}>
          <div className={styles.planTop}><Icon name={plan.icon} size={64} />{!plan.available && <span className={styles.comingSoon}>Coming Soon</span>}</div>
          <h3>{plan.name}</h3><p className={styles.planDescription}>{plan.description}</p>
          <p className={styles.price}>{plan.price}{plan.name !== 'Sprout' && <span> / month{plan.name === 'Bloom' ? ' per place' : ''}</span>}</p>
          <ul>{plan.features.map(feature => <li key={feature}><img src="/assets/icons/checkmark--green.svg" alt="" width="15" height="15" />{feature}</li>)}</ul>
          {plan.available ? <Link to={plan.name === 'Bloom' ? '/my-places' : '/the-little-garden/sprout'} className="button">{plan.name === 'Bloom' ? 'Claim Your Place' : 'Get Sprout'} <Icon name="arrow" size={18} /></Link> : <button className="button" disabled>{plan.name} Is Growing</button>}
        </article>)}
      </div>
    </Reveal>
    <Reveal className={styles.invitation}><div className={styles.invitationInner}><Icon name="community" size={56} /><div><h2>Good Company Makes All the Difference.</h2><p>Meet the little places and plant people at the heart of our community.</p></div><Link to="/map" className="button">Explore Places <Icon name="arrow" size={18} /></Link></div></Reveal>
  </main>;
}
