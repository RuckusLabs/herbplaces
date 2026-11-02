import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import { bloomAvailable } from '../../utilities/managementApi';
import { ownerSteps, planPages, getPlanFeatures, getPlanIntro } from '../../utilities/planPages';
import { growthEnabled, emailReportsEnabled } from '../../utilities/growthApi';
import ReportPreview from '../../components/BusinessTools/ReportPreview';
import { trackBusinessJourney } from '../../utilities/businessJourney';
import BusinessPreview from '../../components/BusinessTools/BusinessPreview';
import styles from './businessPlan.module.scss';



export default function BusinessPlan({ plan }) {
  const content = planPages[plan];
  useEffect(() => { trackBusinessJourney('plan_view', plan); }, [plan]);
  const priceReference = id => <sup className={styles.noteReference}><a id={id} href="#plan-price-note" aria-label={`Read ${content.name} pricing footnote 1`}>1</a></sup>;
  useEffect(() => {
    document.body.classList.add('has-plan-action');
    document.documentElement.classList.add('has-plan-action');
    return () => { document.body.classList.remove('has-plan-action'); document.documentElement.classList.remove('has-plan-action'); };
  }, []);
  const action = (compact = false) => <Link className="button" to={`/the-little-garden/start?plan=${plan}`} onClick={() => trackBusinessJourney('plan_cta', plan)}>{compact ? 'Get Bloom' : 'Get Started with Bloom'} <Icon name="arrow" size={17} /></Link>;
  const included = ['Your story and up to 10 photos', ...(growthEnabled ? ['10 products or services', '10 workshops or events', 'Activity reports and offering insights'] : ['Hours, contact details, and links']), 'All approved managers'];
  return <main id="main-content" className={styles.page}>
    <div className={styles.breadcrumb}><Link to="/the-little-garden">The Little Garden</Link><span aria-hidden="true">/</span><span>{content.name}</span></div>
    <div className={styles.salesLayout}>
      <div className={styles.mainColumn}>
        <section className={styles.hero} aria-labelledby="plan-title">
          <Icon name={content.icon} size={62} /><p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 id="plan-title">{content.heading}</h1><p className={styles.intro}>{getPlanIntro(plan, growthEnabled)}</p>
          <a className={styles.exploreLink} href="#included">See what’s included <span aria-hidden="true">↓</span></a>
        </section>
        <section id="included" className={styles.features} aria-labelledby="features-title">
          <div className={styles.sectionIntro}><p className={styles.eyebrow}>What’s included in Bloom</p><h2 id="features-title">{content.sectionTitle}</h2><p>{content.sectionIntro}</p></div>
          <div className={styles.featureGrid}>{getPlanFeatures(plan, growthEnabled, emailReportsEnabled).map(feature => <article key={feature.title}><span className={styles.featureIcon}><Icon name={feature.icon} size={62} /></span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>
        <section className={styles.showcase} aria-labelledby="showcase-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>A little look at your listing</p><h2 id="showcase-title">{content.showcaseTitle}</h2><p>{content.showcaseText}</p></div><BusinessPreview growth={growthEnabled} /></section>
        {growthEnabled && <section className={styles.showcase} aria-labelledby="report-preview-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>Useful beyond the first visit</p><h2 id="report-preview-title">See the interest. Choose your next step.</h2><p>Review recorded profile views and customer-action clicks, compare periods, and download daily activity. {emailReportsEnabled ? 'Opt into a monthly email for each place you manage.' : 'Open your activity report from your place page.'}</p></div><ReportPreview /></section>}
        <section className={styles.realExample} aria-labelledby="real-place-title"><h2 id="real-place-title">Explore a real place in the directory.</h2><p>Visit The Herb Bar’s page in Austin to see how a business appears to people planning a visit.</p><Link to="/place/the-herb-bar">View The Herb Bar <Icon name="arrow" size={16} /></Link></section>
        <section className={styles.journey} aria-labelledby="journey-title"><div className={styles.sectionIntro}><p className={styles.eyebrow}>Start with a free claim</p><h2 id="journey-title">From finding your place to making it yours.</h2></div><ol>{ownerSteps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol><div className={styles.journeyLinks}><Link to={`/the-little-garden/start?plan=${plan}&new=1`}>Request a Missing Listing</Link><Link to="/my-places">Already approved? Open My Places</Link></div></section>
        <section className={styles.assistance} aria-label="Assisted setup"><Icon name="plan-team" size={30} /><div><h2>A little help getting started.</h2><p>Get help organizing your description and photos, choosing your main customer action, and preparing your first seasonal announcement. We agree the scope and any one-time price before work begins; setup is optional and separate from your subscription.</p><a href="mailto:help@littleherbplaces.com?subject=Assisted%20business%20setup">Ask About Assisted Setup <span aria-hidden="true">↗</span></a></div></section>
        <section className={styles.faq} aria-labelledby="faq-title"><h2 id="faq-title">A few things you might be wondering.</h2><div>{content.faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.closing}><h2>Give your little place room to bloom.</h2><p>Find your listing and introduce yourself. A useful profile starts with you.</p><div className={styles.journeyLinks}><Link to={`/the-little-garden/start?plan=${plan}`}>Find Your Place <Icon name="arrow" size={16} /></Link></div></section>
      </div>
      <aside id="plan-offer" className={styles.planRail} aria-label={`${content.name} plan details`}>
        <div className={styles.offer}>
          <div className={styles.offerImage}><img src={content.heroPhoto} alt={content.heroAlt} style={{ objectPosition: content.heroPosition }} width={900} height={450} fetchPriority="high" /></div>
          <div className={styles.offerCopy}>
            <div className={styles.offerTitle}><div><span className={styles.eyebrow}>Your place, thoughtfully presented</span><h2>{content.name}</h2></div><Icon name={content.icon} size={46} /></div>
            <p className={styles.price}>${content.price}<span>/ month per place{priceReference('plan-price-reference')}</span></p>
            <p className={styles.currency}>USD · plus applicable tax</p>
            <ul>{included.map(item => <li key={item}><img src="/assets/icons/checkmark--green.svg" alt="" width="14" height="14" />{item}</li>)}</ul>
            {action()}
            <p className={styles.checkoutNote}>{bloomAvailable ? 'Free ownership review before payment. Renews monthly; cancel future renewals anytime.' : 'Claim your place for free. Bloom purchases are coming soon.'}</p>
            <Link className={styles.ownerLink} to="/my-places">Already approved? Open My Places</Link>
          </div>
        </div>
      </aside>
    </div>
    <aside className={styles.legalNotes} aria-label={`${content.name} membership notes`}><p id="plan-price-note" tabIndex={-1}><sup className={styles.noteReference}>1</sup>{' '}{content.priceFootnote} {content.showcaseNote}</p><p><Link to="/membership-terms">Membership terms</Link> · <Link to="/help#billing">Billing help</Link> · <Link to="/privacy">Privacy</Link></p></aside>
    <div className={styles.mobileAction} role="region" aria-label={`${content.name} quick signup`}><div><strong>{content.name} <span>${content.price}</span></strong><span>/ month per place{priceReference('plan-mobile-price-reference')} · plus tax</span></div>{action(true)}</div>
  </main>;
}
BusinessPlan.propTypes = { plan: PropTypes.oneOf(['bloom']).isRequired };
