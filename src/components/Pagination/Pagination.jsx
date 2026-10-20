import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './pagination.module.scss';

export default function Pagination({ page, pageCount, total, start, end, onChange }) {
  if (pageCount <= 1) return null;
  return <nav className={styles.pagination} aria-label="Places pagination">
    <p>Showing {start}–{end} of {total} places</p>
    <div className={styles.controls}>
      <button type="button" className="button" aria-label="Previous Page" disabled={page === 1} onClick={() => onChange(page - 1)}><Icon name="arrow" size={15} className={styles.previous} />Previous</button>
      <span role="status" aria-live="polite">Page {page} of {pageCount}</span>
      <button type="button" className="button" aria-label="Next Page" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next<Icon name="arrow" size={15} /></button>
    </div>
  </nav>;
}
Pagination.propTypes = { page: PropTypes.number.isRequired, pageCount: PropTypes.number.isRequired, total: PropTypes.number.isRequired, start: PropTypes.number.isRequired, end: PropTypes.number.isRequired, onChange: PropTypes.func.isRequired };
