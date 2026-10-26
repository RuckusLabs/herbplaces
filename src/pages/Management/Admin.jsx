import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { managementRpc } from '../../utilities/managementApi';
import AdminPlaceDetail from './AdminPlaceDetail';
import PlaceEditor from '../../components/PlaceManagement/PlaceEditor';
import RemoveUserDialog from './RemoveUserDialog';
import DeletePlaceDialog from './DeletePlaceDialog';
import BulkRemoveUsersDialog from './BulkRemoveUsersDialog';
import { refreshPlaces } from '../../utilities/placesStore';
import styles from '../../components/PlaceManagement/management.module.scss';
import adminStyles from './admin.module.scss';
import Icon from '../../components/Icons/Icon';
import usePlaces from '../../hooks/usePlaces';

const sections = [['claims', 'Claim Requests'], ['listing-requests', 'Listing Requests'], ['places', 'Places'], ['users', 'Users'], ['locations', 'Location Review']];
const sectionDetails = {
  claims: ['badge', 'Verify each person’s connection to a place before granting management access.', 'No claims to review', 'New ownership claims will appear here.'],
  'listing-requests': ['sprout', 'Check for an existing place, then create or link a listing. Ownership is reviewed separately.', 'No listing requests to review', 'New suggestions for the directory will appear here.'],
  places: ['shop', 'Find a listing to edit its content, manage access, or review its history.', 'No places found', 'Try a different search or add a place to the directory.'],
  users: ['group', 'See account status, assigned places, and billing responsibilities.', 'No accounts found', 'Try searching with a different email address.'],
  locations: ['nearby', 'Resolve addresses that need attention so places appear in the right spot on the map.', 'No locations to review', 'Places that need location attention will appear here.'],
};

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const management = useManagement();
  const [params, setParams] = useSearchParams();
  const section = sections.some(([id]) => id === params.get('section')) ? params.get('section') : 'claims';
  const search = (params.get('q') || '').slice(0, 200);
  const page = /^\d{1,6}$/.test(params.get('page') || '') ? Math.max(0, Number(params.get('page')) - 1) : 0;
  const [query, setQuery] = useState(search);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('lhp-admin-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed(previous => {
    const next = !previous;
    try { localStorage.setItem('lhp-admin-sidebar-collapsed', String(next)); } catch { /* The current view still works without storage. */ }
    return next;
  });
  const updateLocation = changes => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, String(value)); else next.delete(key); }
    return next;
  });
  const setPage = value => updateLocation({ page: (typeof value === 'function' ? value(page) : value) + 1 });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState({});
  const [selected, setSelected] = useState('');
  const [attempt, setAttempt] = useState(0);
  const sortKeys = section === 'users' ? ['email', 'confirmed_at', 'place_count', 'created_at'] : section === 'claims' ? ['created_at'] : ['name', 'city', 'subscription_status', 'geocode_status'];
  const sortKey = sortKeys.includes(params.get('sort')) ? params.get('sort') : sortKeys[0];
  const descending = params.get('order') === 'desc';
  const [removing, setRemoving] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkRemoving, setBulkRemoving] = useState(null);
  useEffect(() => { setSelectedUsers([]); }, [section, search, page, sortKey, descending, attempt, user?.id]);
  useEffect(() => { setBulkRemoving(null); }, [user?.id, management.is_admin]);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPlace, setNewPlace] = useState(null);
  const [editingNew, setEditingNew] = useState(false);
  const [listingSlugs, setListingSlugs] = useState({});
  const [creationDraft, setCreationDraft] = useState(null);
  const [creationRequest, setCreationRequest] = useState(null);
  const [cleanupJobs, setCleanupJobs] = useState([]);
  const [cleanupError, setCleanupError] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState(null);
  const [attention, setAttention] = useState(null);
  const [attentionError, setAttentionError] = useState(false);
  useEffect(() => {
    if (!management.is_admin) { setAttention(null); return; }
    let active = true;
    const refresh = () => managementRpc('admin_attention_counts').then(counts => {
      if (active) { setAttention(counts); setAttentionError(false); }
    }).catch(() => { if (active) setAttentionError(true); });
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [management.is_admin, attempt]);
  useEffect(() => {
    if (!management.is_admin) { setCleanupJobs([]); return; }
    let active = true;
    managementRpc('admin_place_cleanup_jobs').then(jobs => { if (active) { setCleanupJobs(Array.isArray(jobs) ? jobs : []); setCleanupError(false); } }).catch(() => { if (active) setCleanupError(true); });
    return () => { active = false; };
  }, [management.is_admin, attempt]);
  const directory = usePlaces(management.is_admin && section === 'listing-requests');
  useEffect(() => { setQuery(search); }, [search]);
  useEffect(() => { setSelected(''); }, [section]);
  useEffect(() => {
    if (!management.is_admin) { setData({ items: [], total: 0 }); return; }
    let active = true;
    setLoading(true); setError('');
    managementRpc(section === 'listing-requests' ? 'admin_listing_requests' : 'admin_directory', section === 'listing-requests' ? { p_query: search, p_page: page } : { p_section: section, p_query: search, p_page: page, p_sort: sortKey, p_desc: descending }).then(result => {
      if (active) setData(result);
    }).catch(failure => { if (active) { setData({ items: [], total: 0 }); setError(failure.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [management.is_admin, section, search, page, attempt, sortKey, descending]);
  const review = async (claim, approve) => {
    if (!window.confirm(approve ? `Approve ${claim.email} to manage ${claim.name}? Confirm that you have verified their relationship to the business.` : `Reject this claim for ${claim.name}?`)) return;
    setBusy(true); setError('');
    try {
      await managementRpc('admin_review_claim', { p_claim_id: claim.id, p_approve: approve, p_note: notes[claim.id] || '' });
      setNotice(`${claim.name}: claim ${approve ? 'approved' : 'rejected'}.`);
      setAttempt(value => value + 1); await management.refresh(); await refreshPlaces();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const heading = (key, label) => <th scope="col" aria-sort={sortKey === key ? descending ? 'descending' : 'ascending' : 'none'}><button type="button" className={styles.sortButton} onClick={() => { updateLocation({ sort: key, order: sortKey === key && !descending ? 'desc' : '', page: '' }); }}>{label}<span aria-hidden="true">{sortKey === key ? descending ? '↓' : '↑' : '↕'}</span></button></th>;
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
  const eligibleUsers = section === 'users' ? data.items.filter(account => !removalReason(account)) : [];
  const chosenUsers = eligibleUsers.filter(account => selectedUsers.includes(account.user_id));
  const allUsersSelected = eligibleUsers.length > 0 && chosenUsers.length === eligibleUsers.length;
  const allowed = !!user && management.is_admin;
  return <main id="main-content" className={`${styles.page} ${adminStyles.page}`}>
    <Helmet><title>Admin | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>
    <header className={adminStyles.header}><div><p className={adminStyles.eyebrow}>Directory workspace</p><h1>Little Herb Places Admin</h1><p>Connect people to places. Keep the directory growing with care.</p></div>{allowed && <button className="button" onClick={() => { setCreationDraft(null); setCreationRequest(null); setCreating(true); }}><Icon name="sprout" size={24} />Add Place</button>}</header>
    {authLoading || (management.loading && !allowed) ? <p role="status">Checking admin access…</p>
      : !user ? <Link className="button" to={`/login?next=${encodeURIComponent(`/admin${params.size ? `?${params}` : ''}`)}`}>Sign In</Link>
      : !allowed ? <><p role="alert" className={styles.notice}>{management.error || 'This area is for Little Herb Places administrators.'}</p><Link className="button" to="/favorites">Saved Places</Link></>
      : <>
        <div className={`${adminStyles.workspace} ${sidebarCollapsed ? adminStyles.collapsed : ''}`}>
        <aside className={adminStyles.sidebar} aria-label="Admin sidebar">
        <button className={adminStyles.sidebarToggle} type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="admin-section-links" onClick={toggleSidebar}><Icon name={sidebarCollapsed ? 'sidebar-expand' : 'sidebar-collapse'} size={22} /><span>Collapse sidebar</span></button>
        <div id="admin-section-links" className={adminStyles.sections} role="group" aria-label="Admin sections">{sections.map(([id, label]) => <button key={id} aria-label={label} title={`${label}${attention?.[id] > 0 ? ` · ${attention[id]} awaiting review` : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => { if (section === id) return; setData({ items: [], total: 0 }); setLoading(true); setNotice(''); updateLocation({ section: id, q: '', page: '', sort: '', order: '' }); }}><Icon name={sectionDetails[id][0]} size={28} /><span className={adminStyles.sectionLabel}>{label}</span>{attention?.[id] > 0 && <span className={adminStyles.count} aria-hidden="true">{attention[id] > 99 ? '99+' : attention[id]}</span>}</button>)}{attentionError && <p className={styles.small} role="status">Review counts couldn’t refresh.</p>}</div>
        </aside>
        <section className={adminStyles.content} aria-label={sections.find(([id]) => id === section)[1]}>
        <div className={adminStyles.sectionHeading}><div><h2>{sections.find(([id]) => id === section)[1]}</h2><p>{sectionDetails[section][1]}</p></div><button className={styles.ownerTextButton} disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}>Refresh</button></div>
        <form className={`${styles.form} ${adminStyles.search}`} onSubmit={event => { event.preventDefault(); updateLocation({ q: query.trim(), page: '' }); setAttempt(value => value + 1); }}>
          <label>Search {section === 'users' ? 'by email' : section === 'claims' ? 'by place or email' : 'by place name'}<input type="search" value={query} maxLength={200} placeholder={section === 'users' ? 'Email address' : 'Find a place…'} onChange={event => setQuery(event.target.value)} /></label><div className={styles.actions}><button className="button" disabled={loading}>Search</button>{(search || query) && <button className={styles.ownerTextButton} type="button" disabled={loading} onClick={() => { setQuery(''); updateLocation({ q: '', page: '' }); }}>Clear Search</button>}</div>
        </form>
        {section === 'places' && cleanupError && <p role="alert" className={styles.error}>Image cleanup tasks couldn’t load. Refresh to try again.</p>}
        {section === 'places' && cleanupJobs.length > 0 && <aside className={styles.notice} aria-label="Unfinished image cleanup"><h3>Finish deleting stored images</h3><p>These listings are deleted. Their image cleanup needs another attempt.</p>{cleanupJobs.map(job => <div className={styles.member} key={job.id}><span>{job.slug}</span><button className="button" onClick={() => setCleanupTarget(String(job.id))}>Finish Image Cleanup</button></div>)}</aside>}
        {notice && <p role="status" className={styles.notice}>{notice}{newPlace && <> <Link to={`/place/${newPlace.urlSlug}`}>View {newPlace.name}</Link></>}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {loading ? <p role="status">Loading…</p> : error ? <button className="button" onClick={() => setAttempt(value => value + 1)}>Retry Loading Results</button> : <>
          <p className={adminStyles.resultCount} role="status">{data.total} {['claims', 'listing-requests'].includes(section) ? 'pending requests' : 'results'}{search && <> matching “{search}”</>}</p>
          {section === 'users' && <div className={adminStyles.bulkToolbar}><p>{chosenUsers.length} selected <span>· Selection applies to this page</span></p><div><button className={styles.ownerTextButton} disabled={!chosenUsers.length} onClick={() => setSelectedUsers([])}>Clear Selection</button><button className={`button ${styles.danger}`} disabled={!chosenUsers.length} onClick={() => setBulkRemoving(chosenUsers)}>Remove Selected ({chosenUsers.length})</button></div></div>}
          {section === 'listing-requests' ? data.items.map(request => <article className={styles.card} key={request.id}>
            <p className={adminStyles.requestType}><Icon name="sprout" size={22} />New listing · Awaiting review</p>
            <h2>{request.name}</h2><p>{[request.address, request.city, request.region, request.zip].filter(Boolean).join(', ')} · {request.email}</p>
            {request.website && <p>{request.website}</p>}<p style={{ whiteSpace: 'pre-line' }}>{request.notes}</p>
            <p className={styles.small}>Requested {new Date(request.created_at).toLocaleString()}. Check for an existing listing before creating another. Adding a listing does not approve ownership.</p>
            <div className={styles.form}>
              <label>Choose an existing place<select value={directory.places.some(place => place.urlSlug === listingSlugs[request.id]) ? listingSlugs[request.id] : ''} disabled={busy || directory.loading} onChange={event => { const value = event.target.value; setListingSlugs(previous => ({ ...previous, [request.id]: value })); }}><option value="">{directory.loading ? 'Loading places…' : 'Select a place to link'}</option>{directory.places.map(place => <option value={place.urlSlug} key={place.id}>{place.name}{place.city ? ` · ${place.city}` : ''}</option>)}</select></label>
              {directory.error && <p className={styles.error}>The place picker couldn’t load. <button className={styles.ownerTextButton} onClick={directory.retry}>Try Again</button></p>}
              <details><summary>Or enter a listing’s URL slug</summary><label>Existing listing URL slug<input value={listingSlugs[request.id] || ''} maxLength={200} placeholder="moss-apothecary" onChange={event => { const value = event.target.value; setListingSlugs(previous => ({ ...previous, [request.id]: value })); }} disabled={busy} /></label></details>
              <label>Review note (visible to requester)<textarea value={notes[request.id] || ''} maxLength={3000} onChange={event => { const value = event.target.value; setNotes(previous => ({ ...previous, [request.id]: value })); }} disabled={busy} /></label>
            </div>
            <div className={styles.actions}><button className="button" disabled={busy} onClick={() => { setCreationRequest(request.id); setCreationDraft({ name: request.name, website: request.website, address: request.address || '', zip: request.zip || '', city: request.city, state: request.region }); setCreating(true); }}>Create Listing</button><button className="button" disabled={busy || !listingSlugs[request.id]?.trim()} onClick={() => reviewListing(request, true)}>Link Listing & Notify</button><button className="button" disabled={busy || (notes[request.id] || '').trim().length < 10} onClick={() => reviewListing(request, false)}>Decline Request</button></div>
          </article>) : section === 'claims' ? data.items.map(claim => <article className={styles.card} key={claim.id}>
            <p className={adminStyles.requestType}><Icon name="badge" size={22} />Ownership claim · Awaiting review</p>
            <h2><Link to={`/place/${claim.urlSlug}`}>{claim.name}</Link></h2><p><strong>{claim.email}</strong> · {claim.relationship}</p><p style={{ whiteSpace: 'pre-line' }}>{claim.evidence}</p>
            <p className={styles.small}>Requested {new Date(claim.created_at).toLocaleString()}. Verify the business connection before approving.</p>
            <div className={styles.form}><label>Review note (visible to the requester)<textarea value={notes[claim.id] || ''} maxLength={3000} onChange={event => { const value = event.target.value; setNotes(previous => ({ ...previous, [claim.id]: value })); }} disabled={busy} /></label></div>
            <div className={styles.actions}><button className="button" disabled={busy} onClick={() => review(claim, true)}>Approve Claim</button><button className="button" disabled={busy} onClick={() => review(claim, false)}>Reject Claim</button><button className="button" onClick={() => setSelected(String(claim.place_id))}>Manage Place</button></div>
          </article>) : <div className={styles.tableWrap}><table aria-label={section === 'users' ? 'Users' : section === 'locations' ? 'Locations' : 'Places'}><thead><tr>{section === 'users' ? <>
            <th scope="col" className={adminStyles.selectionCell}><input type="checkbox" aria-label="Select eligible users on this page" checked={allUsersSelected} disabled={!eligibleUsers.length} ref={node => { if (node) node.indeterminate = chosenUsers.length > 0 && !allUsersSelected; }} onChange={event => setSelectedUsers(event.target.checked ? eligibleUsers.map(account => account.user_id) : [])} /></th>{heading('email', 'Email')}{heading('confirmed_at', 'Account status')}{heading('place_count', 'Places')}{heading('created_at', 'Joined')}<th scope="col">Actions</th>
          </> : <>{heading('name', 'Place')}{heading('city', 'City')}{heading('subscription_status', 'Subscription')}{heading('geocode_status', 'Location')}<th scope="col">Manage</th></>}</tr></thead><tbody>{data.items.map(item => section === 'users' ? <tr key={item.user_id}>
            <td className={adminStyles.selectionCell}><input type="checkbox" aria-label={`Select ${item.email}`} title={removalReason(item) || `Select ${item.email}`} disabled={!!removalReason(item)} checked={chosenUsers.some(account => account.user_id === item.user_id)} onChange={event => setSelectedUsers(previous => event.target.checked ? [...previous, item.user_id] : previous.filter(id => id !== item.user_id))} /></td>
            <td>{item.email}{item.is_admin && <small className={styles.status}>Admin</small>}</td><td>{item.confirmed_at ? 'Email confirmed' : 'Awaiting confirmation'}</td>
            <td>{item.places?.length ? <ul className={styles.placeLinks}>{item.places.map(place => <li key={place.id}><button onClick={() => setSelected(place.id)} title={`Manage ${place.name}`}>{place.name}</button><small>{place.pending ? 'Invitation pending' : 'Manager'}{place.is_billing_contact ? ' · Billing contact' : ''}</small></li>)}</ul> : 'No assigned places'}</td>
            <td>{new Date(item.created_at).toLocaleDateString()}</td><td><button className={`button ${styles.danger}`} disabled={!!removalReason(item)} onClick={() => setRemoving(item)}>Remove User</button>{removalReason(item) && <p className={styles.small}>{removalReason(item)}</p>}</td>
          </tr> : <tr key={item.id}><td><Link to={`/place/${item.urlSlug}`}>{item.name}</Link></td><td>{item.city}</td><td>{item.subscription_status || 'No subscription'}</td><td>{item.geocode_status}</td><td><button className="button" onClick={() => setSelected(item.id)}>Manage</button></td></tr>)}</tbody></table></div>}

          {!error && !data.items.length && <div className={adminStyles.empty}><Icon name={search ? 'search' : sectionDetails[section][0]} size={44} /><h3>{search ? 'No matching results' : sectionDetails[section][2]}</h3><p>{search ? 'Try a shorter search or clear it to see everything in this section.' : sectionDetails[section][3]}</p>{search && <button className="button" onClick={() => { setQuery(''); updateLocation({ q: '', page: '' }); }}>Show All Results</button>}{page > 0 && <button className="button" onClick={() => setPage(0)}>Return to First Page</button>}</div>}
          {(data.total > 25 || page > 0) && <nav className={adminStyles.pagination} aria-label="Admin results pages"><button className="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(data.total / 25))}</span><button className="button" disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
        </>}
        </section></div>
        {creating && <PlaceEditor onNotice={setNotice} initialContent={creationDraft} onClose={() => setCreating(false)} onPublished={(message, place) => { setNotice(`${message} URL slug: ${place.urlSlug}`); setNewPlace(place); setEditingNew(true); if (creationRequest) setListingSlugs(previous => ({ ...previous, [creationRequest]: place.urlSlug })); updateLocation({ section: section === 'listing-requests' ? section : 'places', q: '', page: '', sort: '', order: '' }); setQuery(''); setAttempt(value => value + 1); }} />}
        {editingNew && newPlace && <PlaceEditor onNotice={setNotice} key={newPlace.id} place={newPlace} onClose={() => setEditingNew(false)} onPublished={(message, place) => { setNotice(message); setNewPlace(place); setAttempt(value => value + 1); }} />}
        {removing && <RemoveUserDialog account={removing} onClose={() => setRemoving(null)} onRemoved={() => { setNotice(`${removing.email} was removed.`); setRemoving(null); setPage(0); setAttempt(value => value + 1); management.refresh(); refreshPlaces(); }} />}
        {bulkRemoving && <BulkRemoveUsersDialog accounts={bulkRemoving} onRemoved={(ids, totalRemoved) => { setSelectedUsers(previous => previous.filter(id => !ids.includes(id))); setData(previous => ({ ...previous, items: previous.items.filter(account => !ids.includes(account.user_id)), total: Math.max(0, previous.total - ids.length) })); setNotice(`${totalRemoved} ${totalRemoved === 1 ? 'user removed' : 'users removed'}.`); }} onClose={didAttempt => { setBulkRemoving(null); if (didAttempt) { setAttempt(value => value + 1); void management.refresh(); void refreshPlaces(); } }} />}
        {cleanupTarget && <DeletePlaceDialog placeId={cleanupTarget} onClose={wasRemoved => { setCleanupTarget(null); if (wasRemoved) { setAttempt(value => value + 1); void management.refresh(); void refreshPlaces(); } }} />}
        {selected && <AdminPlaceDetail key={selected} placeId={selected} onDeleted={() => { setSelected(''); setNotice('Place content removed. Any unfinished image cleanup is listed in Places.'); updateLocation({ section: 'places', q: '', page: '' }); setAttempt(value => value + 1); void management.refresh(); void refreshPlaces(); }} onClose={() => { setSelected(''); setAttempt(value => value + 1); }} />}
      </>}
  </main>;
}
