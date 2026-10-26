import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { placeDeletionAction } from '../../utilities/managementApi';
import { removePublishedPlace } from '../../utilities/placesStore';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function DeletePlaceDialog({ placeId, onClose }) {
  const titleId = useId();
  const [plan, setPlan] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [removed, setRemoved] = useState(false);
  const [contentRemoved, setContentRemoved] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true; setError('');
    placeDeletionAction('preview', placeId).then(value => { if (active) { setPlan(value); setContentRemoved(!!value.cleanup_pending); } }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [placeId, attempt]);
  const remove = async event => {
    event.preventDefault();
    if (!plan || plan.billing_blocked || confirmation !== plan.slug || inFlight.current) return;
    setBusy(true); inFlight.current = true; setError('');
    try {
      const result = await placeDeletionAction('delete', placeId, confirmation);
      if (result.content_removed) { setContentRemoved(true); removePublishedPlace(placeId); }
      if (result.removed) setRemoved(true);
      else throw new Error(result.error || 'Image cleanup needs retrying.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); inFlight.current = false; }
  };
  return <Modal open labelledBy={titleId} closeLabel="Close place deletion" onClose={() => { if (!busy) onClose(contentRemoved); }} className={styles.adminDialog} contentClassName={`${styles.editorBody} ${styles.adminBody}`}>
    <h2 id={titleId} className={styles.editorHeading}>{removed ? 'Place deleted.' : contentRemoved ? 'Finish image cleanup' : 'Delete place permanently'}</h2>
    {removed ? <><p>The listing, associated database content, and its exclusively used stored images have been removed.</p><button className="button" onClick={() => onClose(true)}>Done</button></> : <>
      {!plan ? error ? <><p role="alert" className={styles.error}>{error}</p><button className="button" onClick={() => setAttempt(value => value + 1)}>Retry Deletion Review</button></> : <p role="status">Checking this place and its images…</p> : <>
        <p><strong>{plan.name}</strong></p>
        <p>{contentRemoved ? 'The listing and its database content are already deleted. Finish removing its stored images.' : 'This permanently removes the listing, descriptions, photo history, stored images, manager access, claims, linked listing requests, and saved-place references. This cannot be undone here.'}</p>
        <p className={styles.notice}>{plan.image_count} stored {plan.image_count === 1 ? 'image' : 'images'} · {plan.managers} {plan.managers === 1 ? 'manager' : 'managers'} · {plan.revisions} previous {plan.revisions === 1 ? 'version' : 'versions'}</p>
        {plan.shared_images > 0 && <p>Images also used by another place will be retained for that place.</p>}
        {plan.billing_blocked && <p role="alert" className={styles.error}>Resolve this place’s subscription in Stripe, then refresh before deleting. Deletion does not cancel billing.</p>}
        <form className={styles.form} onSubmit={remove}>
          <label>Type {plan.slug} to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy || plan.billing_blocked} autoComplete="off" spellCheck={false} /></label>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {busy && <p role="status">Removing this place and its stored images…</p>}
          <div className={styles.actions}><button className={`button ${styles.danger}`} disabled={busy || plan.billing_blocked || confirmation !== plan.slug}>{busy ? 'Deleting…' : contentRemoved ? 'Retry Image Cleanup' : 'Permanently Delete Place'}</button><button className="button" type="button" disabled={busy} onClick={() => onClose(contentRemoved)}>{contentRemoved ? 'Close' : 'Cancel'}</button></div>
        </form>
      </>}
    </>}
  </Modal>;
}
DeletePlaceDialog.propTypes = { placeId: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired };
