import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { getSafeReturnPath, readAuthDestination, rememberAuthDestination, clearAuthDestination } from '../../utilities/authNavigation';
import EmailCodeForm from '../../components/EmailCodeForm';
import { passwordlessEnabled } from '../../utilities/authFeatures';
import Icon from '../../components/Icons/Icon';
import styles from './auth.module.scss';

export default function AuthForm({ mode }) {
  const registering = mode === 'register';
  const { user, loading: authLoading, signUp, signIn } = useAuth();
  const { loading: favoritesLoading, error: syncError, retry } = useFavorites();
  const [params] = useSearchParams();
  const destination = getSafeReturnPath(params.get('next') || readAuthDestination());
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  useEffect(() => { rememberAuthDestination(destination); }, [destination]);
  useEffect(() => {
    if (user && !authLoading && !favoritesLoading && !syncError) {
      clearAuthDestination();
      navigate(destination, { replace: true });
    }
  }, [user, authLoading, favoritesLoading, syncError, destination, navigate]);

  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setConfirmation(false);
    rememberAuthDestination(destination);
    try {
      if (registering) {
        const { data, error: signupError } = await signUp({ email: email.trim(), password, next: destination });
        if (signupError) throw signupError;
        if (!data.session) setConfirmation(true);
      } else {
        const { error: signinError } = await signIn({ email: email.trim(), password });
        if (signinError) throw signinError;
      }
    } catch (failure) {
      setError(failure.message || 'We couldn’t complete that request. Please try again.');
    } finally { setSubmitting(false); }
  };

  const switchingPath = `/${registering ? 'login' : 'register'}?next=${encodeURIComponent(destination)}`;
  return <main id="main-content" className={styles.authSection}>
    <Helmet><title>{registering ? 'Create an Account' : 'Sign In'} | Little Herb Places</title></Helmet>
    <section className={styles.card}>
      <Icon name="sprout" size={64} />
      <h1>{registering ? 'Create an Account' : 'Welcome Back'}</h1>
      {(authLoading || user) && !codeBusy ? <>
        {syncError ? <div className={styles.status} role="alert"><p>{syncError}</p><button type="button" className="button" onClick={retry}>Try Syncing Again</button></div> : <p className={styles.status} role="status">Bringing Your Saved Places Together…</p>}
      </> : confirmation ? <div className={styles.status} role="status"><h2>Check Your Inbox.</h2><p>Use the confirmation link to finish creating your account. If you started a claim, continue in the same browser to recover your saved details. Creating an account does not submit your claim.</p><Link className="button" to={`/login?next=${encodeURIComponent(destination)}`}>Continue to Sign In <Icon name="arrow" size={17} /></Link><p><Link to={`/auth/resend-confirmation?next=${encodeURIComponent(destination)}`}>Send Another Confirmation Email</Link></p></div> : <>
        <p>{destination.includes('claim=1') ? 'Sign in or create a free account to finish your ownership claim. You’ll review and submit it after signing in. No payment is taken during claiming.' : destination === '/favorites' ? (registering ? 'Your little discoveries are waiting. Create an account to keep your saved places together.' : 'Your little discoveries are waiting. Sign in to keep your saved places together.') : registering ? 'Join a community rooted in nature.' : 'A little welcome back to your plant-loving community.'}</p>
        {passwordlessEnabled ? <EmailCodeForm key={mode} registering={registering} destination={destination} onBusyChange={setCodeBusy} /> : <>
        <form onSubmit={submit} className={styles.form}>
          <label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Your Email" required disabled={submitting} />
          <label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At Least 6 Characters" minLength={6} required disabled={submitting} />
          {error && <div className={styles.messageError} role="alert">{error}</div>}
          <button className="button" type="submit" disabled={submitting || !email.trim() || password.length < 6}>{submitting ? 'Please Wait…' : registering ? 'Create an Account' : 'Sign In'}<Icon name="arrow" size={17} /></button>
        </form>
        {registering && <p className={styles.formNote}>By creating an account, you agree to our <Link to="/membership-terms">membership terms</Link>. Read how we handle your information in <Link to="/privacy">Privacy</Link>.</p>}
        {!registering && <p><Link to={`/auth/forgot-password?next=${encodeURIComponent(destination)}`}>Forgot Your Password?</Link></p>}
        <p><Link to={`/auth/resend-confirmation?next=${encodeURIComponent(destination)}`}>Need a Confirmation Email?</Link></p>
        </>}
        <div className={styles.switchAccount}><p>{registering ? 'Already have an account?' : 'New to Little Herb Places?'}</p><Link className={`button ${styles.secondary}`} to={switchingPath}>{registering ? 'Sign In' : 'Create an Account'}</Link></div>
      </>}
    </section>
  </main>;
}
AuthForm.propTypes = { mode: PropTypes.oneOf(['register', 'login']).isRequired };
