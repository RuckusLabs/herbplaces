import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import { getPlaceCategories } from '../../utilities/placeFilters';
import styles from './mapPlacePin.module.scss';

export default function MapPlacePin({ place, count = 1, selected = false, label, labelOnHover = false, ariaLabel, ariaControls, onClick, style }) {
  const tags = getPlaceCategories(place || {});
  const icon = tags.find(tag => tag.id === 'gardens')?.icon || tags[0]?.icon || 'shop';
  return <button type="button" className={`${styles.pin} ${selected ? styles.active : ''} ${labelOnHover ? styles.quietLabel : ''}`} style={style} aria-label={ariaLabel} aria-pressed={selected} aria-controls={ariaControls} onClick={onClick}>
    <span className={styles.pinIcon}><Icon name={icon} size={43} />{count > 1 && <span className={styles.count}>{count}</span>}</span>
    <span className={styles.pinLabel}>{label || (count > 1 ? `${count} Little Places` : place?.name)}</span>
  </button>;
}

MapPlacePin.propTypes = {
  place: PropTypes.object,
  count: PropTypes.number,
  selected: PropTypes.bool,
  label: PropTypes.string,
  labelOnHover: PropTypes.bool,
  ariaLabel: PropTypes.string.isRequired,
  ariaControls: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  style: PropTypes.object,
};
