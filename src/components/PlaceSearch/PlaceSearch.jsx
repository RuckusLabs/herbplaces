import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './placeSearch.module.scss';

export default function PlaceSearch({ id, value, onChange, onSubmit, buttonLabel = 'Search Places', className = '' }) {
  return <form className={`${styles.search} ${className}`} onSubmit={onSubmit} role="search">
    <Icon name="pin" size={21} />
    <label className={styles.srOnly} htmlFor={id}>Search by city, state, or place</label>
    <input id={id} type="search" placeholder="Your city, state, or a little herb place" value={value} onChange={event => onChange(event.target.value)} />
    <button type="submit" className="button">{buttonLabel} <Icon name="arrow" size={18} /></button>
  </form>;
}

PlaceSearch.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  buttonLabel: PropTypes.string,
  className: PropTypes.string,
};
