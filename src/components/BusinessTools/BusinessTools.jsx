import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import GrowthEditor from './GrowthEditor';
import ActivityEmailPreference from './ActivityEmailPreference';
import { growthEnabled } from '../../utilities/growthApi';
import { managementRpc, geocodePublishedPlace } from '../../utilities/managementApi';
import { updatePublishedPlace } from '../../utilities/placesStore';
import { ACTIVITY_KINDS, ACTIVITY_LABELS, activityCsv, profileChecklist } from '../../utilities/placeGrowth';
import styles from './growth.module.scss';

function EssentialEditor({ place, profile, onClose, onSaved }) {
  const titleId = useId(); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const [draft,setDraft] = useState(() => ({ ...Object.fromEntries(['address','city','state','zip','phone','hours'].map(key => [key,place[key] || ''])),operating_status:profile?.operating_status || 'open' }));
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { const published = await managementRpc('update_place_essentials',{ p_place_id:String(place.id),p_content:draft,p_expected_version:place.content_version }); updatePublishedPlace(published); void geocodePublishedPlace(published); onSaved(); }
    catch(failure) { setError(failure.message); } finally { setBusy(false); }
  };
  return <Modal open onClose={() => { if (!busy) onClose(); }} labelledBy={titleId} closeLabel="Close essential details editor"><h2 id={titleId}>Correct essential details</h2><p>Available to approved managers without a paid subscription.</p><form className={styles.form} onSubmit={save}><fieldset disabled={busy}><legend>Visit information</legend>{[['address','Street address'],['city','City'],['state','State or region'],['zip','ZIP or postal code'],['phone','Phone'],['hours','Opening hours']].map(([key,label]) => <label key={key}>{label}<input value={draft[key]} maxLength={2000} onChange={event => setDraft(previous => ({ ...previous,[key]:event.target.value }))} /></label>)}<label>Operating status<select value={draft.operating_status} onChange={event => setDraft(previous => ({ ...previous,operating_status:event.target.value }))}><option value="open">Open</option><option value="temporarily_closed">Temporarily closed</option><option value="permanently_closed">Permanently closed</option></select></label></fieldset>{error && <p role="alert" className={styles.error}>{error}</p>}<button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save Essential Details'}</button></form></Modal>;
}
EssentialEditor.propTypes = { place:PropTypes.object.isRequired,profile:PropTypes.object,onClose:PropTypes.func.isRequired,onSaved:PropTypes.func.isRequired };

