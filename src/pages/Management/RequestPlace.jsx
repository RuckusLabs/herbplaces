import { useEffect, useState } from 'react';
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
  const Heading = embedded ? 'h2' : 'h1';
  const { user, loading: authLoading, signUp, signIn } = useAuth();
  const [accountMode, setAccountMode] = useState('signup');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(false);
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
      setNotice('Your listing request is saved. Our team will review it. Follow its status below; no subscription or management access has been started.');
      try { localStorage.removeItem(confirmationDraftKey); } catch { /* Optional cross-tab recovery. */ }
      setConfirmation(false); setDraft(empty()); setAttempt(value => value + 1);
    } catch (failure) { setError(failure.message || 'We couldn’t send your request. Your details are still here.'); }
    finally { setBusy(false); }
  };
  return <Root id={embedded ? undefined : "main-content"} className={embedded ? undefined : styles.page}>
    {!embedded && <Helmet><title>Request a Listing | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>}
    <Heading>{embedded ? "Tell Us About Your Place." : "Make Room for Your Little Place."}</Heading>
    <p className={styles.intro}>Can’t find a place in the directory? Suggest an independent herb shop, herbalist, garden, or workshop space. Our team reviews each request before adding a listing.</p>
    <p><Link to={embedded ? `/the-little-garden/start?plan=${plan}` : "/the-little-garden/start"}>Search existing listings first</Link> to avoid a duplicate. Requesting a listing is free. Owners can claim it after it has been added.</p>
    {!embedded && <section className={styles.card} aria-labelledby="request-next-title"><h2 id="request-next-title">What Happens Next?</h2><ol><li>We review your suggestion and add a listing or link an existing one. Check Your Listing Requests below for the decision.</li><li>If you own or manage the place, open the approved listing and choose Claim This Place. We review ownership separately; a listing request does not grant editing access.</li><li>After your claim is approved, open My Places. When Bloom purchases are available, your billing contact can subscribe to enable editing for the place’s approved managers.</li></ol><p>Just recommending a favorite place? Your request is all you need to send. <Link to="/the-little-garden/bloom">Learn about Bloom for business owners</Link>.</p></section>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.card}><h2>Place Details</h2>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.listingFields} disabled={busy}><div className={styles.formRow}>
          <label>Place name<input required minLength={2} maxLength={200} value={draft.name} onChange={update('name')} /></label>
          <label>Website (optional)<input type="url" pattern="https?://.+" title="Start the website address with https:// or http://." maxLength={2000} value={draft.website} onChange={update('website')} /></label>
          <label>City<input required maxLength={200} value={draft.city} onChange={update('city')} /></label>
          <label>State or region<input maxLength={200} value={draft.region} onChange={update('region')} /></label>
        </div><label>Anything we should know? (optional)<textarea value={draft.notes} onChange={update('notes')} maxLength={2000} /></label></fieldset>
        <p className={styles.small}>These details go to our review team. Please don’t include passwords, payment information, or sensitive personal details.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {!user && !confirmation && <fieldset className={styles.listingFields} disabled={busy}><legend>{accountMode === 'signup' ? 'Create your free account' : 'Sign in to your account'}</legend>
          <p className={styles.small}>Your account keeps your request and its review status in one place. No subscription starts with this request.</p>
          <div className={styles.formRow}><label>Account email<input type="email" autoComplete="email" value={accountEmail} onChange={event => setAccountEmail(event.target.value)} required maxLength={254} /></label><label>{accountMode === 'signup' ? 'Create a password' : 'Password'}<input type="password" autoComplete={accountMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={6} /></label></div>
          {accountMode === 'signup' && <label className={styles.check}><input type="checkbox" required /> <span>I agree to the <Link to="/membership-terms">membership terms</Link> and have read the <Link to="/privacy">privacy policy</Link>.</span></label>}
          <button className={styles.sortButton} type="button" onClick={() => { setAccountMode(accountMode === 'signup' ? 'signin' : 'signup'); setError(''); }}>{accountMode === 'signup' ? 'Already have an account? Sign in here' : 'New here? Create a free account'}</button>
        </fieldset>}
        {confirmation && !user && <div className={styles.notice}><p>Your listing details are saved in this browser for up to 24 hours. Confirm your email, then return here to review and send your request.</p><button type="button" className={styles.sortButton} onClick={() => { setConfirmation(false); setAccountMode('signin'); setNotice(''); }}>I Have an Account — Sign In Here</button><Link to={`/auth/resend-confirmation?next=${destination}`}>Send Another Confirmation Email</Link></div>}
        {authLoading ? <p role="status">Checking your account…</p> : user && !user.email_confirmed_at ? <><p>Confirm your account email before sending your request.</p><Link className="button" to={`/auth/resend-confirmation?next=${destination}`}>Send Confirmation Email</Link></>
          : !confirmation || user ? <button className="button" disabled={busy}>{busy ? 'Please Wait…' : user ? 'Send Listing Request' : accountMode === 'signup' ? 'Create Account & Send Listing Request' : 'Sign In & Send Listing Request'}</button> : null}

      </form>
    </section>
    {embedded && <p className={styles.small}>Our team will review your listing request. Once the listing is added, return here to open it and start your ownership claim. Listing approval and ownership approval are separate; no payment is taken with this request.</p>}
    {user?.email_confirmed_at && <section className={styles.card}><h2>Your Listing Requests</h2>
      {loading && <p role="status">Loading your requests…</p>}
      {listError && <p role="alert" className={styles.error}>{listError}</p>}
      <button className="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh Requests</button>
      {!loading && !listError && !visibleRequests.length && <p>You haven’t requested a listing yet.</p>}
      <ul className={styles.list}>{visibleRequests.map(request => <li key={request.id}><strong>{request.name}</strong> · {request.city} <span className={styles.status}>{request.status}</span>{request.review_note && <p>{request.review_note}</p>}{request.place_slug && <p><Link to={`/place/${request.place_slug}`}>View Listing</Link> · <Link to={claimPath(request.place_slug)}>Own or manage this place? Start Your Claim</Link></p>}</li>)}</ul>
    </section>}
  </Root>;
}

RequestPlace.propTypes = { embedded: PropTypes.bool };
