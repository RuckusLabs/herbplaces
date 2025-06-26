import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './modal.module.scss';

export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return createPortal(
    <div className={styles['modal-backdrop']}>
      <div className={styles['modal-content']}>
        <button
          onClick={onClose}
          className={styles['modal-close']}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};
