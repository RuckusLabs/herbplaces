import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from '../pages/Auth/auth.module.scss';

export default function EmailCodeForm({ registering = false, destination, onVerified, verifyLabel = 'Verify & Continue', onBusyChange }) {
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const codeInput = useRef(null);
  const inFlight = useRef(false);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= resendAt) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => { if (sentTo) codeInput.current?.focus(); }, [sentTo]);

  const run = async action => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'We couldn’t complete that request. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  };
  const send = () => run(async () => {
    const address = (sentTo || email).trim().toLowerCase();
    const { error: failure } = await sendEmailCode({ email: address, registering, next: destination });
    if (failure) throw failure;
    setSentTo(address); setCode(''); setNow(Date.now()); setResendAt(Date.now() + 60000);
    codeInput.current?.focus();
  });
  const submit = event => {
    event.preventDefault();
    if (!sentTo) return send();
    return run(async () => {
      const { data, error: failure } = await verifyEmailCode({ email: sentTo, token: code });
      if (failure) throw new Error(failure.status === 429 ? 'Too many attempts. Please wait a moment before trying again.' : 'That code is invalid or has expired. Check the latest email, or request a new code.');
      if (!data?.session || !data.session.user?.email_confirmed_at) throw new Error('We couldn’t verify your email. Please request a new code.');
      setCode('');
      await onVerified?.(data.session.user);
    });
  };
  return <form onSubmit={submit} className={styles.form}>
    {sentTo ? <>
      <p role="status">Check <strong>{sentTo}</strong> for your six-digit code. Keep this page open.</p>
      <label htmlFor="email-code">Email code</label>
      <input ref={codeInput} id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={12} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={busy} aria-describedby="email-code-help" />
      <p id="email-code-help" className={styles.formNote}>Use the most recent code. You can paste it here.</p>
    </> : <>
      <label htmlFor="code-email">Email</label><input id="code-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
      <p className={styles.formNote}>We’ll email you a code. No password to remember.</p>
      {registering && <label className={styles.consent}><input type="checkbox" required disabled={busy} /><span>I agree to the <Link to="/membership-terms">membership terms</Link> and have read the <Link to="/privacy">privacy policy</Link>.</span></label>}
    </>}
    {error && <p role="alert" className={styles.messageError}>{error}</p>}
    <button className="button" disabled={busy || (sentTo && code.length !== 6)}>{busy ? 'Please Wait…' : sentTo ? verifyLabel : 'Send Email Code'}</button>
    {sentTo && <div className={styles.codeActions}>
      <button type="button" disabled={busy || remaining > 0} onClick={send}>{remaining ? `Resend in ${remaining}s` : 'Send a New Code'}</button>
      <button type="button" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); }}>Change Email</button>
    </div>}
  </form>;
}
EmailCodeForm.propTypes = { registering: PropTypes.bool, destination: PropTypes.string.isRequired, onVerified: PropTypes.func, verifyLabel: PropTypes.string, onBusyChange: PropTypes.func };
