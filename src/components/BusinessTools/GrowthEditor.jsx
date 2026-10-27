import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { ACTION_LABELS, emptyGrowth, prepareGrowth, SPECIALTIES } from '../../utilities/placeGrowth';
import { managementRpc } from '../../utilities/managementApi';
import PlaceHighlights from './PlaceHighlights';
import styles from './growth.module.scss';

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const localTime = value => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
const isoTime = value => value ? new Date(value).toISOString() : '';

export default function GrowthEditor({ place, access, onClose, onSaved }) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => { const base = emptyGrowth(); const saved = access.profile?.content; return { ...base, ...saved, primary_action: { ...base.primary_action, ...saved?.primary_action }, announcement: { ...base.announcement, ...saved?.announcement } }; });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(null);
  const update = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setPreview(null); };
  const updateItem = (field,index,key,value) => update(field,draft[field].map((item,i) => i === index ? { ...item,[key]:value } : item));
  const save = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await managementRpc('publish_place_growth', { p_place_id: String(place.id), p_content: prepareGrowth(draft, place.photos || []), p_expected_version: access.profile.version }); onSaved(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const items = (field, eventMode) => <fieldset disabled={busy || !access.can_thrive}><legend>{eventMode ? 'Workshops & events' : 'Products & services'} · Thrive pilot</legend>
    {!access.can_thrive && <p className={styles.hint}>These tools are available to invited Thrive pilots. Your existing published items remain visible.</p>}
    {eventMode && <p className={styles.hint}>Enter dates in your device’s time zone: {deviceZone}. Visitors see the event’s saved time zone.</p>}
    {draft[field].map((item,index) => <div key={item.id} className={styles.item}><h3>{eventMode ? 'Event' : 'Offering'} {index+1}</h3>
      <label>Title<input value={item.title} maxLength={120} required onChange={event => updateItem(field,index,'title',event.target.value)} /></label>
      {!eventMode && <label>Kind<select value={item.kind} onChange={event => updateItem(field,index,'kind',event.target.value)}><option value="product">Product</option><option value="service">Service</option></select></label>}
      <label>Description<textarea value={item.description} maxLength={1500} onChange={event => updateItem(field,index,'description',event.target.value)} /></label>
      <div className={styles.row}><label>Price or price range<input value={item.price} maxLength={100} placeholder="$35 · or Contact for pricing" onChange={event => updateItem(field,index,'price',event.target.value)} /></label><label>{eventMode ? 'Registration link' : 'Shopping or booking link'}<input value={item.url} maxLength={2000} inputMode="url" required onChange={event => updateItem(field,index,'url',event.target.value)} /></label></div>
      {eventMode && <><div className={styles.row}><label>Starts (your device time)<input type="datetime-local" value={localTime(item.starts_at)} required onChange={event => updateItem(field,index,'starts_at',isoTime(event.target.value))} /></label><label>Ends (your device time)<input type="datetime-local" value={localTime(item.ends_at)} required onChange={event => updateItem(field,index,'ends_at',isoTime(event.target.value))} /></label></div><p className={styles.hint}>Event time zone: {item.timezone}</p><label>Location or online details<input value={item.location} maxLength={300} onChange={event => updateItem(field,index,'location',event.target.value)} /></label></>}
      <label>Photo from your listing<select value={item.image || ''} onChange={event => updateItem(field,index,'image',event.target.value)}><option value="">No photo</option>{(place.photos || []).map((photo,i) => <option key={photo} value={photo}>Listing photo {i+1}</option>)}</select></label>
      {item.image && <label>Photo description<input value={item.image_alt} maxLength={300} onChange={event => updateItem(field,index,'image_alt',event.target.value)} /></label>}
      <button type="button" className="button" onClick={() => update(field,draft[field].filter((_,i) => i !== index))}>Remove {eventMode ? 'event' : 'offering'} {index+1}</button>
    </div>)}
    {draft[field].length < 10 && <button type="button" className="button" onClick={() => update(field,[...draft[field],{ id:crypto.randomUUID(),title:'',description:'',price:'',url:'',image:'',image_alt:'',...(eventMode ? { starts_at:'',ends_at:'',timezone:deviceZone,location:'' } : { kind:'product' }) }])}>Add {eventMode ? 'Event' : 'Offering'}</button>}
  </fieldset>;
  return <Modal open onClose={() => { if (!busy && window.confirm('Close without publishing these highlights?')) onClose(); }} labelledBy={titleId} closeLabel="Close highlights editor">
    <h2 id={titleId}>Business highlights for {place.name}</h2><p className={styles.hint}>Give visitors a reason and a clear next step. Preview before publishing.</p>
    <form className={styles.form} onSubmit={save}>
      <fieldset disabled={busy}><legend>Main customer action</legend><label>Button label<select value={draft.primary_action.label} onChange={event => update('primary_action',{ ...draft.primary_action,label:event.target.value })}><option value="">Choose an action</option>{ACTION_LABELS.map(label => <option key={label}>{label}</option>)}</select></label><label>Destination link<input value={draft.primary_action.url} inputMode="url" maxLength={2000} placeholder="https://your-business.com/book" onChange={event => update('primary_action',{ ...draft.primary_action,url:event.target.value })} /></label></fieldset>
      <fieldset disabled={busy}><legend>Specialties & visitor information</legend><div className={styles.checks}>{SPECIALTIES.map(item => <label key={item}><input type="checkbox" checked={draft.specialties.includes(item)} onChange={event => update('specialties',event.target.checked ? [...draft.specialties,item] : draft.specialties.filter(value => value !== item))} />{item}</label>)}</div><label>Languages<input value={draft.languages} maxLength={200} onChange={event => update('languages',event.target.value)} /></label><label>Access information<textarea value={draft.access_notes} maxLength={1000} placeholder="Describe entrances, steps, seating, or how to ask about access. Share facts visitors can use." onChange={event => update('access_notes',event.target.value)} /></label></fieldset>
      <fieldset disabled={busy}><legend>Current announcement or seasonal offer</legend><label>Title<input value={draft.announcement.title} maxLength={120} onChange={event => update('announcement',{ ...draft.announcement,title:event.target.value })} /></label><label>Message<textarea value={draft.announcement.body} maxLength={1000} onChange={event => update('announcement',{ ...draft.announcement,body:event.target.value })} /></label><div className={styles.row}><label>Learn-more link (optional)<input value={draft.announcement.url} inputMode="url" maxLength={2000} onChange={event => update('announcement',{ ...draft.announcement,url:event.target.value })} /></label><label>Offer code (optional)<input value={draft.announcement.code} maxLength={40} onChange={event => update('announcement',{ ...draft.announcement,code:event.target.value })} /></label></div><p className={styles.hint}>Dates use {deviceZone}. An empty start means immediately. Expired announcements are hidden automatically.</p><div className={styles.row}><label>Starts<input type="datetime-local" value={localTime(draft.announcement.starts_at)} onChange={event => update('announcement',{ ...draft.announcement,starts_at:isoTime(event.target.value) })} /></label><label>Ends<input type="datetime-local" value={localTime(draft.announcement.expires_at)} required={!!draft.announcement.title} onChange={event => update('announcement',{ ...draft.announcement,expires_at:isoTime(event.target.value) })} /></label></div></fieldset>
      {items('offerings',false)}{items('events',true)}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {preview && <section className={styles.example} aria-label="Unpublished highlights preview"><h3>Preview · not published</h3><PlaceHighlights profile={{ content:preview }} placeId={String(place.id)} track={false} /><p className={styles.hint}>Scheduled announcements appear here only while their dates are active.</p></section>}
      <footer><button type="button" className="button" disabled={busy} onClick={() => { try { setPreview(prepareGrowth(draft,place.photos || [])); setError(''); } catch(failure) { setError(failure.message); } }}>Preview Highlights</button><button className="button" disabled={busy}>{busy ? 'Publishing…' : 'Publish Highlights'}</button></footer>
    </form>
  </Modal>;
}
GrowthEditor.propTypes = { place:PropTypes.object.isRequired,access:PropTypes.object.isRequired,onClose:PropTypes.func.isRequired,onSaved:PropTypes.func.isRequired };
