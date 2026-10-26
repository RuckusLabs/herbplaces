import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { getSafeReturnPath } from '../../utilities/authNavigation';
import { passwordlessEnabled } from '../../utilities/authFeatures';
import styles from './auth.module.scss';

export default function AccountRecovery({ mode }) {
  const { user, loading, requestPasswordReset, updatePassword, resendConfirmation } = useAuth();
  const [params] = useSearchParams();
  const destination = getSafeReturnPath(params.get('next'), '/favorites');
  const resetting = mode === 'reset';
  const confirming = mode === 'confirm';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  // Old recovery/confirmation URLs now return to email-code sign-in instead of recreating a password.
  if (passwordlessEnabled && !loading) return <Navigate to={user ? destination : `/login?next=${encodeURIComponent(destination)}`} replace />;
  const title = resetting ? 'Choose a New Password' : confirming ? 'Confirm Your Email' : 'Reset Your Password';
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (resetting && password !== repeat) { setError('Your passwords don’t match. Please enter them again.'); return; }
    setBusy(true);
    try {
      const result = resetting ? await updatePassword(password) : confirming ? await resendConfirmation(email.trim(), destination) : await requestPasswordReset(email.trim(), destination);
      if (result.error) throw result.error;
      setSent(true); setPassword(''); setRepeat('');
    } catch (failure) { setError(failure.message || 'We couldn’t complete that request. Please try again.'); }
    finally { setBusy(false); }
  };
  return <main id="main-content" className={styles.authSection}>
    <Helmet><title>{title} | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>
    <section className={styles.card}><h1>{title}</h1>
      {loading ? <p role="status">Checking your account…</p> : sent ? <div role="status">
        <p>{resetting ? 'Your password has been updated.' : confirming ? 'If this address is waiting for confirmation, we’ll send a new link. Check your inbox and spam folder. Use the newest email.' : 'If an account exists for this address, we’ll send a password reset link. Check your inbox and spam folder.'}</p>
        <Link className="button" to={resetting ? destination : `/login?next=${encodeURIComponent(destination)}`}>{resetting ? 'Continue to Your Account' : 'Back to Sign In'}</Link>
      </div> : resetting && !user ? <>
        <p role="alert">Open the link in your password reset email to choose a new password. If it has expired, request another link.</p>
        <Link className="button" to="/auth/forgot-password">Request a New Link</Link>
      </> : <>
        <p>{resetting ? 'Choose a password you haven’t used elsewhere.' : confirming ? 'Enter the email you used to create your account. A new confirmation link will help you finish signing up.' : 'Enter your account email and we’ll help you get back in.'}</p>
        <form onSubmit={submit} className={styles.form}>
          {resetting ? <>
            <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
            <label htmlFor="repeat-password">Confirm new password</label><input id="repeat-password" type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={event => setRepeat(event.target.value)} disabled={busy} />
          </> : <><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></>}
          {error && <p role="alert" className={styles.messageError}>{error}</p>}
          <button className="button" disabled={busy}>{busy ? 'Please Wait…' : resetting ? 'Save New Password' : confirming ? 'Send Confirmation Email' : 'Send Reset Link'}</button>
        </form>
        <Link to={`/login?next=${encodeURIComponent(destination)}`}>Back to Sign In</Link>
      </>}
    </section>
  </main>;
}
AccountRecovery.propTypes = { mode: PropTypes.oneOf(['forgot', 'reset', 'confirm']).isRequired };
