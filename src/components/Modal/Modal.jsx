import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import styles from './modal.module.scss';

export default function Modal({ open, onClose, children, labelledBy, describedBy, className = '', contentClassName = '', closeLabel = 'Close Account Prompt', onKeyDown }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <dialog ref={ref} className={`${styles.dialog} ${className}`} onKeyDown={onKeyDown} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-modal="true"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }}>
      <div className={`${styles.content} ${contentClassName}`}>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}><Icon name="close" size={21} /></button>
        {children}
      </div>
    </dialog>, document.body,
  );
}
Modal.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, children: PropTypes.node.isRequired, labelledBy: PropTypes.string.isRequired, describedBy: PropTypes.string, className: PropTypes.string, contentClassName: PropTypes.string, closeLabel: PropTypes.string, onKeyDown: PropTypes.func };
