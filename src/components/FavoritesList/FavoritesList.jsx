import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useFavorites } from '../../hooks/useFavorites';
import usePlaces from '../../hooks/usePlaces';
import List from '../List/List';
import Icon from '../Icons/Icon';
import MyPlaces from '../../pages/Management/MyPlaces';
import { useManagement } from '../../contexts/ManagementContext';
import styles from './FavoritesList.module.scss';

export default function FavoritesList() {
  const { favorites, loading, isLoggedIn, error: favoritesError, retry: retryFavorites } = useFavorites();
  const { places, loading: placesLoading, error, retry } = usePlaces(favorites.length > 0);
  const ids = new Set(favorites.map(fav => String(typeof fav === 'string' ? fav : fav.item_id)));
  const saved = places.filter(place => ids.has(String(place.id)));
  const management = useManagement();
  const hasManagedPlaces = management.memberships.length > 0 || management.claims.some(claim => ['pending', 'approved'].includes(claim.status));
  return <main id="main-content" className={styles.container}>
    <Helmet><title>Saved Places | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet><h1>Your Saved Places.</h1><p className={styles.intro}>Little discoveries to come back to, whenever you’re ready.</p>
    <MyPlaces />
    {hasManagedPlaces && <h2 className={styles.savedHeading}>Saved Places</h2>}
    {!loading && !isLoggedIn && <section className={styles.accountPrompt} aria-labelledby="saved-account-title">
      <Icon name="heart" size={64} />
      <div className={styles.accountCopy}><h2 id="saved-account-title">Keep Your Little Discoveries Close.</h2><p>{favorites.length ? 'These places are saved on this device. Sign in or create a free account to access your favorites across your devices.' : 'Sign in to see your saved places, or create a free account to start a collection of little places you love.'}</p></div>
      <div className={styles.accountActions}><Link to="/register?next=%2Ffavorites" className="button">Create an Account <Icon name="arrow" size={17} /></Link><Link to="/login?next=%2Ffavorites" className={`button ${styles.signIn}`}>Sign In</Link></div>
    </section>}
    {loading || (favorites.length > 0 && placesLoading) ? <p role="status">Gathering your saved places…</p> : (error || favoritesError) ? <div className={styles.empty} role="status"><p>{favoritesError || error}</p><button className="button" onClick={favoritesError ? retryFavorites : retry}>Try Again</button></div> : !saved.length ? <div className={styles.empty}><Icon name="heart" size={64} /><h2>A Little Room for Discovery.</h2><p>Tap the heart on a place you love to keep it here.</p><Link to="/map" className="button">Explore Places <Icon name="arrow" size={17} /></Link></div> : <List places={saved} />}
  </main>;
}
