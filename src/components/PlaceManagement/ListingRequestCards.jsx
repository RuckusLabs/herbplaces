import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Icon from '../Icons/Icon';
import styles from './management.module.scss';

export default function ListingRequestCards({ requests, management, claimPath = slug => `/place/${slug}?claim=1`, updatePath = '/request-place#new-listing', headingLevel = 'h4' }) {
  const Heading = headingLevel;
  const visibleRequests = [...requests].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
  return (<ul className={styles.requestCards} role="list">{visibleRequests.map(request => {
        const listed = request.status === 'listed';
        const declined = request.status === 'declined';
        const member = management.memberships.find(item => item.place?.urlSlug === request.place_slug);
        const pendingClaim = management.claims.some(item => item.urlSlug === request.place_slug && item.status === 'pending');
        const location = [request.address, request.city, request.region, request.zip].filter(Boolean).join(', ');
        const createdAt = new Date(request.created_at);
        return <li key={request.id}><article aria-labelledby={`request-${request.id}`} className={`${styles.requestCard} ${listed ? styles.requestListed : declined ? styles.requestDeclined : styles.requestPending}`}>
          <div className={styles.requestCardTop}><Icon name={listed ? 'shop' : declined ? 'leaf' : 'brand-clock'} size={44} /><span className={styles.requestBadge}>{listed ? 'Listed' : declined ? 'Needs an update' : 'Pending review'}</span></div>
          <Heading id={`request-${request.id}`}>{request.name}</Heading>
          {location && <p className={styles.requestLocation}><Icon name="pin" size={17} /><span>{location}</span></p>}
          <p className={styles.requestExplanation}>{listed ? member ? 'Your listing is ready, and your management access is approved.' : pendingClaim ? 'Your listing is ready. We’re reviewing your ownership claim.' : 'Your place is in the directory. Own or manage it? Claim the listing to make it yours.' : declined ? 'This request needs another look. Read our note below before sending updated details.' : 'We’re checking the details for this place. The decision will appear here.'}</p>
          {request.review_note && <div className={styles.requestReviewNote}><strong>From our team</strong><p>{request.review_note}</p></div>}
          {listed && request.place_slug && <div className={styles.requestCardActions}>{management.loading ? <span role="status">Checking access…</span> : management.error ? <Link to="/favorites#my-places">Check Management Access</Link> : member || pendingClaim ? <Link className="button" to="/favorites#my-places">{member ? 'Manage Your Place' : 'View Claim Status'} <Icon name="arrow" size={16} /></Link> : <Link className="button" to={claimPath(request.place_slug)}>Start Your Claim <Icon name="arrow" size={16} /></Link>}<Link to={`/place/${request.place_slug}`}>View Listing</Link></div>}
          {declined && <a className={styles.requestUpdateLink} href={updatePath}>Send Updated Details <Icon name="arrow" size={16} /></a>}
          {Number.isFinite(createdAt.getTime()) && <p className={styles.requestDate}>Requested <time dateTime={request.created_at}>{createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></p>}
        </article></li>;
      })}</ul>);
}
ListingRequestCards.propTypes = {
  requests: PropTypes.array.isRequired,
  management: PropTypes.object.isRequired,
  claimPath: PropTypes.func,
  updatePath: PropTypes.string,
  headingLevel: PropTypes.string,
};
