import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { removeManagementUser } from '../../utilities/managementApi';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function RemoveUserDialog({ account, onClose, onRemoved }) {
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await removeManagementUser(account.user_id, email.trim());
      onRemoved();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={() => { if (!busy) onClose(); }} labelledBy={titleId} closeLabel="Close user removal" className={`${styles.adminDialog} ${styles.adminRemovalDialog}`} contentClassName={`${styles.editorBody} ${styles.adminBody}`}>
    <h2 id={titleId} className={styles.editorHeading}>Remove User</h2>
    <p><strong>{account.email}</strong></p>
    <p>This permanently removes their sign-in account and access to places. Published places and photos stay live.</p>
    {account.places?.length > 0 && <><p>Place access being removed:</p><ul className={styles.list}>{account.places.map(place => <li key={place.id}>{place.name}{place.pending ? ' (invitation pending)' : ''}{place.is_billing_contact ? ' · Billing contact' : ''}</li>)}</ul></>}
    <form className={styles.form} onSubmit={remove}>
      <label>Type the user’s email to confirm<input type="email" value={email} autoComplete="off" maxLength={254} onChange={event => setEmail(event.target.value)} disabled={busy} required /></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button className={`button ${styles.danger}`} disabled={busy || email.trim().toLowerCase() !== account.email.toLowerCase()}>{busy ? 'Removing…' : 'Permanently Remove User'}</button><button className="button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </form>
  </Modal>;
}
RemoveUserDialog.propTypes = { account: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired, onRemoved: PropTypes.func.isRequired };
