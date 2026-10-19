import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFavorites } from '../../hooks/useFavorites';
import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import Modal from '../Modal/Modal';
import styles from './favoriteButton.module.scss';

export default function FavoriteButton({ itemId, itemType = 'place', size = 30, className = '', showText = false }) {
  const { isFavorited, toggleFavorite, loading, error: loadError, isLoggedIn } = useFavorites();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const promptId = useId();
  useEffect(() => { if (isLoggedIn) setShowAccountPrompt(false); }, [isLoggedIn]);
  const saved = isFavorited(itemId);
  const toggle = async event => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError('');
    try {
      const added = await toggleFavorite(itemId, itemType);
      if (added && !isLoggedIn) setShowAccountPrompt(true);
    } catch { setError('Couldn’t save this place. Please try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" className={`favorite-button ${className}`} onClick={toggle} disabled={busy || loading || !!loadError} aria-pressed={saved} aria-label={saved ? 'Remove from favorites' : 'Save to favorites'} title={loadError || (saved ? 'Remove from favorites' : 'Save to favorites')}>
      <Icon name="heart" size={size} fill={saved ? 'currentColor' : 'none'} />
      {showText && <span>{saved ? 'Saved' : 'Save Place'}</span>}
    </button>
    {error && <span role="alert" className="favorite-error">{error}</span>}
    <Modal open={showAccountPrompt && !isLoggedIn} onClose={() => setShowAccountPrompt(false)} labelledBy={`${promptId}-title`} describedBy={`${promptId}-description`}>
      <div className={styles.prompt}>
        <Icon name="sprout" size={72} />
        <h2 id={`${promptId}-title`}>Keep Your Favorite Places Close.</h2>
        <p id={`${promptId}-description`}>We’ve saved this place on this device. Create a free account to keep your favorites with you wherever you sign in.</p>
        <div className={styles.actions}>
          <Link to="/register?next=%2Ffavorites" className="button" onClick={() => setShowAccountPrompt(false)}>Create an Account <Icon name="arrow" size={18} /></Link>
          <Link to="/login?next=%2Ffavorites" className={`button ${styles.secondary}`} onClick={() => setShowAccountPrompt(false)}>Already a Member? Sign In</Link>
          <button type="button" className={`button ${styles.browse}`} onClick={() => setShowAccountPrompt(false)}>Keep Browsing</button>
        </div>
      </div>
    </Modal>
  </>;
}
FavoriteButton.propTypes = { itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, itemType: PropTypes.string, size: PropTypes.number, className: PropTypes.string, showText: PropTypes.bool };
