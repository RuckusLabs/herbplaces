import PropTypes from 'prop-types';
import styles from './polaroid.module.scss';

const Polaroid = ({ 
  imageUrl, 
  alt = '', 
  rotation = 0, 
  offsetX = 0, 
  offsetY = 0,
  className
}) => {
  const style = {
    transform: `rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)`
  };

  return (
    <div className={`polaroid ${className || ''}`} style={styles}>
      <div className="polaroid__frame">
        <img 
          src={imageUrl} 
          alt={alt} 
          className="polaroid__image"
          loading="lazy"
        />
      </div>
    </div>
  );
};

Polaroid.propTypes = {
  imageUrl: PropTypes.string.isRequired,
  alt: PropTypes.string,
  rotation: PropTypes.number,
  offsetX: PropTypes.number,
  offsetY: PropTypes.number,
  className: PropTypes.string
};

export default Polaroid; 