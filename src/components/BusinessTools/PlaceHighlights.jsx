import PropTypes from 'prop-types';
import { publicGrowth } from '../../utilities/placeGrowth';
import { trackPlaceActivity } from '../../utilities/growthApi';
import styles from './growth.module.scss';

export function OfferingCard({ item, placeId, event = false, track = true }) {
  const date = event ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone || 'UTC' }).format(new Date(item.starts_at)) : '';
  return <article>
    {item.image && <img src={item.image} alt={item.image_alt || item.title} width="600" height="450" loading="lazy" />}
    <p>{event ? 'Workshop or event' : item.kind === 'service' ? 'Service' : 'Product'}</p>
    <h3>{item.title}</h3><p>{item.description}</p>
    {event && <p><time dateTime={item.starts_at}>{date}</time> · {item.timezone}{item.location && <><br />{item.location}</>}</p>}
    {item.price && <p>{item.price}</p>}
    <a className="button" href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, event ? 'event_click' : 'offering_click', item.id); }}>{event ? 'Details & Registration' : item.kind === 'service' ? 'Learn More & Book' : 'View at Their Shop'}<span className="sr-only">: {item.title} (opens in a new tab)</span></a>
  </article>;
}
OfferingCard.propTypes = { item: PropTypes.object.isRequired, placeId: PropTypes.string.isRequired, event: PropTypes.bool, track: PropTypes.bool };

export default function PlaceHighlights({ profile, placeId, track = true, now = Date.now() }) {
  const content = publicGrowth(profile, now);
  const announcement = content.announcement;
  return <div className={styles.highlights}>
    {profile?.operating_status && profile.operating_status !== 'open' && <p className={styles.notice}><strong>{profile.operating_status === 'permanently_closed' ? 'Reported permanently closed' : 'Temporarily closed'}</strong> · Please confirm directly with the business before visiting.</p>}
    {content.primary_action?.url && <p><a className="button" href={content.primary_action.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, 'primary_click'); }}>{content.primary_action.label}<span className="sr-only"> (opens in a new tab)</span></a></p>}
    {content.specialties.length > 0 && <><h2>What you’ll find here</h2><ul className={styles.tags}>{content.specialties.map(item => <li key={item}>{item}</li>)}</ul></>}
    {(content.languages || content.access_notes) && <section aria-label="Visitor information">{content.languages && <p><strong>Languages:</strong> {content.languages}</p>}{content.access_notes && <p><strong>Access information from the business:</strong> {content.access_notes}</p>}</section>}
    {announcement && <section className={styles.notice} aria-label="Current announcement"><h2>{announcement.title}</h2><p>{announcement.body}</p>{announcement.code && <p>Offer code: <strong>{announcement.code}</strong></p>}{announcement.url && <a href={announcement.url} target="_blank" rel="noopener noreferrer" onClick={() => { if (track) trackPlaceActivity(placeId, 'announcement_click'); }}>Learn More<span className="sr-only"> about {announcement.title} (opens in a new tab)</span></a>}</section>}
    {content.offerings.length > 0 && <section aria-label="Products and services"><h2>A little of what we offer</h2><div className={styles.cards}>{content.offerings.map(item => <OfferingCard key={item.id} item={item} placeId={placeId} track={track} />)}</div></section>}
    {content.events.length > 0 && <section aria-label="Upcoming workshops and events"><h2>Come learn something new</h2><div className={styles.cards}>{content.events.map(item => <OfferingCard key={item.id} item={item} placeId={placeId} event track={track} />)}</div></section>}
  </div>;
}
PlaceHighlights.propTypes = { profile: PropTypes.object, placeId: PropTypes.string.isRequired, track: PropTypes.bool, now: PropTypes.number };
