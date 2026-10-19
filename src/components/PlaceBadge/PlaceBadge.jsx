import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './placeBadge.module.scss';

export default function PlaceBadge({ place, className = '' }) {
  if (!place.isFeatured && !place.isVerified) return null;
  const label = place.isVerified
    ? (place.isFeatured ? 'Featured & Verified' : 'Verified Place')
    : 'Featured Place';

  return <span className={`${styles.badge} ${className}`}>
    <Icon name={place.isVerified ? 'badge' : 'sun'} size={34} />
    <span>{label}</span>
  </span>;
}
PlaceBadge.propTypes = { place: PropTypes.object.isRequired, className: PropTypes.string };
