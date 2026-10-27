import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { growthEnabled } from '../../utilities/growthApi';
import { managementRpc } from '../../utilities/managementApi';
import styles from './growth.module.scss';

export default function AdminPilotControls({ placeId, onChanged }) {
  const labelId = useId(); const [access,setAccess]=useState(null);const [end,setEnd]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!growthEnabled)return;let active=true;managementRpc('get_growth_access',{p_place_id:placeId}).then(result=>{if(active){setAccess(result);setError('');}}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[placeId,attempt]);
  if(!growthEnabled)return null;
  const save=async(expires)=>{setBusy(true);setError('');setNotice('');try{await managementRpc('admin_set_thrive_pilot',{p_place_id:placeId,p_expires_at:expires});setNotice(expires?'Pilot access updated. No subscription or payment was created.':'Pilot access ended. Published content is retained.');setAttempt(value=>value+1);onChanged?.();}catch(failure){setError(failure.message);}finally{setBusy(false);}};
  return <section className={styles.tools} aria-labelledby={labelId}><h3 id={labelId}>Thrive pilot access</h3><p>Agree the scope and end date with the business before granting access. Includes Bloom editing and growth tools. This creates no Stripe subscription and takes no payment.</p>{access?.pilot_until && <p>Current end: {new Date(access.pilot_until).toLocaleString()}</p>}<form className={styles.form} onSubmit={event=>{event.preventDefault();save(new Date(end).toISOString());}}><label>Pilot end (your device time; within 90 days)<input type="datetime-local" value={end} required disabled={busy} onChange={event=>setEnd(event.target.value)}/></label><div className={styles.actions}><button className="button" disabled={busy}>Grant or Update Pilot</button>{access?.pilot_until && <button type="button" className="button" disabled={busy} onClick={()=>save(null)}>End Pilot Access</button>}</div></form>{error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
AdminPilotControls.propTypes={placeId:PropTypes.string.isRequired,onChanged:PropTypes.func};
