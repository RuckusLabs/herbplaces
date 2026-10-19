import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { managementRpc } from '../../utilities/managementApi';
import { subscriptionAllowsEditing } from '../../../supabase/functions/_shared/entitlements.js';
import PlaceEditor from './PlaceEditor';
import Modal from '../Modal/Modal';
import styles from './management.module.scss';

export default function PlaceManagement({ place, placement = 'top' }) {
  const { user } = useAuth();
  const management = useManagement();
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [relationship, setRelationship] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const membership = management.memberships.find(item => String(item.place_id) === String(place.id));
  const claim = management.claims.find(item => String(item.place_id) === String(place.id) && item.status === 'pending');
  const canEdit = management.is_admin || (membership && subscriptionAllowsEditing(membership.subscription));
  const hasAccess = canEdit || !!membership;
  const submitClaim = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await managementRpc('request_place_claim', { p_place_id: String(place.id), p_relationship: relationship.trim(), p_evidence: evidence.trim() });
      setClaiming(false); setNotice('Your request is with Little Herb Places. You can check its status in My Places.');
      await management.refresh();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  if ((placement === 'top') !== !!hasAccess) return null;
  return <>
    {canEdit ? <button className="button" onClick={() => setEditing(true)}>Edit Place</button>
      : membership ? <Link className="button" to="/my-places">Manage Subscription</Link>
      : claim ? <Link className="button" to="/my-places">Claim Pending</Link>
      : place.is_claimed !== false ? null
      : user ? <button className="button" disabled={management.loading} onClick={() => setClaiming(true)}>Claim This Place</button>
      : <Link className="button" to={`/login?next=${encodeURIComponent(`/place/${place.urlSlug}`)}`}>Claim This Place</Link>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {editing && <PlaceEditor place={place} onClose={() => setEditing(false)} onPublished={message => { setNotice(message); management.refresh(); }} />}
    {claiming && <Modal open onClose={() => { if (!busy) setClaiming(false); }} labelledBy={titleId} closeLabel="Close claim request">
      <h2 id={titleId}>Claim {place.name}</h2><p>Tell us how you’re connected to this place. Little Herb Places will review your request before you subscribe.</p>
      {management.error ? <><p role="alert" className={styles.error}>{management.error}</p><button className="button" onClick={management.refresh}>Try Again</button></> : <form className={styles.form} onSubmit={submitClaim}>
        <label>Your relationship to the business<input value={relationship} onChange={event => setRelationship(event.target.value)} required minLength={2} maxLength={200} placeholder="Owner, business manager…" disabled={busy} /></label>
        <label>Information to help us verify your request<textarea value={evidence} onChange={event => setEvidence(event.target.value)} required minLength={10} maxLength={3000} placeholder="A business website, your role, and a way to confirm it." disabled={busy} /></label>
        <p className={styles.small}>Once approved, Bloom is $19/month per place. Several approved managers can share the same place subscription.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}<button className="button" disabled={busy}>{busy ? 'Sending…' : 'Request Access'}</button>
      </form>}
    </Modal>}
  </>;
}
PlaceManagement.propTypes = { place: PropTypes.object.isRequired, placement: PropTypes.oneOf(['top', 'visit']) };
