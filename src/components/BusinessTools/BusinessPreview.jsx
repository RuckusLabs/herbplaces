import PropTypes from 'prop-types';
import styles from './growth.module.scss';

export default function BusinessPreview({ thrive = false, growth = false }) {
  return <div className={styles.example} aria-label="Illustrative business profile and report">
    <p className={styles.hint}>Illustrative example · not a real business or measured result</p>
    <img src="/assets/pages/home/herb-image-2.jpg" width="900" height="600" alt="Botanical ingredients illustrating a sample business profile" style={{ width:'100%',maxHeight:230,objectFit:'cover',borderRadius:12 }} loading="lazy" />
    <h3>Willow & Root Apothecary</h3><p>Herbs, thoughtful blends, and a little space to learn.</p>
    <p>Bulk herbs · Custom blends · Workshops</p>
    <span className="button">{thrive ? 'See Upcoming Classes' : 'Shop Online'}</span>
    {(growth || thrive) && <><h4>A current reason to visit</h4><p>Our autumn tea collection is here. Explore the blends online or stop by this week.</p><h4>A useful view of activity</h4><div className={styles.metrics}><article><h3>Profile views</h3><strong>120</strong><p>Sample last-30-day count</p></article><article><h3>Website clicks</h3><strong>16</strong><p>Sample action count</p></article></div><p className={styles.hint}>Sample numbers explain the report. They are not forecasts, testimonials, or promised results.</p></>}
    {thrive && <><h4>A seasonal tea workshop</h4><p>A dedicated event page with dates, price information, and a link to register on your own website.</p><span className="button">Details & Registration</span></>}
  </div>;
}
BusinessPreview.propTypes={ thrive:PropTypes.bool,growth:PropTypes.bool };
