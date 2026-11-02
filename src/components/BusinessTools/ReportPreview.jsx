import styles from './reportPreview.module.scss';

export default function ReportPreview() {
  return <figure className={styles.report} aria-label="Illustrative Bloom activity report">
    <figcaption><span>Illustrative report · sample numbers</span><strong>Willow & Root Apothecary</strong><span>September 1–30, 2026 · compared with August 1–31, 2026</span></figcaption>
    <div className={styles.metrics}>{[['Profile views', '148', '112'], ['Website clicks', '24', '18'], ['Main action clicks', '16', '9']].map(([label, value, previous]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{previous} in the previous month</small></div>)}</div>
    <div className={styles.offering}><strong>Interest in individual offerings</strong><p>Seasonal Tea Workshop · 8 registration-link clicks</p><p>A Tea Consultation · 5 booking-link clicks</p></div>
    <div className={styles.next}><strong>One thing to try next</strong><p>Your seasonal announcement has expired. Share what’s new this month and link to the relevant page in your shop.</p><span>Next step: refresh your announcement in Business Highlights</span></div>
    <p className={styles.note}>Fictional business and example activity, not customer results. Counts show recorded interest, not unique visitors, confirmed bookings, or sales. Monthly emails are optional.</p>
  </figure>;
}
