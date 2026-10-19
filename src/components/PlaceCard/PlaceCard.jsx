import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import FavoriteButton from '../FavoriteButton/FavoriteButton';
import Icon from '../Icons/Icon';
import PlaceBadge from '../PlaceBadge/PlaceBadge';
import styles from './placeCard.module.scss';

export default function PlaceCard({ place, compact = false }) {
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.imageWrap}>
        <Link to={`/place/${place.urlSlug}`} tabIndex={-1} aria-hidden="true">
          <img
            className={styles.coverPhoto}
            src={place.coverPhoto || '/assets/pages/home/hero.jpg'}
            alt=""
            loading="lazy"
            decoding="async"
            width="600"
            height="450"
            onError={event => {
              if (!event.currentTarget.src.endsWith('/assets/pages/home/hero.jpg')) {
                event.currentTarget.src = '/assets/pages/home/hero.jpg';
              }
            }}
          />
        </Link>
        <FavoriteButton className={styles.favorite} itemId={place.id} />
        <PlaceBadge place={place} className={styles.recognition} />
      </div>
      <div className={styles.content}>
        <p className={styles.location}><Icon name="pin" size={19} />{[place.city, place.state].filter(Boolean).join(', ')}</p>
        <h3><Link to={`/place/${place.urlSlug}`}>{place.name}<Icon name="arrow" size={20} /></Link></h3>
        {place.tagline && <p className={styles.tagline}>{place.tagline}</p>}
      </div>
    </article>
  );
}
PlaceCard.propTypes = { place: PropTypes.object.isRequired, compact: PropTypes.bool };
