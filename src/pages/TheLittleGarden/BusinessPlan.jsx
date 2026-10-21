import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import { bloomAvailable } from '../../utilities/managementApi';
import { ownerSteps, planPages } from '../../utilities/planPages';
import styles from './businessPlan.module.scss';

const inquiry = 'mailto:help@littleherbplaces.com?subject=Thrive%20pilot%20inquiry';

export default function BusinessPlan({ plan }) {
  const content = planPages[plan];
  const thrive = plan === 'thrive';
  const action = thrive ? <a className="button" href={inquiry}>Ask About the Thrive Pilot <Icon name="arrow" size={18} /></a>
    : <Link className="button" to="/map">Find & Claim Your Place <Icon name="arrow" size={18} /></Link>;
  return <main id="main-content" className={styles.page}>
    <div className={styles.breadcrumb}><Link to="/the-little-garden">The Little Garden</Link><span aria-hidden="true">/</span><span>{content.name}</span></div>
    <section className={styles.hero} aria-labelledby="plan-title">
      <div className={styles.heroCopy}>
        <Icon name={content.icon} size={76} /><p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1 id="plan-title">{content.heading}</h1><p className={styles.intro}>{content.intro}</p>
        <div className={styles.actions}>{action}{!thrive && <Link to="/request-place">Missing from the map? Request a listing</Link>}</div>
        <p className={styles.availability}>{thrive ? 'An inquiry starts a conversation. No payment or commitment.' : bloomAvailable ? 'Free to claim. Ownership approval comes before payment.' : 'Free to claim now. Bloom purchases are coming soon.'}</p>
      </div>
      <aside className={styles.offer} aria-label={`${content.name} plan details`}>
        <div className={styles.offerImage}><img src="/assets/pages/the-little-garden/garden.webp" alt="A sunlit garden path beneath a leafy archway" width="1000" height="1500" fetchPriority="high" /></div>
        <div className={styles.offerCopy}><span className={styles.eyebrow}>{thrive ? 'Planned pilot' : 'Your listing, lovingly tended'}</span><h2>{content.name}</h2><p className={styles.price}>${content.price}<span>{content.priceNote}</span></p><p>{thrive ? 'Planned: Bloom + a showcase of up to 10 products or services.' : 'Listing edits, up to 20 photos, and all approved managers.'}</p><a href="#included">Explore the {thrive ? 'planned features' : 'features'} ↓</a></div>
      </aside>
    </section>
    <section id="included" className={styles.features} aria-labelledby="features-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>{thrive ? 'The idea behind Thrive' : 'What’s included in Bloom'}</p><h2 id="features-title">{content.sectionTitle}</h2><p>{content.sectionIntro}</p></div><div className={styles.featureGrid}>{content.features.map(feature => <article key={feature.title}><Icon name={feature.icon} size={40} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
    <section className={styles.showcase} aria-labelledby="showcase-title"><div><p className={styles.eyebrow}>{thrive ? 'Imagine the possibilities' : 'Details that welcome people in'}</p><h2 id="showcase-title">{content.showcaseTitle}</h2><p>{content.showcaseText}</p><p className={styles.small}>{content.showcaseNote}</p></div><div className={styles.example} aria-label="Illustrative listing content"><p className={styles.eyebrow}>An example of what you could share</p><Icon name={thrive ? 'craft' : 'garden'} size={52} /><h3>{thrive ? 'What’s growing here' : 'A little look inside'}</h3><ul>{(thrive ? ['A tea blend made with care', 'A consultation with your herbalist', 'A workshop to learn something new'] : ['Your story, in your own words', 'Photos that feel like your place', 'Hours, contact details, and useful links']).map(item => <li key={item}>{item}</li>)}</ul><span className={styles.small}>{thrive ? 'Illustrative only · showcase planned' : 'Illustrative content · not a real business listing'}</span></div></section>
    <section className={styles.journey} aria-labelledby="journey-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>Start with a free claim</p><h2 id="journey-title">From finding your place to making it yours.</h2><p>Already listed or just joining the directory? Both paths lead to the same ownership review before paid editing.</p></div><ol>{ownerSteps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol><div className={styles.journeyLinks}><Link to="/request-place">Request a Missing Listing</Link><Link to="/favorites#my-places">Already approved? Open My Places</Link></div></section>
    <section className={styles.faq} aria-labelledby="faq-title"><h2 id="faq-title">A few things you might be wondering.</h2><div>{content.faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div><p><Link to="/help#billing">More billing help</Link> · <Link to="/membership-terms">Membership terms</Link> · <Link to="/privacy">Privacy</Link></p></section>
    <section className={styles.closing}><Icon name={content.icon} size={60} /><h2>{thrive ? 'Let’s shape what comes next.' : 'Give your little place room to bloom.'}</h2><p>{thrive ? 'Tell us about your place and the offerings you’d love people to discover.' : 'Find your listing, introduce yourself, and take the first step. Claiming is free.'}</p>{action}<p className={styles.small}>{thrive ? <Link to="/the-little-garden/bloom">Explore Bloom for your listing essentials</Link> : <Link to="/the-little-garden/thrive">Looking to share products or services? Meet the planned Thrive pilot</Link>}</p></section>
  </main>;
}
BusinessPlan.propTypes = { plan: PropTypes.oneOf(['bloom', 'thrive']).isRequired };
