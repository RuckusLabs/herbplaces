import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/Icons/Icon';
import { useManagement } from '../../contexts/ManagementContext';
import { getWebsiteUrl } from '../../utilities/placeDetails';
import { managementRpc } from '../../utilities/managementApi';
import ListingRequestCards from '../../components/PlaceManagement/ListingRequestCards';
import styles from '../../components/PlaceManagement/management.module.scss';

const storageKey = 'little-herb-listing-request';
const confirmationDraftKey = 'little-herb-listing-request-confirmation';
const empty = () => ({ name: '', address: '', zip: '', website: '', city: '', region: '', notes: '', requestId: crypto.randomUUID() });
function readDraft() {
  const candidates = [];
  for (const storage of ['sessionStorage', 'localStorage']) {
    try {
      const saved = JSON.parse(window[storage].getItem(storage === 'sessionStorage' ? storageKey : confirmationDraftKey));
      if (saved && saved.savedAt <= Date.now() && saved.savedAt > Date.now() - 86400000 && typeof saved.requestId === 'string'
        && ['name', 'website', 'city', 'region', 'notes'].every(key => typeof saved[key] === 'string')) candidates.push({ ...saved, address: typeof saved.address === 'string' ? saved.address : '', zip: typeof saved.zip === 'string' ? saved.zip : '' });
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
  const management = useManagement();
  const [accountMode, setAccountMode] = useState('signup');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [stage, setStage] = useState('details');
  const [submittedName, setSubmittedName] = useState('');
  const heading = useRef(null);
  const requestsHeading = useRef(null);
  const FormHeading = !embedded && user?.email_confirmed_at ? 'h2' : 'h1';
  useLayoutEffect(() => {
    if (!embedded && user?.email_confirmed_at) requestsHeading.current?.focus({ preventScroll: !submittedName });
    else heading.current?.focus({ preventScroll: true });
  }, [stage, confirmation, submittedName, embedded, user?.id, user?.email_confirmed_at]);
  const [draft, setDraft] = useState(readDraft);
  const { requests: visibleRequests, loading, error: listError, refresh: refreshRequests } = management.listingRequests;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() })); } catch { /* Optional draft recovery. */ }
  }, [draft]);
  const update = field => event => { const value = event.target.value; setDraft(previous => ({ ...previous, [field]: value })); };
  const submit = async event => {
    event.preventDefault();
    if (busy || authLoading) return;
    const website = draft.website.trim() ? getWebsiteUrl(draft.website) : '';
    if (draft.website.trim() && !website) { setError('Enter a website such as yourplace.com, or leave it blank.'); return; }
    if (website.length > 2000) { setError('Please use a shorter website address.'); return; }
    if (stage === 'details' && !user) { setDraft(previous => ({ ...previous, website })); setError(''); setStage('account'); return; }
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
      await managementRpc('request_place_listing', { p_name: draft.name.trim(), p_website: website, p_city: draft.city.trim(), p_region: draft.region.trim(), p_notes: draft.notes.trim(), p_address: draft.address.trim(), p_zip: draft.zip.trim(), p_request_id: draft.requestId });
      setNotice('Your listing request is saved. Our team will review it.');
      setSubmittedName(draft.name.trim());
      try { localStorage.removeItem(confirmationDraftKey); } catch { /* Optional cross-tab recovery. */ }
      setConfirmation(false); setStage('details'); setDraft(empty()); refreshRequests();
    } catch (failure) { setError(failure.message || 'We couldn’t send your request. Your details are still here.'); }
    finally { setBusy(false); }
  };
  const summary = <div className={styles.requestSummary}><div><strong>{draft.name}</strong><span>{[draft.address, draft.city, draft.region, draft.zip].filter(Boolean).join(', ')}</span></div>{!confirmation && <button type="button" disabled={busy} onClick={() => { setStage('details'); setError(''); }}>Edit</button>}</div>;
  return <Root id={embedded ? undefined : 'main-content'} className={embedded ? styles.simpleRequest : `${styles.page} ${styles.simpleRequest}`}>
    {!embedded && <Helmet><title>Request a Listing | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>}
    {!embedded && user?.email_confirmed_at && <section id="listing-requests" className={styles.requestDashboard} aria-labelledby="listing-requests-title">
      <div className={styles.requestDashboardHeading}><div><h1 id="listing-requests-title" ref={requestsHeading} tabIndex={-1}>Your Listing Requests</h1><p>See where things stand and take the next step.</p></div><a href="#new-listing" className={styles.newRequestLink}>Request Another Place <Icon name="arrow" size={16} /></a></div>
      <div className={styles.requestRefresh}><button type="button" disabled={loading} onClick={refreshRequests}>Refresh Requests</button>{loading && <span role="status">Updating…</span>}</div>
      {listError && <p role="alert" className={styles.error}>{listError}</p>}
      {!loading && !listError && !visibleRequests.length && <p className={styles.requestEmpty}>No listing requests yet. Add your first place below.</p>}
      <ListingRequestCards requests={visibleRequests} management={management} claimPath={claimPath} updatePath="#new-listing" headingLevel="h2" />
    </section>}
    {embedded && submittedName ? <div className={styles.flowCard}>
      <h1 ref={heading} tabIndex={-1}>Thanks — we’ve got it.</h1><p role="status" className={styles.notice}>{notice}</p><p>We’ll review {submittedName}. Once the listing is ready, you can submit an ownership claim.</p><Link className="button" to="/request-place">View Request Status</Link>
    </div> : confirmation && !user ? <div className={styles.flowCard}>
      <h1 ref={heading} tabIndex={-1}>Check your inbox.</h1><p role="status">Confirm your email, then return here to send your request. Your request has not been sent.</p>{summary}<p className={styles.small}>Your place details are saved in this browser for 24 hours.</p><button type="button" className="button" onClick={() => { setConfirmation(false); setStage('account'); setAccountMode('signin'); setNotice(''); }}>Sign In to Continue</button><p><Link to={`/auth/resend-confirmation?next=${destination}`}>Send Another Confirmation Email</Link></p>
    </div> : <div id="new-listing" className={styles.flowCard}>
      <p className={styles.small}>{stage === 'account' ? '2 of 2 · Your account' : user ? 'Your place' : '1 of 2 · Your place'}</p>
      <FormHeading ref={heading} tabIndex={-1}>{stage === 'account' ? user ? 'Ready to send?' : accountMode === 'signup' ? 'Finish with your account.' : 'Welcome back.' : 'Add your place.'}</FormHeading>
      <p>{stage === 'account' ? 'Keep your request and its status in one place.' : 'Start with the basics. Requesting a listing is free.'}</p>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <form className={styles.form} onSubmit={submit}>
        {stage === 'details' ? <fieldset className={styles.flowFields} disabled={busy}>
          <label>Place name<input required minLength={2} maxLength={200} value={draft.name} onChange={update('name')} autoComplete="organization" /></label>
          <label>Street address (optional)<input maxLength={500} value={draft.address} onChange={update('address')} autoComplete="street-address" placeholder="Business location" /></label>
          <div className={styles.formRow}><label>City<input required maxLength={200} value={draft.city} onChange={update('city')} autoComplete="address-level2" /></label><label>State or region<input maxLength={200} value={draft.region} onChange={update('region')} autoComplete="address-level1" /></label></div>
          <details className={styles.optionalDetails}><summary>More details (optional)</summary><div className={styles.optionalFields}><label>Postal code (optional)<input maxLength={100} value={draft.zip} onChange={update('zip')} autoComplete="postal-code" /></label><label>Website (optional)<input type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="yourplace.com" maxLength={2000} value={draft.website} onChange={update('website')} /></label><label>Anything we should know? (optional)<textarea value={draft.notes} onChange={update('notes')} maxLength={2000} /></label><p className={styles.small}>Please leave out passwords, payment details, and sensitive information.</p></div></details>
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

  </Root>;
}

RequestPlace.propTypes = { embedded: PropTypes.bool };