function ActivityReport({ place, access }) {
  const [report,setReport] = useState(null); const [error,setError] = useState(''); const [attempt,setAttempt] = useState(0);
  useEffect(() => { let active=true; managementRpc('get_place_activity',{ p_place_id:String(place.id) }).then(result => { if(active) { setReport(result); setError(''); } }).catch(failure => { if(active) setError(failure.message); }); return () => { active=false; }; },[place.id,attempt]);
  const exportReport = () => { const url=URL.createObjectURL(new Blob([activityCsv(report)],{ type:'text/csv;charset=utf-8' })); const link=document.createElement('a'); link.href=url; link.download=`${place.urlSlug}-activity-${report.through}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
  if(error) return <div role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(value => value+1)}>Retry Activity Report</button></div>;
  if(!report) return <p role="status">Gathering your activity…</p>;
  const keys=access.can_thrive ? ACTIVITY_KINDS : ACTIVITY_KINDS.filter(key => !['offering_click','event_click'].includes(key));
  const items=[...(access.profile?.content?.offerings || []),...(access.profile?.content?.events || [])];
  return <section aria-label="Business activity report"><h3>Your last 30 days</h3><p>{report.from}–{report.through} · UTC · today is a partial day. Compared with the preceding 30 days.</p><div className={styles.metrics}>{keys.map(key => <article key={key}><h3>{ACTIVITY_LABELS[key]}</h3><strong>{Number(report.current?.[key] || 0)}</strong><p>{Number(report.previous?.[key] || 0)} in the previous period</p></article>)}</div><p className={styles.hint}>These are recorded actions, not unique visitors, confirmed calls, bookings, or sales. Repeat actions and known bots are filtered where possible. Tracking starts when collection is enabled; earlier activity is unavailable.</p><div className={styles.actions}><button className="button" onClick={exportReport}>Download Daily Activity CSV</button><button className="button" onClick={() => setAttempt(value => value+1)}>Refresh Activity</button></div>
    {access.can_thrive && report.items?.length > 0 && <><h3>Interest in your offerings & events</h3><ul>{report.items.map(item => <li key={`${item.kind}-${item.item_id}`}>{items.find(saved => saved.id===item.item_id)?.title || 'Previously published item'}: {item.total} {item.kind==='event_click' ? 'registration-link clicks' : 'offering clicks'}</li>)}</ul></>}
    <p className={styles.notice}>{Number(report.current?.profile_view || 0)===0 ? 'No recorded profile views yet. Share your listing with your community and check that your details and main action are complete.' : Number(report.current?.primary_click || 0)===0 ? 'People are viewing your profile. Try a clear main action linked to a useful booking or shopping page.' : 'Your main action is receiving interest. Keep the destination current and compare which announcements or offerings people explore.'}</p>
  </section>;
}
ActivityReport.propTypes={ place:PropTypes.object.isRequired,access:PropTypes.object.isRequired };

function ToolsPanel({ place, onChanged }) {
  const [access,setAccess]=useState(null); const [error,setError]=useState(''); const [mode,setMode]=useState(''); const [attempt,setAttempt]=useState(0); const [notice,setNotice]=useState('');
  useEffect(() => { let active=true; managementRpc('get_growth_access',{ p_place_id:String(place.id) }).then(result => { if(active) { setAccess(result); setError(''); } }).catch(failure => { if(active) setError(failure.message); }); return () => { active=false; }; },[place.id,attempt]);
  const saved = () => { setMode('');setNotice('Your changes are published.');setAttempt(value => value+1);onChanged?.(); };
  if(error) return <div role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(value=>value+1)}>Retry Business Tools</button></div>;
  if(!access) return <p role="status">Loading your business tools…</p>;
  const checklist=profileChecklist(place,access.profile);
  const announcement=access.profile?.content?.announcement;
  return <>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {access.pilot_until && <p>Thrive pilot access through {new Date(access.pilot_until).toLocaleDateString()}. No Thrive payment is collected.</p>}
    <div className={styles.actions}><button className="button" onClick={() => setMode('essentials')}>Correct Essential Details</button>{access.can_edit ? <button className="button" onClick={() => setMode('highlights')}>Edit Business Highlights</button> : <Link className="button" to="/the-little-garden/bloom">Explore Bloom Tools</Link>}</div>
    <ActivityEmailPreference placeId={String(place.id)} />
    {access.can_edit && <><h3>Make your profile useful</h3><p>{checklist.filter(item=>item.done).length} of {checklist.length} essentials complete.</p><ul className={styles.checklist}>{checklist.map(item=><li key={item.label}>{item.done ? 'Complete: ' : 'Next: '}{item.label}</li>)}</ul>
      {announcement?.title && Date.parse(announcement.expires_at)<Date.now()+7*86400000 && <p className={styles.notice}>{Date.parse(announcement.expires_at)<Date.now() ? 'Your announcement has expired and is hidden.' : 'Your announcement expires within the next seven days.'} Open Business Highlights to refresh it.</p>}
      <ActivityReport place={place} access={access} />
      {!access.can_thrive && <p>Have products, consultations, or classes to share? <Link to="/the-little-garden/thrive">Explore the Thrive pilot</Link>.</p>}
    </>}
    {mode==='highlights' && <GrowthEditor place={place} access={access} onClose={()=>setMode('')} onSaved={saved} />}
    {mode==='essentials' && <EssentialEditor place={place} profile={access.profile} onClose={()=>setMode('')} onSaved={saved} />}
  </>;
}
ToolsPanel.propTypes={ place:PropTypes.object.isRequired,onChanged:PropTypes.func };

export default function BusinessTools({ place, onChanged }) {
  const [open,setOpen]=useState(false);
  if(!growthEnabled) return null;
  return <details className={styles.tools} onToggle={event=>setOpen(event.currentTarget.open)}><summary>Business tools & activity</summary>{open && <ToolsPanel place={place} onChanged={onChanged} />}</details>;
}
BusinessTools.propTypes={ place:PropTypes.object.isRequired,onChanged:PropTypes.func };
