import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from '../pages/Auth/auth.module.scss';

export default function EmailCodeForm({ registering = false, destination, onVerified, verifyLabel = 'Verify & Continue', onBusyChange, autoVerify = false, onChallengeChange }) {
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
  const lastAutoAttempt = useRef('');
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= resendAt) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => { if (sentTo) codeInput.current?.focus(); }, [sentTo]);
  useEffect(() => {
    if (error && !busy && sentTo) { codeInput.current?.focus(); codeInput.current?.select(); }
  }, [error, busy, sentTo]);

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
    setSentTo(address); setCode(''); lastAutoAttempt.current = ''; onChallengeChange?.(address); setNow(Date.now()); setResendAt(Date.now() + 60000);
    codeInput.current?.focus();
  });
  const verify = token => {
    if (!/^[0-9]{6}$/.test(token)) return;
    return run(async () => {
      const { data, error: failure } = await verifyEmailCode({ email: sentTo, token });
      if (failure) throw new Error(failure.status === 429 ? 'Too many attempts. Please wait a moment before trying again.' : !failure.status || failure.status >= 500 ? 'We couldn’t check your code. Please try again.' : 'That code is invalid or has expired. Check the latest email, or request a new code.');
      if (!data?.session || !data.session.user?.email_confirmed_at) throw new Error('We couldn’t verify your email. Please request a new code.');
      setCode('');
      await onVerified?.(data.session.user);
    });
  };
  const enterCode = event => {
    const value = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (value.length < 6) lastAutoAttempt.current = '';
    if (autoVerify && value.length === 6 && !event.nativeEvent.isComposing && lastAutoAttempt.current !== value && !inFlight.current) {
      lastAutoAttempt.current = value;
      void verify(value);
    }
  };
  const submit = event => {
    event.preventDefault();
    return sentTo ? verify(code) : send();
  };
  return <form onSubmit={submit} className={`${styles.form} ${autoVerify ? styles.codeForm : ''}`} aria-busy={busy}>
    {sentTo ? <>
      <p role="status">Code sent to <strong>{sentTo}</strong>.</p>
      <label htmlFor="email-code">Email code</label>
      <input ref={codeInput} id="email-code" name="one-time-code" className={styles.codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={12} value={code} onInput={enterCode} onChange={enterCode} autoCapitalize="none" spellCheck={false} required disabled={busy} aria-invalid={!!error} aria-describedby="email-code-help" />
      <p id="email-code-help" className={styles.formNote} aria-live="polite">{busy && autoVerify ? 'Signing you in…' : autoVerify ? 'Use AutoFill or paste your code. We’ll sign you in automatically.' : 'Use the most recent code. You can paste it here.'}</p>
    </> : <>
      <label htmlFor="code-email">Email</label><input id="code-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
      <p className={styles.formNote}>We’ll email you a code. No password to remember.</p>
      {registering && <label className={styles.consent}><input type="checkbox" required disabled={busy} /><span>I agree to the <Link to="/membership-terms">membership terms</Link> and have read the <Link to="/privacy">privacy policy</Link>.</span></label>}
    </>}
    {error && <p role="alert" className={styles.messageError}>{error}</p>}
    {(!sentTo || !autoVerify || error) && <button className="button" disabled={busy || (sentTo && code.length !== 6)}>{busy ? 'Please Wait…' : sentTo ? autoVerify ? 'Try Again' : verifyLabel : 'Send Email Code'}</button>}
    {sentTo && <div className={styles.codeActions}>
      <button type="button" disabled={busy || remaining > 0} onClick={send}>{remaining ? `Resend in ${remaining}s` : 'Send a New Code'}</button>
      <button type="button" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); lastAutoAttempt.current = ''; onChallengeChange?.(''); }}>Change Email</button>
    </div>}
  </form>;
}
EmailCodeForm.propTypes = { registering: PropTypes.bool, destination: PropTypes.string.isRequired, onVerified: PropTypes.func, verifyLabel: PropTypes.string, onBusyChange: PropTypes.func, autoVerify: PropTypes.bool, onChallengeChange: PropTypes.func };
