import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import GrowthEditor from './GrowthEditor';
import ActivityEmailPreference from './ActivityEmailPreference';
import { growthEnabled } from '../../utilities/growthApi';
import { managementRpc, geocodePublishedPlace } from '../../utilities/managementApi';
import { updatePublishedPlace } from '../../utilities/placesStore';
import { activityAdvice, readableReportRange } from '../../utilities/activityAdvice';
import { ACTIVITY_KINDS, ACTIVITY_LABELS, activityCsv, profileChecklist } from '../../utilities/placeGrowth';
import styles from './growth.module.scss';
import Icon from '../Icons/Icon';

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

function ActivityReport({ place, access, onEdit }) {
  const [shareNotice,setShareNotice] = useState('');
  const [report,setReport] = useState(null); const [error,setError] = useState(''); const [attempt,setAttempt] = useState(0);
  useEffect(() => { let active=true; managementRpc('get_place_activity',{ p_place_id:String(place.id) }).then(result => { if(active) { setReport(result); setError(''); } }).catch(failure => { if(active) setError(failure.message); }); return () => { active=false; }; },[place.id,attempt]);
  const exportReport = () => { const url=URL.createObjectURL(new Blob([activityCsv(report)],{ type:'text/csv;charset=utf-8' })); const link=document.createElement('a'); link.href=url; link.download=`${place.urlSlug}-activity-${report.through}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
  if(error) return <div role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(value => value+1)}>Retry Activity Report</button></div>;
  if(!report) return <p role="status">Gathering your activity…</p>;
  const keys=access.can_manage_offerings ? ACTIVITY_KINDS : ACTIVITY_KINDS.filter(key => !['offering_click','event_click'].includes(key));
  const items=[...(access.profile?.content?.offerings || []),...(access.profile?.content?.events || [])];
  const advice = activityAdvice(report, access.profile);
  const act = async () => {
    if (advice.target !== 'share') { onEdit(advice.target); return; }
    try { await navigator.clipboard.writeText(`${window.location.origin}/place/${place.urlSlug}/`); setShareNotice('Listing link copied.'); }
    catch { setShareNotice(`Your listing link: ${window.location.origin}/place/${place.urlSlug}/`); }
  };
  return <section aria-label="Business activity report"><h3 className={styles.reportTitle}>Your Last 30 Days</h3><p>{readableReportRange(report.from, report.through)}. Compared with the preceding 30 days.</p><div className={styles.metrics}>{keys.filter(key=>['profile_view','primary_click','offering_click','event_click'].includes(key)).map(key => <article key={key}><h3>{ACTIVITY_LABELS[key]}</h3><strong>{Number(report.current?.[key] || 0)}</strong><p>{Number(report.previous?.[key] || 0)} in the previous period</p></article>)}</div><details className={styles.activityBreakdown}><summary>All Customer Actions</summary><table><thead><tr><th>Action</th><th>Last 30 Days</th><th>Previous Period</th></tr></thead><tbody>{keys.map(key=><tr key={key}><th scope="row">{ACTIVITY_LABELS[key]}</th><td>{Number(report.current?.[key] || 0)}</td><td>{Number(report.previous?.[key] || 0)}</td></tr>)}</tbody></table></details><p className={styles.hint}>These are recorded actions, not unique visitors, confirmed calls, bookings, or sales. Repeat actions and known bots are filtered where possible. Tracking starts when collection is enabled; earlier activity is unavailable.</p><div className={styles.actions}><button className="button" onClick={exportReport}>Download Daily Activity CSV</button><button className="button" onClick={() => setAttempt(value => value+1)}>Refresh Activity</button></div>
    {access.can_manage_offerings && report.items?.length > 0 && <section className={styles.itemInterest} aria-label="Interest in Your Offerings & Events"><header><h3>Interest in Your Offerings & Events</h3><p>Link clicks for individual items during the last 30 days.</p></header><div className={styles.interestGroups}>{[['offering_click','Products & Services','plan-offerings'],['event_click','Workshops & Events','plan-events']].map(([kind,label,icon])=>{const rows=report.items.filter(item=>item.kind===kind);return rows.length > 0 && <div key={kind} className={styles.interestGroup}><h4><Icon name={icon} size={30} />{label}</h4><ul>{rows.map(item=>{const saved=items.find(saved=>saved.id===item.item_id);return <li key={item.item_id}><div><strong>{saved?.title || 'Previously Published Item'}</strong><span>{kind==='event_click' ? 'Registration-link clicks' : saved?.kind==='service' ? 'Service-link clicks' : 'Product-link clicks'}</span></div><span className={styles.interestCount} aria-label={`${Number(item.total || 0)} clicks`}>{Number(item.total || 0)}</span></li>;})}</ul></div>;})}</div></section>}
    <div className={styles.notice}><h4>One Thing to Try Next</h4><p>{advice.text}</p><button className="button" onClick={act}>{advice.action}</button>{shareNotice && <p role="status">{shareNotice}</p>}</div>
  </section>;
}
ActivityReport.propTypes={ place:PropTypes.object.isRequired,access:PropTypes.object.isRequired,onEdit:PropTypes.func.isRequired };

function ToolsPanel({ place, onChanged, onPreview, previewing, previewTargetId, view, onEdit }) {
  const [params, setParams] = useSearchParams();
  const requestedMode = view === 'editor' ? params.get('business') : '';
  const [access,setAccess]=useState(null); const [error,setError]=useState(''); const [mode,setMode]=useState(requestedMode); const [attempt,setAttempt]=useState(0); const [notice,setNotice]=useState('');
  useEffect(() => { let active=true; managementRpc('get_growth_access',{ p_place_id:String(place.id) }).then(result => { if(active) { setAccess(result); setError(''); } }).catch(failure => { if(active) setError(failure.message); }); return () => { active=false; }; },[place.id,attempt]);
  const closeEditor = () => { setMode(''); if (view === 'editor') { const next = new URLSearchParams(params); next.delete('business'); setParams(next, { replace: true }); } };
  const edit = section => onEdit ? onEdit(section) : setMode(section);
  const saved = () => { closeEditor();setNotice('Your changes are published.');setAttempt(value => value+1);onChanged?.(); };
  if(error) return <div role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(value=>value+1)}>Retry Business Tools</button></div>;
  if(!access) return <p role="status">Loading your business tools…</p>;
  const checklist=profileChecklist(place,access.profile);
  const announcement=access.profile?.content?.announcement;
  return <>
    {view === 'editor' && mode !== 'essentials' && !access.can_edit && <p className={styles.notice}>These tools require active Bloom access. <Link to="/my-places">Open My Places</Link>.</p>}
    <div hidden={previewing}>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {view === 'overview' && access.can_edit && <section className={styles.setup} aria-label="Profile setup checklist"><h3>Make Your Profile Ready for Visitors</h3><p>{checklist.filter(item=>item.done).length} of {checklist.length} essentials complete. {checklist.find(item=>!item.done)?.label || 'Your essential profile details are complete.'}</p><progress max={checklist.length} value={checklist.filter(item=>item.done).length} aria-label="Profile essentials complete" /><details className={styles.setupDetails}><summary>View Profile Checklist</summary><ul className={styles.checklist}>{checklist.map(item=><li key={item.label}>{item.done ? 'Complete: ' : 'Next: '}{item.label}</li>)}</ul></details><div className={styles.actions}><Link className="button" to={`/place/${place.urlSlug}?edit=1`}>Edit Description & Photos</Link><button className="button" onClick={() => edit('action')}>Choose Your Main Action</button></div></section>}
    {view === 'overview' && !access.can_edit && <div className={styles.notice}><h2>Start With the Essentials</h2><p>Correct your address, hours, phone, and operating status for free. Bloom adds richer listing edits and activity insights.</p><button className="button" onClick={() => edit('essentials')}>Correct Essential Details</button> <Link to="/my-places">Membership & Billing</Link></div>}
    {view === 'listing' && <section aria-label="Listing tools"><h2>Care for Your Listing</h2><p>Choose what you’d like to update. You’ll preview changes on your actual listing before publishing.</p><div className={styles.toolLinks}>
      <button onClick={()=>edit('essentials')}><Icon name="pin" size={38} className={styles.essentialIcon} /><div><h3>Essential Details</h3><p>Address, hours, phone, and operating status. Always free.</p></div><Icon name="arrow" size={16} /></button>
      {access.can_edit && <><Link to={`/place/${place.urlSlug}?edit=1`}><Icon name="plan-story" size={38} /><div><h3>Story & Photos</h3><p>Your description, cover image, and gallery.</p></div><Icon name="arrow" size={16} /></Link>
      {[['layout','plan-profile','Layout & Order','Arrange sections on your listing.'],['action','plan-action','Main Action','Guide visitors to your shop or booking page.'],['announcement','plan-announcement','Announcement','Share a timely update or seasonal offer.'],['offerings','plan-offerings','Products & Services','Manage up to 10 things people can shop or book.'],['events','plan-events','Workshops & Events','Manage upcoming dates and registration links.'],['visitors','plan-access','Visitor Information','Specialties, languages, and access notes.']].map(([section,icon,title,description])=><button key={section} onClick={()=>edit(section)}><Icon name={icon} size={38} /><div><h3>{title}</h3><p>{description}</p></div><Icon name="arrow" size={16} /></button>)}</>}
    </div>{!access.can_edit && <p><Link to="/my-places">Explore Bloom access in My Places</Link>.</p>}</section>}
    {view === 'email' && <ActivityEmailPreference placeId={String(place.id)} />}
    {view === 'activity' && (access.can_edit ? <>
      {announcement?.title && Date.parse(announcement.expires_at)<Date.now()+7*86400000 && <p className={styles.notice}>{Date.parse(announcement.expires_at)<Date.now() ? 'Your announcement has expired and is hidden.' : 'Your announcement expires within the next seven days.'} <button className="button" onClick={()=>edit('announcement')}>Update Announcement</button></p>}
      <ActivityReport place={place} access={access} onEdit={edit} />
    </> : <div className={styles.notice}><h2>Activity Insights Come With Bloom</h2><p>Your listing remains visible. Open My Places to check your membership and billing access.</p><Link to="/my-places">Open My Places</Link></div>)}
    </div>
    {view === 'editor' && access.can_edit && ['highlights','layout','action','announcement','offerings','events','visitors'].includes(mode) && <GrowthEditor onPreview={onPreview} previewTargetId={previewTargetId} initialSection={mode} place={place} access={access} onClose={closeEditor} onSaved={saved} />}
    {view === 'editor' && mode==='essentials' && <EssentialEditor place={place} profile={access.profile} onClose={closeEditor} onSaved={saved} />}
  </>;
}
ToolsPanel.propTypes={ place:PropTypes.object.isRequired,onChanged:PropTypes.func,onPreview:PropTypes.func,previewing:PropTypes.bool,previewTargetId:PropTypes.string,view:PropTypes.string.isRequired,onEdit:PropTypes.func };

export default function BusinessTools({ place, onChanged, onPreview, previewing = false, previewTargetId, view = 'overview', onEdit }) {
  const [params] = useSearchParams();
  const [notice,setNotice] = useState('');
  if(!growthEnabled) return null;
  if(view === 'editor' && !['highlights','layout','action','announcement','offerings','events','visitors','essentials'].includes(params.get('business'))) return notice ? <p role="status" className={styles.notice}>{notice}</p> : null;
  return <ToolsPanel key={`${place.id}:${view === 'editor' ? params.get('business') : view}`} place={place} onChanged={()=>{setNotice('Your changes are published.');onChanged?.();}} onPreview={onPreview} previewing={previewing} previewTargetId={previewTargetId} view={view} onEdit={onEdit} />;
}
BusinessTools.propTypes={ place:PropTypes.object.isRequired,onChanged:PropTypes.func,onPreview:PropTypes.func,previewing:PropTypes.bool,previewTargetId:PropTypes.string,view:PropTypes.string,onEdit:PropTypes.func };
