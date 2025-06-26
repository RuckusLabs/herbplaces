import { useState, useEffect } from 'react';
import { useFavorites } from '../../hooks/useFavorites';
import fetchPlaces from '../../utilities/fetchPlaces';
import List from '../List/List';
import styles from './FavoritesList.module.scss';

export default function FavoritesList() {
  const { favorites, loading, isLoggedIn } = useFavorites();
  const [places, setPlaces] = useState([]);

  useEffect(() => {
    fetchPlaces().then(setPlaces).catch(() => setPlaces([]));
  }, []);

  // Map favorite item_id to place object
  const favoritedPlaces = favorites
    .map(fav => places.find(place => String(place.id) === String(fav.item_id)))
    .filter(Boolean);

  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <h2>Favorites</h2>
        <p className="text-align-center">Please <a href="/auth">log in</a> to view your favorites.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h2>Favorites</h2>
        <p>Loading your favorites...</p>
      </div>
    );
  }

  if (favoritedPlaces.length === 0) {
    return (
      <div className={styles.container}>
        <h2>Favorites</h2>
        <p>You haven't favorited any places yet.</p>
        <p className={styles.hint}>
          Click the ❤️ button on places you like to save them here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>Favorites</h2>
      <List className={styles.places} places={favoritedPlaces} />
    </div>
  );
}