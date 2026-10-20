import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { bloomAvailable, managementAction, openBillingUrl } from '../../utilities/managementApi';
import { getSubscriptionLabel, subscriptionAllowsEditing } from '../../../supabase/functions/_shared/entitlements.js';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function MyPlaces() {
  const { user } = useAuth();
  const management = useManagement();
  const refresh = management.refresh;
  const [params] = useSearchParams();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const synced = useRef('');
  const returnedPlace = params.get('billing') === 'returned' ? params.get('place') : '';
  useEffect(() => {
    if (!returnedPlace || !user || synced.current === returnedPlace) return;
    synced.current = returnedPlace;
    managementAction('sync-billing', returnedPlace).then(() => {
      setNotice('Billing status refreshed. Payment confirmation can take a moment.'); refresh();
    }).catch(failure => setError(failure.message));
  }, [returnedPlace, user, refresh]);
  const billing = async (action, placeId) => {
    setBusy(String(placeId)); setError(''); setNotice('');
    try {
      const response = await managementAction(action, placeId);
      if (response.url) openBillingUrl(response.url);
      else { await management.refresh(); setNotice('Billing status refreshed.'); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  };
  if (!user || (!management.memberships.length && !management.claims.some(claim => ['pending', 'approved'].includes(claim.status)))) return null;
  return <section id="my-places" aria-labelledby="my-places-title" className={styles.savedManagement}>
    <h2 id="my-places-title">My Places</h2><p className={styles.intro}>A little home for the places you care for. Manage your subscription here, then edit directly on your place page.</p>
      {management.is_admin && <Link className="button" to="/admin">Open Admin</Link>}
      {management.loading && <p role="status">Refreshing your places…</p>}
      {(management.error || error) && <p role="alert" className={styles.error}>{error || management.error}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.actions}><button className="button" disabled={management.loading} onClick={management.refresh}>Refresh Access</button></div>
      <div className={styles.grid}>{management.memberships.map(membership => {
        const subscription = membership.subscription;
        const canEdit = management.is_admin || subscriptionAllowsEditing(subscription);
        const activeBilling = subscription && !['none', 'canceled', 'incomplete_expired'].includes(subscription.status);
        return <article className={styles.card} key={membership.place_id}>
          <h3>{membership.place.name}</h3><span className={styles.status}>{getSubscriptionLabel(subscription)}</span>
          {membership.is_billing_contact && <span className={styles.status}>Billing contact</span>}
          {subscription?.grace_ends_at && <p className={styles.small}>Payment grace period ends {new Date(subscription.grace_ends_at).toLocaleString()}. Published content stays visible.</p>}
          {subscription?.cancel_at_period_end && subscription.paid_until && <p className={styles.small}>Editing remains available through {new Date(subscription.paid_until).toLocaleDateString()}.</p>}
          {!canEdit && <p>Your published listing stays visible. An active Bloom subscription enables editing and photo uploads for all assigned managers.</p>}
          <div className={styles.actions}><Link className="button" to={`/place/${membership.place.urlSlug}`}>{canEdit ? 'View & Edit Place' : 'View Place'}</Link>
            {membership.is_billing_contact && <>
              {!activeBilling && <button className="button" disabled={!!busy || !bloomAvailable} onClick={() => billing('checkout', membership.place_id)}>{busy === String(membership.place_id) ? 'Please Wait…' : bloomAvailable ? 'Subscribe to Bloom · $19/month' : 'Bloom Is Growing'}</button>}
              {subscription && subscription.status !== 'none' && <button className="button" disabled={!!busy} onClick={() => billing('portal', membership.place_id)}>Manage Billing</button>}
              <button className="button" disabled={!!busy} onClick={() => billing('sync-billing', membership.place_id)}>Refresh Billing Status</button>
            </>}
          </div>
          {!membership.is_billing_contact && <p className={styles.small}>Your designated billing contact manages payment. Contact Little Herb Places to change managers.</p>}
        </article>;
      })}</div>
      {!!management.claims.length && <section className={styles.card}><h3>Your Claim Requests</h3><ul className={styles.list}>{management.claims.map(claim => <li key={claim.id}><Link to={`/place/${claim.urlSlug}`}>{claim.name}</Link> <span className={styles.status}>{claim.status}</span>{claim.review_note && <p>{claim.review_note}</p>}</li>)}</ul></section>}
  </section>;
}
