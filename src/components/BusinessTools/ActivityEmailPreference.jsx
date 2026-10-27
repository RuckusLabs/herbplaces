import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { managementRpc } from '../../utilities/managementApi';
import { emailReportsEnabled } from '../../utilities/growthApi';
import styles from './growth.module.scss';

export default function ActivityEmailPreference({ placeId }) {
  const [preference,setPreference] = useState(null); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [attempt,setAttempt] = useState(0);
  useEffect(() => { if (!emailReportsEnabled) return; let active=true; managementRpc('get_activity_email_preference',{p_place_id:placeId})
    .then(result => { if (active) { if (!result) throw new Error('Monthly report settings could not load.'); setPreference(result); setError(''); } })
    .catch(failure => { if (active) setError(failure.message); }); return () => { active=false; }; },[placeId,attempt]);
  if (!emailReportsEnabled) return null;
  const update = async enabled => { const previous=preference; setPreference({...previous,enabled}); setBusy(true); setError(''); setNotice(''); try { const result=await managementRpc('set_activity_email_preference',{p_place_id:placeId,p_enabled:enabled});setPreference(result);setNotice(enabled ? 'Monthly reports are on for this place. They go to your confirmed account email.' : 'Future monthly reports are off for this place.'); } catch(failure) { setPreference(previous); setError(failure.message); } finally { setBusy(false); } };
  return <section aria-label="Monthly report emails" aria-busy={busy}><h3>Monthly report emails</h3><p>Receive this place’s completed-calendar-month summary at your confirmed account email, with the previous month for comparison. Reports use UTC dates and start with the next eligible month. Community newsletter preferences are separate.</p>
    {preference ? <><div className={styles.checks}><label><input type="checkbox" checked={preference.enabled} disabled={busy || (!preference.enabled && !preference.eligible)} onChange={event=>update(event.target.checked)} />Email me this place’s monthly activity report</label></div>
      {!preference.eligible && <p>An active Bloom subscription or Thrive pilot is required to receive reports.</p>}
      {preference.last_report && <p>Last report: {preference.last_report.period_start} · {preference.last_report.status === 'sent' ? `sent ${new Date(preference.last_report.sent_at).toLocaleDateString()}` : preference.last_report.status === 'needs_attention' ? 'Delivery needs attention. Contact help@littleherbplaces.com.' : preference.last_report.status === 'stopped' ? 'Stopped before delivery.' : 'Queued for delivery.'}</p>}
      <p className={styles.hint}>You can stop reports here or from an email. A report already being sent may still arrive.</p></> : !error && <p role="status">Loading report preferences…</p>}
    {notice && <p role="status">{notice}</p>}{error && <div role="alert"><p>{error}</p><button className="button" onClick={()=>setAttempt(value=>value+1)}>Retry Report Preferences</button></div>}
  </section>;
}
ActivityEmailPreference.propTypes={placeId:PropTypes.string.isRequired};
