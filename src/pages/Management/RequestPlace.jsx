import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import { managementRpc } from '../../utilities/managementApi';
import styles from '../../components/PlaceManagement/management.module.scss';

const storageKey = 'little-herb-listing-request';
const confirmationDraftKey = 'little-herb-listing-request-confirmation';
const empty = () => ({ name: '', website: '', city: '', region: '', notes: '', requestId: crypto.randomUUID() });
function readDraft() {
  const candidates = [];
  for (const storage of ['sessionStorage', 'localStorage']) {
    try {
      const saved = JSON.parse(window[storage].getItem(storage === 'sessionStorage' ? storageKey : confirmationDraftKey));
      if (saved && saved.savedAt <= Date.now() && saved.savedAt > Date.now() - 86400000 && typeof saved.requestId === 'string'
        && ['name', 'website', 'city', 'region', 'notes'].every(key => typeof saved[key] === 'string')) candidates.push(saved);
    } catch { /* The form also works without browser storage. */ }
  }
  return candidates.sort((a, b) => b.savedAt - a.savedAt)[0] || empty();
}

export default function RequestPlace({ embedded = false }) {
  const { pathname, search } = useLocation();
  const destination = encodeURIComponent(`${pathname}${search}`);
  const plan = new URLSearchParams(search).get('plan') === 'thrive' ? 'thrive' : 'bloom';
  const claimPath = slug => embedded ? `/the-little-garden/start?${new URLSearchParams({ plan, place: slug, claim: '1' })}` : `/place/${slug}?claim=1`;
  const Root = embedded ? 'section' : 'main';

  const { user, loading: authLoading, signUp, signIn } = useAuth();
  const [accountMode, setAccountMode] = useState('signup');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [stage, setStage] = useState('details');
  const [submittedName, setSubmittedName] = useState('');
  const heading = useRef(null);
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, [stage, confirmation, submittedName]);
  const [draft, setDraft] = useState(readDraft);
  const [requests, setRequests] = useState([]);
  const [requestOwner, setRequestOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() })); } catch { /* Optional draft recovery. */ }
  }, [draft]);
  useEffect(() => {
    setRequestOwner(user?.id || null);
    if (!user?.email_confirmed_at) { setRequests([]); return; }
    let active = true;
    setLoading(true); setListError(''); setRequests([]);
    managementRpc('get_listing_requests').then(result => { if (active) setRequests(result || []); })
      .catch(failure => { if (active) setListError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.email_confirmed_at, attempt]);
  const update = field => event => { const value = event.target.value; setDraft(previous => ({ ...previous, [field]: value })); };
  const visibleRequests = requestOwner === user?.id ? requests : [];
  const submit = async event => {
    event.preventDefault();
    if (busy || authLoading) return;
    if (stage === 'details' && !user) { setError(''); setStage('account'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (!user) {
        // Keep only the listing details for confirmation in another tab; never credentials.
        try { localStorage.setItem(confirmationDraftKey, JSON.stringify({ ...draft, savedAt: Date.now() })); } catch { /* Same-tab recovery remains available. */ }
        const result = accountMode === 'signup'
          ? await signUp({ email: accountEmail.trim(), password, next: `${pathname}${search}` })
          : await signIn({ email: accountEmail.trim(), password });
        if (result.error) throw result.error;
        setPassword('');
        if (!result.data?.session || !result.data.session.user?.email_confirmed_at) {
          setConfirmation(true);
          setNotice('Check your inbox to finish setting up your account, then return here to review and send your saved listing request. Your request has not been sent. If you already have an account, sign in below.');
          return;
        }
      } else if (!user.email_confirmed_at) {
        setError('Confirm your account email before sending your request. Your details are saved here.');
        return;
      }
      await managementRpc('request_place_listing', { p_name: draft.name.trim(), p_website: draft.website.trim(), p_city: draft.city.trim(), p_region: draft.region.trim(), p_notes: draft.notes.trim(), p_request_id: draft.requestId });
      setNotice('Your listing request is saved. Our team will review it.');
      setSubmittedName(draft.name.trim());
      try { localStorage.removeItem(confirmationDraftKey); } catch { /* Optional cross-tab recovery. */ }
      setConfirmation(false); setStage('details'); setDraft(empty()); setAttempt(value => value + 1);
    } catch (failure) { setError(failure.message || 'We couldn’t send your request. Your details are still here.'); }
    finally { setBusy(false); }
  };
  const summary = <div className={styles.requestSummary}><div><strong>{draft.name}</strong><span>{[draft.city, draft.region].filter(Boolean).join(', ')}</span></div>{!confirmation && <button type="button" disabled={busy} onClick={() => { setStage('details'); setError(''); }}>Edit</button>}</div>;
  return <Root id={embedded ? undefined : 'main-content'} className={embedded ? styles.simpleRequest : `${styles.page} ${styles.simpleRequest}`}>
    {!embedded && <Helmet><title>Request a Listing | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>}
    {embedded && submittedName ? <div className={styles.flowCard}>
      <h1 ref={heading} tabIndex={-1}>Thanks — we’ve got it.</h1><p role="status" className={styles.notice}>{notice}</p><p>We’ll review {submittedName}. Once the listing is ready, you can submit an ownership claim.</p><Link className="button" to="/request-place">View Request Status</Link>
    </div> : confirmation && !user ? <div className={styles.flowCard}>
      <h1 ref={heading} tabIndex={-1}>Check your inbox.</h1><p role="status">Confirm your email, then return here to send your request. Your request has not been sent.</p>{summary}<p className={styles.small}>Your place details are saved in this browser for 24 hours.</p><button type="button" className="button" onClick={() => { setConfirmation(false); setStage('account'); setAccountMode('signin'); setNotice(''); }}>Sign In to Continue</button><p><Link to={`/auth/resend-confirmation?next=${destination}`}>Send Another Confirmation Email</Link></p>
    </div> : <div className={styles.flowCard}>
      <p className={styles.small}>{stage === 'account' ? '2 of 2 · Your account' : user ? 'Your place' : '1 of 2 · Your place'}</p>
      <h1 ref={heading} tabIndex={-1}>{stage === 'account' ? user ? 'Ready to send?' : accountMode === 'signup' ? 'Finish with your account.' : 'Welcome back.' : 'Add your place.'}</h1>
      <p>{stage === 'account' ? 'Keep your request and its status in one place.' : 'Start with the basics. Requesting a listing is free.'}</p>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <form className={styles.form} onSubmit={submit}>
        {stage === 'details' ? <fieldset className={styles.flowFields} disabled={busy}>
          <label>Place name<input required minLength={2} maxLength={200} value={draft.name} onChange={update('name')} autoComplete="organization" /></label>
          <div className={styles.formRow}><label>City<input required maxLength={200} value={draft.city} onChange={update('city')} autoComplete="address-level2" /></label><label>State or region<input maxLength={200} value={draft.region} onChange={update('region')} autoComplete="address-level1" /></label></div>
          <details className={styles.optionalDetails}><summary>Add a website or note (optional)</summary><div className={styles.optionalFields}><label>Website (optional)<input type="url" pattern="https?://.+" title="Start the website address with https:// or http://." maxLength={2000} value={draft.website} onChange={update('website')} /></label><label>Anything we should know? (optional)<textarea value={draft.notes} onChange={update('notes')} maxLength={2000} /></label><p className={styles.small}>Please leave out passwords, payment details, and sensitive information.</p></div></details>
        </fieldset> : summary}
        {stage === 'account' && !user && <fieldset className={styles.flowFields} disabled={busy} aria-label="Your account">
          <label>Account email<input type="email" autoComplete="email" value={accountEmail} onChange={event => setAccountEmail(event.target.value)} required maxLength={254} /></label>
          <label>{accountMode === 'signup' ? 'Create a password' : 'Password'}<input type="password" autoComplete={accountMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={6} /></label>
          {accountMode === 'signup' && <label className={styles.check}><input type="checkbox" required /> <span>I agree to the <Link to="/membership-terms">membership terms</Link> and have read the <Link to="/privacy">privacy policy</Link>.</span></label>}
        </fieldset>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {authLoading ? <p role="status">Checking your account…</p> : user && !user.email_confirmed_at ? <><p>Confirm your email to send your request.</p><Link className="button" to={`/auth/resend-confirmation?next=${destination}`}>Send Confirmation Email</Link></>
          : <button className="button" disabled={busy}>{busy ? 'Please Wait…' : user ? 'Send Listing Request' : stage === 'details' ? 'Continue' : accountMode === 'signup' ? 'Create Account & Send Request' : 'Sign In & Send Request'}</button>}
        {stage === 'account' && !user && <button className={styles.accountSwitch} type="button" disabled={busy} onClick={() => { setAccountMode(accountMode === 'signup' ? 'signin' : 'signup'); setError(''); }}>{accountMode === 'signup' ? 'Already have an account? Sign in here' : 'New here? Create a free account'}</button>}
      </form>
      <p className={styles.small}>We review each request. No payment is taken.</p>
    </div>}
    {!embedded && user?.email_confirmed_at && <section className={styles.card}><h2>Your Listing Requests</h2>
      {loading && <p role="status">Loading your requests…</p>}
      {listError && <p role="alert" className={styles.error}>{listError}</p>}
      <button className="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh Requests</button>
      {!loading && !listError && !visibleRequests.length && <p>You haven’t requested a listing yet.</p>}
      <ul className={styles.list}>{visibleRequests.map(request => <li key={request.id}><strong>{request.name}</strong> · {request.city} <span className={styles.status}>{request.status}</span>{request.review_note && <p>{request.review_note}</p>}{request.place_slug && <p><Link to={`/place/${request.place_slug}`}>View Listing</Link> · <Link to={claimPath(request.place_slug)}>Own or manage this place? Start Your Claim</Link></p>}</li>)}</ul>
    </section>}
  </Root>;
}

RequestPlace.propTypes = { embedded: PropTypes.bool };
