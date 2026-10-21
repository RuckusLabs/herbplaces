import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useManagement } from '../../contexts/ManagementContext';
import { subscriptionAllowsEditing } from '../../../supabase/functions/_shared/entitlements.js';
import PlaceEditor from './PlaceEditor';
import PlaceClaim from './PlaceClaim';
import styles from './management.module.scss';

export default function PlaceManagement({ place, placement = 'top' }) {
  const management = useManagement();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [claiming, setClaiming] = useState(placement === 'visit' && params.get('claim') === '1');
  const [notice, setNotice] = useState('');
  const membership = management.memberships.find(item => String(item.place_id) === String(place.id));
  const claim = management.claims.find(item => String(item.place_id) === String(place.id) && item.status === 'pending');
  const canEdit = management.is_admin || (membership && subscriptionAllowsEditing(membership.subscription));
  const hasAccess = canEdit || !!membership;
  const closeClaim = () => {
    setClaiming(false);
    if (params.has('claim')) {
      const next = new URLSearchParams(params);
      next.delete('claim');
      setParams(next, { replace: true });
    }
  };
  if ((placement === 'top') !== !!hasAccess) return null;
  return <>
    {canEdit ? <button className="button" onClick={() => setEditing(true)}>Edit Place</button>
      : membership ? <Link className="button" to="/my-places">Manage Subscription</Link>
      : claim ? <Link className="button" to="/my-places">Claim Pending</Link>
      : place.is_claimed !== false ? null
      : <button className="button" disabled={management.loading} onClick={() => setClaiming(true)}>Claim This Place</button>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {editing && <PlaceEditor place={place} onNotice={setNotice} onClose={() => setEditing(false)} onPublished={message => { setNotice(message); management.refresh(); }} />}
    {claiming && !claim && !hasAccess && place.is_claimed === false && <PlaceClaim place={place} onClose={closeClaim} onSubmitted={message => { closeClaim(); setNotice(message); }} />}
  </>;
}
PlaceManagement.propTypes = { place: PropTypes.object.isRequired, placement: PropTypes.oneOf(['top', 'visit']) };
