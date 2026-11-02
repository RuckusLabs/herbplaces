import PropTypes from 'prop-types';
import { useState } from 'react';
import Icon from '../Icons/Icon';
import { publicGrowth, sectionHeading } from '../../utilities/placeGrowth';
import { trackPlaceActivity } from '../../utilities/growthApi';
import styles from './placeHighlights.module.scss';

const highlightsProps = { profile: PropTypes.object, placeId: PropTypes.string.isRequired, track: PropTypes.bool, now: PropTypes.number };

export function PlacePrimaryAction({ profile, placeId, track = true, now = Date.now() }) {
  const action = publicGrowth(profile, now).primary_action;
  if (!action?.url) return null;
  return <a className={`button ${styles.primaryAction}`} href={action.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, 'primary_click'); }}>{action.label}<Icon name="arrow" size={17} /><span className="sr-only"> (opens in a new tab)</span></a>;
}
PlacePrimaryAction.propTypes = highlightsProps;

export function PlaceOperatingStatus({ profile }) {
  if (!profile?.operating_status || profile.operating_status === 'open') return null;
  return <p className={styles.status}><Icon name="clock" size={18} /><span><strong>{profile.operating_status === 'permanently_closed' ? 'Reported permanently closed' : 'Temporarily closed'}</strong> · Please confirm directly with the business before visiting.</span></p>;
}
PlaceOperatingStatus.propTypes = { profile: PropTypes.object };

export function PlaceVisitorInfo({ profile, now = Date.now() }) {
  const content = publicGrowth(profile, now);
  if (!content.languages && !content.access_notes) return null;
  return <section className={styles.visitorInfo} aria-label="Visitor information">
    {content.languages && <div><Icon name="community" size={20} /><div><h3>Languages</h3><p>{content.languages}</p></div></div>}
    {content.access_notes && <div><Icon name="plan-access" size={22} /><div><h3>Access Information From the Business</h3><p>{content.access_notes}</p></div></div>}
  </section>;
}
PlaceVisitorInfo.propTypes = { profile: PropTypes.object, now: PropTypes.number };

export function OfferingCard({ item, placeId, event = false, track = true, compact = false }) {
  const [expanded,setExpanded] = useState(false);
  const longDescription = compact && item.description?.length > 100;
  const description = longDescription && !expanded ? `${item.description.slice(0,100).trimEnd()}…` : item.description;
  const timeZone = item.timezone || 'UTC';
  const starts = event ? new Date(item.starts_at) : null;
  const date = event ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(starts) : '';
  const month = event ? new Intl.DateTimeFormat('en-US', { month: 'short', timeZone }).format(starts) : '';
  const day = event ? new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(starts) : '';
  return <article className={`${styles.card} ${event ? styles.eventCard : ''} ${compact ? styles.compactCard : ''}`}>
    {event && <div className={styles.eventDate} aria-hidden="true"><span>{month}</span><strong>{day}</strong></div>}
    {item.image && <img className={styles.itemImage} src={item.image} alt={item.image_alt || item.title} width="600" height="450" loading="lazy" />}
    <div className={styles.cardBody}>
      <p className={styles.eyebrow}>{event ? 'Workshop or Event' : item.kind === 'service' ? 'Service' : 'Product'}</p>
      <h3>{item.title}</h3>
      {event && <p className={styles.eventMeta}><time dateTime={item.starts_at}>{date}</time><span>{timeZone}</span>{item.location && <span>{item.location}</span>}</p>}
      {item.description && <p className={styles.description}>{description}</p>}{longDescription && <button type="button" className={styles.readMore} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded ? 'Show Less' : 'Read More'}<span className="sr-only"> about {item.title}</span></button>}
      <div className={styles.cardFooter}>{item.price && <p className={styles.price}>{item.price}</p>}<a className={styles.itemLink} href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, event ? 'event_click' : 'offering_click', item.id); }}>{event ? 'Details & Registration' : item.kind === 'service' ? 'Learn More & Book' : 'View at Their Shop'}<Icon name="arrow" size={15} /><span className="sr-only">: {item.title} (opens in a new tab)</span></a></div>
    </div>
  </article>;
}
OfferingCard.propTypes = { item: PropTypes.object.isRequired, placeId: PropTypes.string.isRequired, event: PropTypes.bool, track: PropTypes.bool, compact: PropTypes.bool };

export default function PlaceHighlights({ profile, placeId, track = true, now = Date.now(), className = '' }) {
  const content = publicGrowth(profile, now);
  const announcement = content.announcement;
  if (!content.specialties.length && !announcement && !content.offerings.length && !content.events.length) return null;
  return <div className={`${styles.highlights} ${className}`}>
    {content.specialties.length > 0 && <section className={styles.specialties} aria-label="Business specialties"><h2>{sectionHeading(content,'specialties')}</h2><ul>{content.specialties.map(item => <li key={item}>{item}</li>)}</ul></section>}
    {announcement && <section className={styles.announcement} aria-label="Current announcement"><p className={styles.eyebrow}><Icon name="leaf" size={18} />A Little Update</p><h2>{announcement.title}</h2><p className={styles.announcementBody}>{announcement.body}</p><div className={styles.announcementFooter}>{announcement.code && <p className={styles.offerCode}>Offer code: <strong>{announcement.code}</strong></p>}{announcement.url && <a className={styles.itemLink} href={announcement.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, 'announcement_click'); }}>Learn More<Icon name="arrow" size={15} /><span className="sr-only"> about {announcement.title} (opens in a new tab)</span></a>}</div></section>}
    {content.offerings.length > 0 && <section className={styles.collection} aria-label="Products and services"><header className={styles.collectionHeading}><Icon name="shop" size={30} /><div><p className={styles.eyebrow}>Products & Services</p><h2>{sectionHeading(content,'offerings')}</h2></div></header><div className={styles.compactCards}>{content.offerings.map(item => <OfferingCard key={item.id} item={item} placeId={placeId} track={track} compact />)}</div></section>}
    {content.events.length > 0 && <section className={styles.collection} aria-label="Upcoming workshops and events"><header className={styles.collectionHeading}><Icon name="craft" size={30} /><div><p className={styles.eyebrow}>Workshops & Events</p><h2>{sectionHeading(content,'events')}</h2></div></header><div className={styles.events}>{content.events.map(item => <OfferingCard key={item.id} item={item} placeId={placeId} event track={track} />)}</div></section>}
  </div>;
}
PlaceHighlights.propTypes = { ...highlightsProps, className: PropTypes.string };
