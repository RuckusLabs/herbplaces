import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import DeletePlaceDialog from './DeletePlaceDialog';
import AdminPilotControls from '../../components/BusinessTools/AdminPilotControls';
import Modal from '../../components/Modal/Modal';
import { useManagement } from '../../contexts/ManagementContext';
import { geocodePublishedPlace, managementAction, managementRpc } from '../../utilities/managementApi';
import { refreshPlaces, updatePublishedPlace } from '../../utilities/placesStore';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function AdminPlaceDetail({ placeId, onClose, onDeleted }) {
  const titleId = useId();
  const management = useManagement();
  const [detail, setDetail] = useState(null);
  const [settings, setSettings] = useState(null);
  const [emails, setEmails] = useState('');
  const [billing, setBilling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;
    managementRpc('admin_place_detail', { p_place_id: String(placeId) }).then(result => {
      if (!active) return;
      if (!result.place) throw new Error('Place not found.');
      setDetail(result); setSettings({ slug: result.place.urlSlug, verified: !!result.place.isVerified, featured: !!result.place.isFeatured,
        latitude: result.place.latitude ?? '', longitude: result.place.longitude ?? '' });
    }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [placeId, attempt]);
  const run = async (operation, message) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await operation(); setNotice(message); setAttempt(value => value + 1);
      await management.refresh(); await refreshPlaces();
    } catch (failure) { setError(failure.message || 'Unable to complete this change.'); setAttempt(value => value + 1); }
    finally { setBusy(false); }
  };
  const assign = event => {
    event.preventDefault();
    const values = [...new Set(emails.split(/[,;\n]+/).map(email => email.trim()).filter(Boolean))];
    if (!values.length || values.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setError('Enter valid email addresses separated by commas or new lines.'); return; }
    if (billing && values.length !== 1) { setError('Choose one person as the billing contact. Add other managers separately.'); return; }
    run(async () => {
      for (const email of values) await managementRpc('admin_assign_manager', { p_place_id: String(placeId), p_email: email, p_billing: billing });
      setEmails(''); setBilling(false);
    }, 'Manager access updated. Unregistered emails will activate after email confirmation.');
  };
  const saveSettings = event => {
    event.preventDefault();
    const latitude = settings.latitude === '' ? null : Number(settings.latitude);
    const longitude = settings.longitude === '' ? null : Number(settings.longitude);
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude)))) { setError('Enter a valid latitude and longitude together.'); return; }
    if (settings.slug !== detail.place.urlSlug && !window.confirm('Change this place’s public URL? Existing links to the old URL will stop working.')) return;
    run(() => managementRpc('admin_update_place_settings', { p_place_id: String(placeId), p_slug: settings.slug.trim(), p_verified: settings.verified,
      p_featured: settings.featured, p_latitude: latitude, p_longitude: longitude, p_expected_version: detail.place.content_version }), 'Place settings saved.');
  };
  const restore = () => {
    if (!window.confirm(`Restore the content shown from version ${revision.version}? This publishes immediately and preserves the current version in history.`)) return;
    run(async () => {
      const place = await managementRpc('admin_restore_place', { p_place_id: String(placeId), p_revision_id: revision.id, p_expected_version: detail.place.content_version });
      updatePublishedPlace(place); await geocodePublishedPlace(place); setRevision(null);
    }, 'Earlier content restored.');
  };
  if (deleting) return <DeletePlaceDialog placeId={String(placeId)} onClose={wasRemoved => { if (wasRemoved) onDeleted(); else setDeleting(false); }} />;
  return <Modal open onClose={() => { if (!busy) onClose(); }} labelledBy={titleId} closeLabel="Close place administration" className={styles.adminDialog} contentClassName={`${styles.editorBody} ${styles.adminBody}`}>
    <h2 id={titleId} className={styles.editorHeading}>{detail?.place.name || 'Manage Place'}</h2>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!detail ? error ? <button className="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry Loading Place</button> : <p role="status">Loading place details…</p> : <>
      <div className={styles.actions}><Link className="button" to={`/place/${detail.place.urlSlug}`} onClick={onClose}>View & Edit Place</Link><span className={styles.status}>{detail.subscription?.status || 'No subscription'}</span></div>
      <AdminPilotControls placeId={String(placeId)} onChanged={management.refresh} />
      <section className={styles.card}><h3>Managers</h3>
        {detail.members.map(member => <div className={styles.member} key={member.user_id}><span>{member.email}{member.is_billing_contact && <span className={styles.status}>Billing contact</span>}</span><div className={styles.actions}>
          {!member.is_billing_contact && <button className="button" disabled={busy} onClick={() => run(() => managementRpc('admin_assign_manager', { p_place_id: String(placeId), p_email: member.email, p_billing: true }), 'Billing contact changed.')}>Make Billing Contact</button>}
          <button className="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.email} from this place? This revokes their access immediately and does not cancel the subscription.`)) run(() => managementRpc('admin_remove_manager', { p_place_id: String(placeId), p_user_id: member.user_id }), 'Manager removed.'); }}>Remove</button>
        </div></div>)}
        {detail.invitations.map(invitation => <div className={styles.member} key={invitation.id}><span>{invitation.email}<span className={styles.status}>Awaiting verified account</span>{invitation.is_billing_contact && <span className={styles.status}>Pending billing contact</span>}</span><button className="button" disabled={busy} onClick={() => run(() => managementRpc('admin_remove_manager', { p_place_id: String(placeId), p_invitation_id: invitation.id }), 'Pending access removed.')}>Remove</button></div>)}
        {!detail.members.some(member => member.is_billing_contact) && <p className={styles.notice}>Assign a billing contact so this place can subscribe and manage payment.</p>}
        <form className={styles.form} onSubmit={assign}><label>Manager email addresses<textarea value={emails} onChange={event => setEmails(event.target.value)} placeholder="One or more emails, separated by commas or new lines" disabled={busy} required maxLength={5000} /></label><label className={styles.check}><input type="checkbox" checked={billing} onChange={event => setBilling(event.target.checked)} disabled={busy} />Make this person the billing contact</label><div className={styles.actions}><button className="button" disabled={busy}>Assign Access</button></div></form>
      </section>
      <section className={styles.card}><h3>Directory Settings</h3><form className={styles.form} onSubmit={saveSettings}>
        <label>Public URL slug<input value={settings.slug} onChange={event => setSettings(previous => ({ ...previous, slug: event.target.value }))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={busy} /></label>
        <label className={styles.check}><input type="checkbox" checked={settings.verified} onChange={event => setSettings(previous => ({ ...previous, verified: event.target.checked }))} disabled={busy} />Editorial Verified badge</label>
        <label className={styles.check}><input type="checkbox" checked={settings.featured} onChange={event => setSettings(previous => ({ ...previous, featured: event.target.checked }))} disabled={busy} />Featured place</label>
        <p className={styles.small}>Approved manager access also verifies ownership independently of subscription status. Editorial verification remains a separate team decision.</p>
        <div className={styles.formRow}><label>Latitude<input type="number" step="any" min="-85.051129" max="85.051129" value={settings.latitude} onChange={event => setSettings(previous => ({ ...previous, latitude: event.target.value }))} disabled={busy} /></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={settings.longitude} onChange={event => setSettings(previous => ({ ...previous, longitude: event.target.value }))} disabled={busy} /></label></div>
        <p className={styles.small}>Map status: {detail.place.geocode_status}. Enter both coordinates to confirm a location, or retry automatic lookup.</p>
        <div className={styles.actions}><button className="button" disabled={busy}>Save Settings</button>{detail.place.geocode_status !== 'confirmed' && <button className="button" type="button" disabled={busy} onClick={() => run(() => managementAction('geocode', placeId), 'Map lookup completed. Check the location status.')}>Retry Address Lookup</button>}</div>
      </form></section>
      <section className={styles.card}><h3>Content History</h3>{!detail.revisions.length ? <p>No previous versions yet.</p> : <ul className={styles.list}>{detail.revisions.map(item => <li key={item.id}>Version {item.version} · {new Date(item.created_at).toLocaleString()} <button className="button" disabled={busy} onClick={() => run(async () => setRevision(await managementRpc('admin_get_revision', { p_place_id: String(placeId), p_revision_id: item.id })), 'Revision loaded below.')}>Review</button></li>)}</ul>}
        {revision && <section className={styles.preview} aria-label="Revision content"><h3>Version {revision.version}: {revision.content.name}</h3><p>{revision.content.tagline}</p><p>{revision.content.description}</p><p>{[revision.content.address, revision.content.city, revision.content.state, revision.content.zip].filter(Boolean).join(', ')}</p><p>{revision.content.website}</p><p>{revision.content.phone}</p><p>{revision.content.hours}</p>{revision.content.social_links?.map((link, index) => <p key={index}>{link.label}: {link.url}</p>)}<p>Categories: {revision.content.category_ids?.join(', ') || 'Inferred from listing'}</p><div className={styles.photoGrid}>{revision.content.photos?.map(photo => <img key={photo} src={photo} alt={revision.content.photo_alt?.[photo] || 'Photo in this revision'} />)}</div><button className="button" disabled={busy} onClick={restore}>Restore This Version</button></section>}
      </section>
      <section className={styles.card}><h3>Recent Activity</h3><ul className={styles.list}>{detail.audit.map((event, index) => <li key={index}>{event.action.replaceAll('_', ' ')} · {new Date(event.created_at).toLocaleString()}{event.details?.email && <span> · {event.details.email}</span>}</li>)}</ul></section>
      <section className={styles.card}><h3>Permanent deletion</h3><p>Remove this place and its associated database content and stored images. Review the details before confirming.</p><button className={`button ${styles.danger}`} disabled={busy} onClick={() => setDeleting(true)}>Delete Place</button></section>
    </>}
  </Modal>;
}
AdminPlaceDetail.propTypes = { placeId: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired, onDeleted: PropTypes.func.isRequired };
