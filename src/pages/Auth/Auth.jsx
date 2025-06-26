import { useEffect } from 'react';
import { Helmet } from "react-helmet";
import { useFavorites } from '/src/hooks/useFavorites';
import { useAuth } from '/src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.scss';
import Login from './Login';
import Register from './Register';

export default function Auth() {
  const { user } = useAuth();
  const { getGuestFavorites, clearGuestFavorites, toggleFavorite } = useFavorites();
  const navigate = useNavigate();

  // Sync guest favorites after user is set
  useEffect(() => {
    const doSync = async () => {
      const guestFavs = getGuestFavorites();
      if (user && guestFavs.length > 0) {
        for (const id of guestFavs) {
          await toggleFavorite(id);
        }
        clearGuestFavorites();
        navigate('/map');
      }
    };
    doSync();
    // eslint-disable-next-line
  }, [user]);

  return (
    <>
      <Helmet>
        <title>Auth | Little Herb Places</title>
      </Helmet>
      <section className={styles.authSection}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.content}>
              {user ? (
                <p>Welcome back! You are logged in as {user.email}.</p>
              ) : (
                <>
                  <Login />
                  <Register />
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// This file is now obsolete. Login and Register are now separate pages.
// You may safely delete this file.