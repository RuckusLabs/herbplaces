import { useState } from 'react';
import PropTypes from 'prop-types';
import './Banner.scss';

const Banner = ({ className, onClose, children }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className={`banner ${className || ''}`}>
      <button
        className="banner__close"
        onClick={handleClose}
        aria-label="Close banner"
      >
        ×
      </button>
      <div className="banner__content">
        {children}
      </div>
    </div>
  );
};

Banner.propTypes = {
  className: PropTypes.string,
  onClose: PropTypes.func,
  children: PropTypes.node,
};

export default Banner; 