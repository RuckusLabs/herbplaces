import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import PlaceBadge from '../PlaceBadge/PlaceBadge';
import FavoriteButton from '../FavoriteButton/FavoriteButton';
import styles from './mapPlacePreview.module.scss';

export default function MapPlacePreview({ place, id, nearbyPlaces = [], onSelect, onClose, closeButtonRef, showSave = false }) {
  const nearbyIndex = nearbyPlaces.findIndex(item => item.id === place.id);
  return <article id={id} className={styles.preview} aria-label={`Preview of ${place.name}`} aria-live="polite" onKeyDown={event => {
    if (event.key === 'Escape' && onClose) { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <div className={styles.previewTop}>
      <span><Icon name="pin" size={18} />{[place.city, place.state].filter(Boolean).join(', ')}</span>
      <div className={styles.actions}>
        {nearbyPlaces.length > 1 && onSelect && <button type="button" className={styles.nextPlace} onClick={() => onSelect(nearbyPlaces[(nearbyIndex + 1) % nearbyPlaces.length])} aria-label="Preview the next nearby place">{nearbyIndex + 1} / {nearbyPlaces.length}<Icon name="arrow" size={17} /></button>}
        {showSave && <FavoriteButton className={styles.save} itemId={place.id} />}
        {onClose && <button type="button" ref={closeButtonRef} className={styles.close} aria-label="Close Place Preview" onClick={onClose}><Icon name="close" size={17} /></button>}
      </div>
    </div>
    <div className={styles.previewBody}>
      {place.coverPhoto && <Link to={`/place/${place.urlSlug}`} className={styles.previewPhoto} tabIndex={-1} aria-hidden="true"><img key={place.coverPhoto} src={place.coverPhoto} alt="" width="90" height="100" decoding="async" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></Link>}
      <div><PlaceBadge place={place} className={styles.badge} /><h2><Link to={`/place/${place.urlSlug}`}>{place.name}<Icon name="arrow" size={18} /></Link></h2><p>{place.tagline || 'A little place with a love for plants.'}</p></div>
    </div>
    <Link className={`button ${styles.explore}`} to={`/place/${place.urlSlug}`}>Take a Little Look <Icon name="arrow" size={17} /></Link>
  </article>;
}

MapPlacePreview.propTypes = {
  place: PropTypes.object.isRequired,
  id: PropTypes.string,
  nearbyPlaces: PropTypes.array,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
  closeButtonRef: PropTypes.object,
  showSave: PropTypes.bool,
};
