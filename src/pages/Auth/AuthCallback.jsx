import { useEffect, useState } from 'react';
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
  const [notice] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error') || params.has('error_code') || hash.has('error') || hash.has('error_code')) return 'error';
    if (hash.get('message') === 'Confirmation link accepted. Please proceed to confirm link sent to the other email') return 'confirm-other';
    return null;
  });
  useEffect(() => {
    if (!notice && user && !authLoading && !favoritesLoading && !error) {
      clearAuthDestination();
      navigate(destination, { replace: true });
    }
  }, [user, authLoading, favoritesLoading, error, destination, navigate, notice]);

  const busy = authLoading || favoritesLoading;
  return <main id="main-content" className={styles.authSection}>
    <Helmet><title>Completing Sign In | Little Herb Places</title></Helmet>
    <section className={styles.card}>
      <Icon name="sprout" size={64} />
      <h1>{notice === 'confirm-other' ? 'One More Confirmation.' : notice === 'error' ? 'Let’s Try That Again.' : busy || (user && !error) ? 'A Little Moment…' : 'Let’s Try That Again.'}</h1>
      {notice ? <div className={styles.status} role={notice === 'error' ? 'alert' : 'status'}><p>{notice === 'confirm-other' ? 'This confirmation was accepted. Open the separate email sent to your other address and confirm there too. Your current sign-in address stays in use until both are confirmed.' : 'We couldn’t confirm this link. It may have expired or already been used. Check your account settings or request a new sign-in code.'}</p><Link className="button" to={user ? '/settings#email' : `/login?next=${encodeURIComponent(destination)}`}>{user ? 'Return to Account Settings' : 'Continue to Sign In'}</Link></div> : busy || (user && !error) ? <p role="status">Finishing Sign In and Gathering Your Saved Places…</p> : error ? <div className={styles.status} role="alert"><p>{error}</p><button className="button" onClick={retry}>Try Syncing Again</button></div> : <div className={styles.status}><p>We couldn’t confirm your sign-in. The link may have expired or already been used. Your saved places are still on this device.</p><Link className="button" to={`/login?next=${encodeURIComponent(destination)}`}>Continue to Sign In</Link></div>}
    </section>
  </main>;
}
