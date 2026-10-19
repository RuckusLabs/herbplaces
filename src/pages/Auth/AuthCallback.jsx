import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { getSafeReturnPath, readAuthDestination, clearAuthDestination } from '../../utilities/authNavigation';
import Icon from '../../components/Icons/Icon';
import styles from './auth.module.scss';

export default function AuthCallback() {
  const { user, loading: authLoading } = useAuth();
  const { loading: favoritesLoading, error, retry } = useFavorites();
  const [params] = useSearchParams();
  const destination = getSafeReturnPath(params.get('next') || readAuthDestination(), '/favorites');
  const navigate = useNavigate();
  useEffect(() => {
    if (user && !authLoading && !favoritesLoading && !error) {
      clearAuthDestination();
      navigate(destination, { replace: true });
    }
  }, [user, authLoading, favoritesLoading, error, destination, navigate]);

  const busy = authLoading || favoritesLoading;
  return <main id="main-content" className={styles.authSection}>
    <Helmet><title>Completing Sign In | Little Herb Places</title></Helmet>
    <section className={styles.card}>
      <Icon name="sprout" size={64} />
      <h1>{busy || (user && !error) ? 'A Little Moment…' : 'Let’s Try That Again.'}</h1>
      {busy || (user && !error) ? <p role="status">Finishing Sign In and Gathering Your Saved Places…</p> : error ? <div className={styles.status} role="alert"><p>{error}</p><button className="button" onClick={retry}>Try Syncing Again</button></div> : <div className={styles.status}><p>We couldn’t confirm your sign-in. The link may have expired or already been used. Your saved places are still on this device.</p><Link className="button" to={`/login?next=${encodeURIComponent(destination)}`}>Continue to Sign In</Link></div>}
    </section>
  </main>;
}
