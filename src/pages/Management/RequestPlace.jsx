import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import { managementRpc } from '../../utilities/managementApi';
import styles from '../../components/PlaceManagement/management.module.scss';

const storageKey = 'little-herb-listing-request';
const empty = () => ({ name: '', website: '', city: '', region: '', notes: '', requestId: crypto.randomUUID() });
function readDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved && saved.savedAt <= Date.now() && saved.savedAt > Date.now() - 86400000 && typeof saved.requestId === 'string') return { ...empty(), ...saved };
  } catch { /* The form also works without browser storage. */ }
  return empty();
}

export default function RequestPlace() {
  const { user, loading: authLoading } = useAuth();
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
    if (busy || !user?.email_confirmed_at) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await managementRpc('request_place_listing', { p_name: draft.name.trim(), p_website: draft.website.trim(), p_city: draft.city.trim(), p_region: draft.region.trim(), p_notes: draft.notes.trim(), p_request_id: draft.requestId });
      setNotice('Your listing request is saved. Our team will review it. Follow its status below; no subscription or management access has been started.');
      setDraft(empty()); setAttempt(value => value + 1);
    } catch (failure) { setError(failure.message || 'We couldn’t send your request. Your details are still here.'); }
    finally { setBusy(false); }
  };
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Request a Listing | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>
    <h1>Make Room for Your Little Place.</h1>
    <p className={styles.intro}>Can’t find a place in the directory? Suggest an independent herb shop, herbalist, garden, or workshop space. Our team reviews each request before adding a listing.</p>
    <p><Link to="/map">Check the directory first</Link> to avoid a duplicate. Requesting a listing is free. Owners can claim it after it has been added.</p>
    <section className={styles.card} aria-labelledby="request-next-title"><h2 id="request-next-title">What Happens Next?</h2><ol><li>We review your suggestion and add a listing or link an existing one. Check Your Listing Requests below for the decision.</li><li>If you own or manage the place, open the approved listing and choose Claim This Place. We review ownership separately; a listing request does not grant editing access.</li><li>After your claim is approved, open My Places. When Bloom purchases are available, your billing contact can subscribe to enable editing for the place’s approved managers.</li></ol><p>Just recommending a favorite place? Your request is all you need to send. <Link to="/the-little-garden/bloom">Learn about Bloom for business owners</Link>.</p></section>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.card}><h2>Place Details</h2>
      <form className={styles.form} onSubmit={submit}>
        <fieldset disabled={busy}><div className={styles.formRow}>
          <label>Place name<input required minLength={2} maxLength={200} value={draft.name} onChange={update('name')} /></label>
          <label>Website (optional)<input type="url" pattern="https?://.+" title="Start the website address with https:// or http://." maxLength={2000} value={draft.website} onChange={update('website')} /></label>
          <label>City<input required maxLength={200} value={draft.city} onChange={update('city')} /></label>
          <label>State or region<input maxLength={200} value={draft.region} onChange={update('region')} /></label>
        </div><label>Anything we should know? (optional)<textarea value={draft.notes} onChange={update('notes')} maxLength={2000} /></label></fieldset>
        <p className={styles.small}>These details go to our review team. Please don’t include passwords, payment information, or sensitive personal details.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {authLoading ? <p role="status">Checking your account…</p> : !user ? <><p>Your details stay in this tab while you sign in. Review and submit this form after returning.</p><Link className="button" to="/login?next=%2Frequest-place">Sign In to Request a Listing</Link></>
          : !user.email_confirmed_at ? <><p>Confirm your account email before sending your request.</p><Link className="button" to="/auth/resend-confirmation?next=%2Frequest-place">Send Confirmation Email</Link></>
          : <button className="button" disabled={busy}>{busy ? 'Sending…' : 'Send Listing Request'}</button>}
      </form>
    </section>
    {user?.email_confirmed_at && <section className={styles.card}><h2>Your Listing Requests</h2>
      {loading && <p role="status">Loading your requests…</p>}
      {listError && <p role="alert" className={styles.error}>{listError}</p>}
      <button className="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh Requests</button>
      {!loading && !listError && !visibleRequests.length && <p>You haven’t requested a listing yet.</p>}
      <ul className={styles.list}>{visibleRequests.map(request => <li key={request.id}><strong>{request.name}</strong> · {request.city} <span className={styles.status}>{request.status}</span>{request.review_note && <p>{request.review_note}</p>}{request.place_slug && <p><Link to={`/place/${request.place_slug}`}>View Listing</Link> · <Link to={`/place/${request.place_slug}?claim=1`}>Own or manage this place? Start Your Claim</Link></p>}</li>)}</ul>
    </section>}
  </main>;
}
