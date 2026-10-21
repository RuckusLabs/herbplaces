import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { managementRpc } from '../../utilities/managementApi';
import AdminPlaceDetail from './AdminPlaceDetail';
import PlaceEditor from '../../components/PlaceManagement/PlaceEditor';
import RemoveUserDialog from './RemoveUserDialog';
import { refreshPlaces } from '../../utilities/placesStore';
import styles from '../../components/PlaceManagement/management.module.scss';

const sections = [['claims', 'Claim Requests'], ['listing-requests', 'Listing Requests'], ['places', 'Places'], ['users', 'Users'], ['locations', 'Location Review']];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const management = useManagement();
  const [section, setSection] = useState('claims');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState({});
  const [selected, setSelected] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState({ key: 'created_at', desc: false });
  const [removing, setRemoving] = useState(null);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPlace, setNewPlace] = useState(null);
  const [editingNew, setEditingNew] = useState(false);
  const [listingSlugs, setListingSlugs] = useState({});
  const [creationDraft, setCreationDraft] = useState(null);
  const [creationRequest, setCreationRequest] = useState(null);
  useEffect(() => {
    if (!management.is_admin) { setData({ items: [], total: 0 }); return; }
    let active = true;
    setLoading(true); setError('');
    managementRpc(section === 'listing-requests' ? 'admin_listing_requests' : 'admin_directory', section === 'listing-requests' ? { p_query: search, p_page: page } : { p_section: section, p_query: search, p_page: page, p_sort: sort.key, p_desc: sort.desc }).then(result => {
      if (active) setData(result);
    }).catch(failure => { if (active) { setData({ items: [], total: 0 }); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [management.is_admin, section, search, page, attempt, sort]);
  const review = async (claim, approve) => {
    if (!window.confirm(approve ? `Approve ${claim.email} to manage ${claim.name}? Confirm that you have verified their relationship to the business.` : `Reject this claim for ${claim.name}?`)) return;
    setBusy(true); setError('');
    try {
      await managementRpc('admin_review_claim', { p_claim_id: claim.id, p_approve: approve, p_note: notes[claim.id] || '' });
      setAttempt(value => value + 1); await management.refresh(); await refreshPlaces();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const heading = (key, label) => <th scope="col" aria-sort={sort.key === key ? sort.desc ? 'descending' : 'ascending' : 'none'}><button type="button" className={styles.sortButton} onClick={() => { setSort({ key, desc: sort.key === key ? !sort.desc : false }); setPage(0); }}>{label}<span aria-hidden="true">{sort.key === key ? sort.desc ? '↓' : '↑' : '↕'}</span></button></th>;
  const reviewListing = async (request, listed) => {
    if (!window.confirm(listed ? 'Link this request to the listing? The requester must still claim it to gain management access.' : 'Decline this listing request and send the review note to the requester?')) return;
    setBusy(true); setError('');
    try {
      await managementRpc('admin_review_listing_request', { p_request_id: request.id, p_slug: listed ? listingSlugs[request.id] || '' : null, p_note: notes[request.id] || '' });
      setNotice('Listing request reviewed. The requester can see the decision in their listing requests.'); setAttempt(value => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const removalReason = account => account.user_id === user?.id ? 'Your account' : account.is_admin ? 'Administrator account'
    : account.billing_protected ? 'Reassign billing contact first' : account.removal_pending ? 'Removal in progress' : '';
  const allowed = !!user && management.is_admin;
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Admin | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>
    <h1>Little Herb Places Admin</h1>
    {authLoading || (management.loading && !allowed) ? <p role="status">Checking admin access…</p>
      : !user ? <Link className="button" to="/login?next=%2Fadmin">Sign In</Link>
      : !allowed ? <><p role="alert" className={styles.notice}>{management.error || 'This area is for Little Herb Places administrators.'}</p><Link className="button" to="/favorites">Saved Places</Link></>
      : <>
        <div className={styles.toolbar}><p className={styles.intro}>Review claims, connect people to places, and care for the directory.</p><button className="button" onClick={() => { setCreationDraft(null); setCreationRequest(null); setCreating(true); }}>Add Place</button></div>
        <div className={styles.tabs} role="group" aria-label="Admin sections">{sections.map(([id, label]) => <button className="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => { setData({ items: [], total: 0 }); setLoading(true); setSection(id); setPage(0); setSelected(''); setSort({ key: id === 'users' ? 'email' : id === 'claims' ? 'created_at' : 'name', desc: false }); }}>{label}</button>)}</div>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(0); setAttempt(value => value + 1); }}>
          <label>Search {section === 'users' ? 'by email' : section === 'claims' ? 'by place or email' : 'by place name'}<input type="search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></label><div className={styles.actions}><button className="button" disabled={loading}>Search</button><button className="button" type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh</button></div>
        </form>
        {notice && <p role="status" className={styles.notice}>{notice}{newPlace && <> <Link to={`/place/${newPlace.urlSlug}`}>View {newPlace.name}</Link></>}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {loading ? <p role="status">Loading…</p> : <>
          <p className={styles.small} role="status">{data.total} {['claims', 'listing-requests'].includes(section) ? 'pending requests' : 'results'}</p>
          {section === 'listing-requests' ? data.items.map(request => <article className={styles.card} key={request.id}>
            <h2>{request.name}</h2><p>{request.city}, {request.region} · {request.email}</p>
            {request.website && <p>{request.website}</p>}<p style={{ whiteSpace: 'pre-line' }}>{request.notes}</p>
            <p className={styles.small}>Requested {new Date(request.created_at).toLocaleString()}. Check for an existing listing before creating another. Adding a listing does not approve ownership.</p>
            <div className={styles.form}>
              <label>Existing listing URL slug<input value={listingSlugs[request.id] || ''} maxLength={200} placeholder="moss-apothecary" onChange={event => { const value = event.target.value; setListingSlugs(previous => ({ ...previous, [request.id]: value })); }} disabled={busy} /></label>
              <label>Review note (visible to requester)<textarea value={notes[request.id] || ''} maxLength={3000} onChange={event => { const value = event.target.value; setNotes(previous => ({ ...previous, [request.id]: value })); }} disabled={busy} /></label>
            </div>
            <div className={styles.actions}><button className="button" disabled={busy} onClick={() => { setCreationRequest(request.id); setCreationDraft({ name: request.name, website: request.website, city: request.city, state: request.region }); setCreating(true); }}>Create Listing</button><button className="button" disabled={busy || !listingSlugs[request.id]?.trim()} onClick={() => reviewListing(request, true)}>Link Listing & Notify</button><button className="button" disabled={busy || (notes[request.id] || '').trim().length < 10} onClick={() => reviewListing(request, false)}>Decline Request</button></div>
          </article>) : section === 'claims' ? data.items.map(claim => <article className={styles.card} key={claim.id}>
            <h2><Link to={`/place/${claim.urlSlug}`}>{claim.name}</Link></h2><p><strong>{claim.email}</strong> · {claim.relationship}</p><p style={{ whiteSpace: 'pre-line' }}>{claim.evidence}</p>
            <p className={styles.small}>Requested {new Date(claim.created_at).toLocaleString()}. Verify the business connection before approving.</p>
            <div className={styles.form}><label>Review note (visible to the requester)<textarea value={notes[claim.id] || ''} maxLength={3000} onChange={event => { const value = event.target.value; setNotes(previous => ({ ...previous, [claim.id]: value })); }} disabled={busy} /></label></div>
            <div className={styles.actions}><button className="button" disabled={busy} onClick={() => review(claim, true)}>Approve Claim</button><button className="button" disabled={busy} onClick={() => review(claim, false)}>Reject Claim</button><button className="button" onClick={() => setSelected(String(claim.place_id))}>Manage Place</button></div>
          </article>) : <div className={styles.tableWrap}><table aria-label={section === 'users' ? 'Users' : section === 'locations' ? 'Locations' : 'Places'}><thead><tr>{section === 'users' ? <>
            {heading('email', 'Email')}{heading('confirmed_at', 'Account status')}{heading('place_count', 'Places')}{heading('created_at', 'Joined')}<th scope="col">Actions</th>
          </> : <>{heading('name', 'Place')}{heading('city', 'City')}{heading('subscription_status', 'Subscription')}{heading('geocode_status', 'Location')}<th scope="col">Manage</th></>}</tr></thead><tbody>{data.items.map(item => section === 'users' ? <tr key={item.user_id}>
            <td>{item.email}{item.is_admin && <small className={styles.status}>Admin</small>}</td><td>{item.confirmed_at ? 'Email confirmed' : 'Awaiting confirmation'}</td>
            <td>{item.places?.length ? <ul className={styles.placeLinks}>{item.places.map(place => <li key={place.id}><button onClick={() => setSelected(place.id)} title={`Manage ${place.name}`}>{place.name}</button><small>{place.pending ? 'Invitation pending' : 'Manager'}{place.is_billing_contact ? ' · Billing contact' : ''}</small></li>)}</ul> : 'No assigned places'}</td>
            <td>{new Date(item.created_at).toLocaleDateString()}</td><td><button className={`button ${styles.danger}`} disabled={!!removalReason(item)} onClick={() => setRemoving(item)}>Remove User</button>{removalReason(item) && <p className={styles.small}>{removalReason(item)}</p>}</td>
          </tr> : <tr key={item.id}><td><Link to={`/place/${item.urlSlug}`}>{item.name}</Link></td><td>{item.city}</td><td>{item.subscription_status || 'No subscription'}</td><td>{item.geocode_status}</td><td><button className="button" onClick={() => setSelected(item.id)}>Manage</button></td></tr>)}</tbody></table></div>}

          {!data.items.length && <p>No results here yet.</p>}
          <div className={styles.actions}><button className="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1}</span><button className="button" disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div>
        </>}
        {creating && <PlaceEditor onNotice={setNotice} initialContent={creationDraft} onClose={() => setCreating(false)} onPublished={(message, place) => { setNotice(`${message} URL slug: ${place.urlSlug}`); setNewPlace(place); setEditingNew(true); if (creationRequest) setListingSlugs(previous => ({ ...previous, [creationRequest]: place.urlSlug })); if (section !== 'listing-requests') { setSection('places'); setSort({ key: 'name', desc: false }); } setSearch(''); setQuery(''); setPage(0); setAttempt(value => value + 1); }} />}
        {editingNew && newPlace && <PlaceEditor onNotice={setNotice} key={newPlace.id} place={newPlace} onClose={() => setEditingNew(false)} onPublished={(message, place) => { setNotice(message); setNewPlace(place); setAttempt(value => value + 1); }} />}
        {removing && <RemoveUserDialog account={removing} onClose={() => setRemoving(null)} onRemoved={() => { setNotice(`${removing.email} was removed.`); setRemoving(null); setPage(0); setAttempt(value => value + 1); management.refresh(); refreshPlaces(); }} />}
        {selected && <AdminPlaceDetail key={selected} placeId={selected} onClose={() => { setSelected(''); setAttempt(value => value + 1); }} />}
      </>}
  </main>;
}
