import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './businessPreview.module.scss';

export default function BusinessPreview({ thrive = false, growth = false }) {
  return <figure className={styles.preview} aria-label={`Example ${thrive ? 'Thrive' : 'Bloom'} business listing`}>
    <div className={styles.frame}>
      <div className={styles.chrome}><span aria-hidden="true"><i /><i /><i /></span><span>littleherbplaces.com / place / willow-root</span></div>
      <div className={styles.siteHeader}><img src="/assets/little-herb-places-logo.svg" alt="" width="42" height="42" /><span>Explore Places <span>Our Story</span></span><span className={styles.miniJoin}>Join the Community <Icon name="arrow" size={11} /></span></div>
      <div className={styles.profilePage}>
        <header className={styles.profileHeader}><p className={styles.location}>Herb shop & apothecary · Portland, Oregon</p><h3>Willow & Root Apothecary</h3><p>A little care, rooted in plants.</p><div className={styles.profileActions}><span className={styles.primaryAction}>{thrive ? 'See Upcoming Classes' : 'Shop Online'} <Icon name="arrow" size={12} /></span><span className={styles.saveAction}>♡ Save Place</span></div></header>
        <div className={styles.photos}><img src="/assets/pages/home/hero.jpg" alt="Fresh herbs being tended in a wooden planting tray" width="900" height="1350" loading="lazy" /><img src="/assets/pages/home/herb-image-1.jpg" alt="A colorful botanical tea blend surrounded by flowers" width="500" height="500" loading="lazy" /></div>
        <div className={styles.profileBody}>
          <section className={styles.story}><h4>A little about Willow & Root.</h4><p>A neighborhood home for loose-leaf teas, thoughtfully sourced herbs, and time spent learning together.</p><div className={styles.tags}><span>Bulk herbs</span><span>Custom blends</span><span>Workshops</span></div></section>
          <aside className={styles.visit}><h4>Plan a little visit.</h4><p><Icon name="clock" size={13} /> Tue–Sat · 10am–6pm</p><p><Icon name="plan-contact" size={13} /> Portland, Oregon</p><span>Visit Their Website <Icon name="arrow" size={11} /></span></aside>
        </div>
        {(growth || thrive) && <section className={styles.announcement}><span className={styles.announcementIcon}><Icon name="plan-announcement" size={22} /></span><div><p className={styles.overline}>Something good is growing</p><h4>Our autumn tea collection is here.</h4><p>Meet the new blends online, or stop by for a little inspiration.</p></div></section>}
        {thrive && <section className={styles.offerings}><h4>A little of what we offer.</h4><div className={styles.offeringGrid}>
          <article><img src="/assets/pages/home/herb-image-1.jpg" alt="Loose botanical tea with colorful petals" width="500" height="500" loading="lazy" /><div><span className={styles.overline}>Product</span><h4>Seasonal tea blend</h4><p>A fragrant blend for a slower afternoon.</p><span className={styles.itemAction}>$18 <span>Explore blend ↗</span></span></div></article>
          <article><img src="/assets/pages/home/hero.jpg" alt="Hands caring for fresh herbs" width="900" height="1350" loading="lazy" /><div><span className={styles.overline}>Service</span><h4>A tea consultation</h4><p>A little time to find your favorite cup.</p><span className={styles.itemAction}>$65 <span>Learn more ↗</span></span></div></article>
        </div><div className={styles.event}><span className={styles.eventIcon}><Icon name="plan-events" size={25} /></span><div><span className={styles.overline}>Workshop · Saturday, 2–4pm</span><h4>A seasonal tea workshop</h4></div><span className={styles.eventAction}>View event <Icon name="arrow" size={12} /></span></div></section>}
      </div>
    </div>
    <figcaption className={styles.caption}>Illustrative listing · not a real business.</figcaption>
  </figure>;
}
BusinessPreview.propTypes = { thrive: PropTypes.bool, growth: PropTypes.bool };
