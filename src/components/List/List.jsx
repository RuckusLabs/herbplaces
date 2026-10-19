import PropTypes from 'prop-types';
import styles from './list.module.scss';
import usePlaces from '../../hooks/usePlaces';
import PlaceCard from '../PlaceCard/PlaceCard';
import Icon from '../Icons/Icon';

export default function ListComponent({ className = '', limit, places: suppliedPlaces, prioritizeFeatured = false }) {
  const { places, loading, error, retry } = usePlaces(suppliedPlaces === undefined);
  const all = suppliedPlaces ?? places;
  const ordered = prioritizeFeatured
    ? [...all].sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified)))
    : all;
  const shown = limit ? ordered.slice(0, limit) : ordered;
  if (suppliedPlaces === undefined && loading) return <div className={`${styles.places} ${className}`} aria-label="Loading places" aria-busy="true">{Array.from({ length: limit || 3 }, (_, i) => <div key={i} className={styles.skeleton}><div /><span /><span /></div>)}</div>;
  if (suppliedPlaces === undefined && error) return <div className={styles.status} role="status"><Icon name="sprout" size={54} /><h3>A Little Pause in the Garden.</h3><p>{error}</p><button className="button" onClick={retry}>Try Again <Icon name="arrow" size={16} /></button></div>;
  if (!shown.length) return <div className={styles.status}><Icon name="search" size={28} /><h3>No Places Found Just Yet.</h3><p>Try another city, a shorter search, or a different category.</p></div>;
  return <div className={`${styles.places} ${className}`}>{shown.map(place => <PlaceCard place={place} key={place.id} />)}</div>;
}
ListComponent.propTypes = { className: PropTypes.string, limit: PropTypes.number, places: PropTypes.array, prioritizeFeatured: PropTypes.bool };
