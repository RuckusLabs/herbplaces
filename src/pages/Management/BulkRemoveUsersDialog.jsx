import { useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { removeManagementUser } from '../../utilities/managementApi';
import styles from '../../components/PlaceManagement/management.module.scss';
import adminStyles from './admin.module.scss';

export default function BulkRemoveUsersDialog({ accounts, onClose, onRemoved }) {
  const titleId = useId();
  const [confirmation, setConfirmation] = useState('');
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const inFlight = useRef(false);
  const phrase = `REMOVE ${accounts.length} ${accounts.length === 1 ? 'USER' : 'USERS'}`;
  const removedCount = accounts.filter(account => results[account.user_id]?.removed).length;
  const attempted = Object.keys(results).length > 0;
  const complete = removedCount === accounts.length;
  const remove = async event => {
    event.preventDefault();
    if (inFlight.current || confirmation.trim() !== phrase || complete) return;
    inFlight.current = true; setBusy(true);
    const remaining = accounts.filter(account => !results[account.user_id]?.removed);
    const removed = [];
    try {
      for (const [index, account] of remaining.entries()) {
        setProgress(`Removing ${index + 1} of ${remaining.length}: ${account.email}`);
        try {
          const response = await removeManagementUser(account.user_id, account.email);
          if (!response?.removed) throw new Error('Removal could not be confirmed. Retry to check and finish cleanup.');
          removed.push(account.user_id);
          setResults(previous => ({ ...previous, [account.user_id]: { removed: true } }));
        } catch (error) {
          setResults(previous => ({ ...previous, [account.user_id]: { error: error.message || 'Unable to remove this account. Please retry.' } }));
        }
      }
      if (removed.length) onRemoved(removed, removedCount + removed.length);
    } finally { inFlight.current = false; setBusy(false); setProgress(''); }
  };
  return <Modal open onClose={() => { if (!busy) onClose(attempted); }} labelledBy={titleId} closeLabel="Close bulk user removal" className={styles.adminDialog} contentClassName={`${styles.editorBody} ${styles.adminBody}`}>
    <h2 id={titleId} className={styles.editorHeading}>Remove {accounts.length} {accounts.length === 1 ? 'User' : 'Users'}</h2>
    <p>This permanently deletes these sign-in accounts, their saved places, and their access to business listings. Published places and photos stay live.</p>
    <p className={styles.notice}>Administrators, your own account, and billing contacts cannot be selected. Access and billing protections are checked again for each removal.</p>
    <ul className={adminStyles.bulkAccounts}>{accounts.map(account => <li key={account.user_id}><div><strong>{account.email}</strong><p>{account.places?.length ? `Place access: ${account.places.map(place => place.name).join(', ')}` : 'No assigned places'}</p></div>{results[account.user_id]?.removed ? <span className={styles.status}>Removed</span> : results[account.user_id]?.error ? <p className={styles.error} role="alert">{results[account.user_id].error}</p> : <span className={styles.small}>Awaiting removal</span>}</li>)}</ul>
    {attempted && <p role="status">{removedCount} of {accounts.length} users removed.{!complete && !busy && ' Some accounts could not be removed. Retry only those accounts, or close to review them later.'}</p>}
    <form className={styles.form} onSubmit={remove}>
      {!complete && <label>Type {phrase} to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy} /></label>}
      {busy && <p role="status">{progress} Keep this dialog open until removal finishes.</p>}
      <div className={styles.actions}>{!complete && <button className={`button ${styles.danger}`} disabled={busy || confirmation.trim() !== phrase}>{busy ? 'Removing Users…' : attempted ? 'Retry Failed Removals' : 'Permanently Remove Selected Users'}</button>}<button type="button" className="button" disabled={busy} onClick={() => onClose(attempted)}>{complete ? 'Done' : attempted ? 'Close' : 'Cancel'}</button></div>
    </form>
  </Modal>;
}
BulkRemoveUsersDialog.propTypes = { accounts: PropTypes.arrayOf(PropTypes.object).isRequired, onClose: PropTypes.func.isRequired, onRemoved: PropTypes.func.isRequired };
