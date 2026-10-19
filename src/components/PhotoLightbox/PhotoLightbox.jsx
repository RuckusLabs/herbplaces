import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import Icon from '../Icons/Icon';
import styles from './photoLightbox.module.scss';

export default function PhotoLightbox({ photos, index, name, onChange, onClose }) {
  const titleId = useId();
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = index !== null;
  useEffect(() => { setZoomed(false); setFailed(false); }, [index]);
  const change = direction => onChange((index + direction + photos.length) % photos.length);
  return <Modal open={open} onClose={onClose} labelledBy={titleId} className={styles.lightbox} contentClassName={styles.content} closeLabel="Close Photo Viewer" onKeyDown={event => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !zoomed && photos.length > 1) { event.preventDefault(); change(event.key === 'ArrowRight' ? 1 : -1); }
  }}>
    <div className={styles.toolbar}><div><h2 id={titleId}>{name}</h2><p role="status">Photo {index + 1} of {photos.length}</p></div><button className="button" onClick={() => setZoomed(value => !value)} disabled={failed}>{zoomed ? 'Fit to Screen' : 'View Full Size'} <Icon name="expand" size={17} /></button></div>
    <div className={`${styles.stage} ${zoomed ? styles.zoomed : ''}`} key={index} tabIndex={zoomed ? 0 : undefined} aria-label={zoomed ? 'Full-size photo. Scroll to explore the image.' : undefined}>
      {open && <img src={photos[index]} alt={`${name} — photo ${index + 1} of ${photos.length}`} onError={event => { setFailed(true); if (!event.currentTarget.src.endsWith('/assets/pages/home/hero.jpg')) event.currentTarget.src = '/assets/pages/home/hero.jpg'; }} />}
    </div>
    <div className={styles.controls}>{photos.length > 1 && <button className="button" aria-label="Previous Full-Size Photo" onClick={() => change(-1)}><Icon className={styles.previous} name="arrow" size={18} />Previous</button>}<p>{failed ? 'This photo couldn’t load. Showing a little greenery instead.' : zoomed ? 'Scroll to explore. Choose Fit to Screen to see the whole photo.' : 'The whole photo, with room to take it in.'}</p>{photos.length > 1 && <button className="button" aria-label="Next Full-Size Photo" onClick={() => change(1)}>Next<Icon name="arrow" size={18} /></button>}</div>
  </Modal>;
}
PhotoLightbox.propTypes = { photos: PropTypes.arrayOf(PropTypes.string).isRequired, index: PropTypes.number, name: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired };
