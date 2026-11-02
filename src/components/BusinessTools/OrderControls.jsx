import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './growth.module.scss';

export default function OrderControls({ label, index, count, onMove }) {
  return <div className={styles.orderControls} aria-label={`Reorder ${label}`}>
    <button type="button" disabled={index===0} aria-label={`Move ${label} up`} onClick={event=>{ if(index===1) event.currentTarget.nextElementSibling?.focus(); onMove(-1); }}><Icon name="arrow" size={14} /></button>
    <button type="button" disabled={index===count-1} aria-label={`Move ${label} down`} onClick={event=>{ if(index===count-2) event.currentTarget.previousElementSibling?.focus(); onMove(1); }}><Icon name="arrow" size={14} /></button>
  </div>;
}
OrderControls.propTypes = { label:PropTypes.string.isRequired,index:PropTypes.number.isRequired,count:PropTypes.number.isRequired,onMove:PropTypes.func.isRequired };
