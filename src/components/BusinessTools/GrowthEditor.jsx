import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Modal from '../Modal/Modal';
import Icon from '../Icons/Icon';
import { ACTION_LABELS, emptyGrowth, prepareGrowth, SECTION_HEADINGS, SPECIALTIES } from '../../utilities/placeGrowth';
import { managementRpc } from '../../utilities/managementApi';
import styles from './growth.module.scss';

const editorSections = [
  { id: 'action', icon: 'plan-action', label: 'Main Action', description: 'Choose where visitors go next.', fields: ['primary_action'] },
  { titleKey: 'specialties', id: 'visitors', icon: 'plan-access', label: 'Visitor Information', description: 'Help people know what to expect.', fields: ['specialties', 'languages', 'access_notes'] },
  { id: 'announcement', icon: 'plan-announcement', label: 'Announcement', description: 'Share one timely update or seasonal offer.', fields: ['announcement'] },
  { titleKey: 'offerings', id: 'offerings', icon: 'plan-offerings', label: 'Products & Services', description: 'Add up to 10 things people can shop or book.', fields: ['offerings'] },
  { titleKey: 'events', id: 'events', icon: 'plan-events', label: 'Workshops & Events', description: 'Add up to 10 events with registration links.', fields: ['events'] },
];

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const localTime = value => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
const isoTime = value => value ? new Date(value).toISOString() : '';

export default function GrowthEditor({ place, access, onClose, onSaved, initialSection = 'highlights', onPreview, previewTargetId }) {
  const titleId = useId();
  const [section, setSection] = useState(() => editorSections.some(item => item.id === initialSection) ? initialSection : 'action');
  const [expandedItem, setExpandedItem] = useState(null);
  const panel = useRef(null);
  const itemTitleField = useRef(null);
  useEffect(() => { if (expandedItem) itemTitleField.current?.focus(); }, [expandedItem, section]);
  const activeSection = editorSections.find(item => item.id === section);
  const chooseSection = id => { setSection(id); setPreview(null); panel.current?.closest('dialog')?.scrollTo({ top: 0 }); };

  const actionField = useRef(null); const announcementField = useRef(null);
  useEffect(() => { const field = initialSection === 'announcement' ? announcementField : initialSection === 'action' ? actionField : null; field?.current?.focus(); }, [initialSection]);
  const [draft, setDraft] = useState(() => { const base = emptyGrowth(); const saved = access.profile?.content; return { ...base, ...saved, primary_action: { ...base.primary_action, ...saved?.primary_action }, announcement: { ...base.announcement, ...saved?.announcement } }; });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(null);
  const previewTitle = useRef(null);
  useEffect(() => { onPreview(preview); return () => onPreview(null); }, [preview, onPreview]);
  useEffect(() => {
    if (!preview) return;
    document.body.classList.add('has-growth-preview');
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    const toolbar = document.getElementById(previewTargetId);
    const measure = () => { document.body.style.setProperty('--growth-nav-height', `${nav?.getBoundingClientRect().height || 0}px`); document.body.style.setProperty('--growth-toolbar-height', `${toolbar?.getBoundingClientRect().height || 0}px`); };
    measure();
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    if (toolbar) observer.observe(toolbar);
    window.scrollTo({ top: 0, behavior: 'instant' });
    previewTitle.current?.focus({ preventScroll: true });
    return () => { observer.disconnect(); document.body.classList.remove('has-growth-preview'); document.body.style.removeProperty('--growth-nav-height'); document.body.style.removeProperty('--growth-toolbar-height'); };
  }, [preview, previewTargetId]);

  const update = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setPreview(null); };
  const updateItem = (field,index,key,value) => update(field,draft[field].map((item,i) => i === index ? { ...item,[key]:value } : item));
  const preparedDraft = () => {
    for (const item of editorSections) {
      try { prepareGrowth({ ...emptyGrowth(), ...Object.fromEntries(item.fields.map(field => [field, draft[field]])), section_titles: item.titleKey ? { [item.titleKey]: draft.section_titles?.[item.titleKey] || '' } : {} }, place.photos || []); }
      catch (failure) {
        setSection(item.id); setPreview(null);
        if (['offerings', 'events'].includes(item.id)) {
          for (const entry of draft[item.id]) {
            try { prepareGrowth({ ...emptyGrowth(), [item.id]: [entry] }, place.photos || []); }
            catch { setExpandedItem(entry.id); break; }
          }
        }
        throw failure;
      }
    }
    return prepareGrowth(draft, place.photos || []);
  };
  const save = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await managementRpc('publish_place_growth', { p_place_id: String(place.id), p_content: preparedDraft(), p_expected_version: access.profile.version }); onSaved(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const headingControl = key => <div className={styles.headingControl}><label>Public Section Title<input value={draft.section_titles?.[key] || ''} maxLength={80} placeholder={SECTION_HEADINGS[key]} onChange={event=>update('section_titles',{...draft.section_titles,[key]:event.target.value})} /></label><div><p>Leave blank to use “{SECTION_HEADINGS[key]}” on your listing.</p>{draft.section_titles?.[key] && <button type="button" onClick={()=>update('section_titles',{...draft.section_titles,[key]:''})}>Use Default</button>}</div></div>;
  const itemFields = (field,eventMode,item,index) => <div id={`${titleId}-${item.id}`} className={styles.itemFields}>
    <div className={styles.itemEditorHeading}><h4>{item.title || `New ${eventMode ? 'Event' : 'Offering'}`}</h4><button type="button" onClick={()=>{ const control=panel.current?.querySelector('button[aria-expanded="true"][aria-controls]'); setExpandedItem(null); control?.focus(); }}>Done</button></div>
      <label>Title<input ref={itemTitleField} value={item.title} maxLength={120} required onChange={event => updateItem(field,index,'title',event.target.value)} /></label>
      {!eventMode && <label>Kind<select value={item.kind} onChange={event => updateItem(field,index,'kind',event.target.value)}><option value="product">Product</option><option value="service">Service</option></select></label>}
      <label>Description<textarea value={item.description} maxLength={1500} onChange={event => updateItem(field,index,'description',event.target.value)} /></label>
      <div className={styles.row}><label>Price or price range<input value={item.price} maxLength={100} placeholder="$35 · or Contact for pricing" onChange={event => updateItem(field,index,'price',event.target.value)} /></label><label>{eventMode ? 'Registration link' : 'Shopping or booking link'}<input value={item.url} maxLength={2000} inputMode="url" required onChange={event => updateItem(field,index,'url',event.target.value)} /></label></div>
      {eventMode && <><div className={styles.row}><label>Starts (your device time)<input type="datetime-local" value={localTime(item.starts_at)} required onChange={event => updateItem(field,index,'starts_at',isoTime(event.target.value))} /></label><label>Ends (your device time)<input type="datetime-local" value={localTime(item.ends_at)} required onChange={event => updateItem(field,index,'ends_at',isoTime(event.target.value))} /></label></div><p className={styles.hint}>Event time zone: {item.timezone}</p><label>Location or online details<input value={item.location} maxLength={300} onChange={event => updateItem(field,index,'location',event.target.value)} /></label></>}
      <label>Photo from your listing<select value={item.image || ''} onChange={event => updateItem(field,index,'image',event.target.value)}><option value="">No photo</option>{(place.photos || []).map((photo,i) => <option key={photo} value={photo}>Listing photo {i+1}</option>)}</select></label>
      {item.image && <label>Photo description<input value={item.image_alt} maxLength={300} onChange={event => updateItem(field,index,'image_alt',event.target.value)} /></label>}
      <button type="button" className="button" onClick={() => update(field,draft[field].filter((_,i) => i !== index))}>Remove {eventMode ? 'event' : 'offering'} {index+1}</button>
  </div>;
  const items = (field, eventMode) => <fieldset className={styles.itemList} disabled={busy || !access.can_manage_offerings}><legend>{eventMode ? 'Workshops & Events' : 'Products & Services'}</legend>
    {headingControl(field)}
    {!access.can_manage_offerings && <p className={styles.hint}>These tools are included with an active Bloom subscription. Your existing published items remain visible.</p>}
    {eventMode && <p className={styles.hint}>Enter dates in your device’s time zone: {deviceZone}. Visitors see the event’s saved time zone.</p>}
    <div className={styles.inventoryLayout}>
      <div className={styles.inventoryBrowser}><div className={styles.inventoryHeader}><strong>{draft[field].length} of 10 {eventMode ? 'events' : 'offerings'}</strong>{draft[field].length < 10 && <button type="button" onClick={() => { const id = crypto.randomUUID(); update(field,[...draft[field],{ id,title:'',description:'',price:'',url:'',image:'',image_alt:'',...(eventMode ? { starts_at:'',ends_at:'',timezone:deviceZone,location:'' } : { kind:'product' }) }]); setExpandedItem(id); }}>Add {eventMode ? 'Event' : 'Offering'}</button>}</div>
        <div className={styles.inventoryList} aria-label={eventMode ? 'Event list' : 'Offering list'}>{draft[field].map(item=><button key={item.id} type="button" className={styles.inventoryRow} aria-label={`${item.title || (eventMode ? 'New event' : 'New offering')} · ${eventMode ? 'Event' : item.kind==='service' ? 'Service' : 'Product'} · ${expandedItem===item.id ? 'Editing' : 'Edit'}`} aria-expanded={expandedItem===item.id} aria-controls={`${titleId}-${item.id}`} onClick={()=>setExpandedItem(item.id)}>{item.image && <img src={item.image} alt="" width="40" height="40" />}<span><strong>{item.title || `New ${eventMode ? 'event' : 'offering'}`}</strong><small>{eventMode ? 'Event' : item.kind==='service' ? 'Service' : 'Product'}{item.price ? ` · ${item.price}` : ''}</small></span><span>{expandedItem===item.id ? 'Editing' : 'Edit'}</span></button>)}</div>
        {!draft[field].length && <p className={styles.emptyItems}>Add your first {eventMode ? 'event' : 'product or service'} when you’re ready.</p>}
      </div>
      <div className={styles.inventoryDetail}>{draft[field].some(item=>item.id===expandedItem) ? draft[field].filter(item=>item.id===expandedItem).map(item=><div key={item.id}>{itemFields(field,eventMode,item,draft[field].findIndex(entry=>entry.id===item.id))}</div>) : <div className={styles.chooseItem}><Icon name={eventMode ? 'plan-events' : 'plan-offerings'} size={52} /><h4>Choose an {eventMode ? 'Event' : 'Offering'}</h4><p>Select an item to edit its details, or add something new. Your list stays in view.</p></div>}</div>
    </div>
  </fieldset>;
  const previewTarget = preview && document.getElementById(previewTargetId);
  return <>
    {previewTarget && createPortal(<section className={styles.pagePreviewToolbar} aria-label="Unpublished Highlights Preview">
      <div className={styles.previewToolbarInner}><div className={styles.previewToolbarLabel}><Icon name="leaf" size={28} /><div><strong ref={previewTitle} tabIndex={-1}>Unpublished Preview</strong><p>Only you can see these changes.</p></div></div><div className={styles.previewToolbarActions}>
        <button type="button" disabled={busy} className={styles.discardPreview} onClick={() => { setPreview(null); onClose(); }}>Discard Changes</button>
        <button type="button" disabled={busy} className="button" onClick={() => setPreview(null)}>Back to Editing</button>
        <button type="button" disabled={busy} className="button" aria-label="Publish Highlights" onClick={save}>{busy ? 'Publishing…' : 'Publish Changes'}</button>
      </div></div>{error && <p role="alert" className={styles.error}>{error}</p>}
    </section>, previewTarget)}
    <Modal open={!preview} onClose={() => { if (!busy && window.confirm('Close without publishing these highlights?')) onClose(); }} className={styles.editorDialog} contentClassName={styles.editorContent} labelledBy={titleId} closeLabel="Close highlights editor">
    <header className={styles.editorHeader}><p className={styles.editorEyebrow}>{place.name}</p><h2 id={titleId}>Business Highlights</h2><p className={styles.hint}>Update one section at a time. Publish when you’re ready.</p></header>
    <form className={`${styles.form} ${styles.editorForm}`} onSubmit={save} noValidate>
      <div className={`${styles.editorLayout} ${['offerings','events'].includes(section) ? styles.inventoryEditor : ''}`}>
        <nav className={styles.editorNav} aria-label="Highlights sections">{editorSections.map(item => <button key={item.id} type="button" disabled={busy} aria-current={section === item.id && !preview ? 'step' : undefined} onClick={() => chooseSection(item.id)}><Icon name={item.icon} size={30} /><span className={styles.sectionLabel}>{item.label}</span>{['offerings','events'].includes(item.id) && <span>{draft[item.id].length}</span>}</button>)}</nav>
        <div ref={panel} className={styles.editorPanel}>
          {!preview && <div className={styles.panelHeading}><Icon name={activeSection.icon} size={44} /><div><h3>{activeSection.label}</h3><p>{activeSection.description}</p></div></div>}
          {!preview && section === 'action' && <>
      <fieldset disabled={busy}><legend>Main Customer Action</legend><label>Button label<select ref={actionField} value={draft.primary_action.label} onChange={event => update('primary_action',{ ...draft.primary_action,label:event.target.value })}><option value="">Choose an action</option>{ACTION_LABELS.map(label => <option key={label}>{label}</option>)}</select></label><label>Destination link<input value={draft.primary_action.url} inputMode="url" maxLength={2000} placeholder="https://your-business.com/book" onChange={event => update('primary_action',{ ...draft.primary_action,url:event.target.value })} /></label></fieldset>
      </>}
      {!preview && section === 'visitors' && <fieldset disabled={busy}><legend>Specialties & Visitor Information</legend>{headingControl('specialties')}<div className={styles.checks}>{SPECIALTIES.map(item => <label key={item}><input type="checkbox" checked={draft.specialties.includes(item)} onChange={event => update('specialties',event.target.checked ? [...draft.specialties,item] : draft.specialties.filter(value => value !== item))} />{item}</label>)}</div><label>Languages<input value={draft.languages} maxLength={200} onChange={event => update('languages',event.target.value)} /></label><label>Access information<textarea value={draft.access_notes} maxLength={1000} placeholder="Describe entrances, steps, seating, or how to ask about access. Share facts visitors can use." onChange={event => update('access_notes',event.target.value)} /></label></fieldset>
      }
      {!preview && section === 'announcement' && <fieldset disabled={busy}><legend>Current Announcement or Seasonal Offer</legend><label>Title<input ref={announcementField} value={draft.announcement.title} maxLength={120} onChange={event => update('announcement',{ ...draft.announcement,title:event.target.value })} /></label><label>Message<textarea value={draft.announcement.body} maxLength={1000} onChange={event => update('announcement',{ ...draft.announcement,body:event.target.value })} /></label><div className={styles.row}><label>Learn-more link (optional)<input value={draft.announcement.url} inputMode="url" maxLength={2000} onChange={event => update('announcement',{ ...draft.announcement,url:event.target.value })} /></label><label>Offer code (optional)<input value={draft.announcement.code} maxLength={40} onChange={event => update('announcement',{ ...draft.announcement,code:event.target.value })} /></label></div><p className={styles.hint}>Dates use {deviceZone}. An empty start means immediately. Expired announcements are hidden automatically.</p><div className={styles.row}><label>Starts<input type="datetime-local" value={localTime(draft.announcement.starts_at)} onChange={event => update('announcement',{ ...draft.announcement,starts_at:isoTime(event.target.value) })} /></label><label>Ends<input type="datetime-local" value={localTime(draft.announcement.expires_at)} required={!!draft.announcement.title} onChange={event => update('announcement',{ ...draft.announcement,expires_at:isoTime(event.target.value) })} /></label></div></fieldset>
      }
      {!preview && section === 'offerings' && items('offerings',false)}
      {!preview && section === 'events' && items('events',true)}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      </div></div>
      <footer><span className={styles.saveHint}>Changes publish together.</span><button type="button" className="button" aria-label="Preview Highlights" disabled={busy} onClick={() => { try { setPreview(preparedDraft()); setError(''); panel.current?.closest('dialog')?.scrollTo({ top: 0 }); } catch(failure) { setError(failure.message); } }}>Preview</button><button className="button" aria-label="Publish Highlights" disabled={busy}>{busy ? 'Publishing…' : 'Publish Changes'}</button></footer>
    </form>
  </Modal></>;
}
GrowthEditor.propTypes = { onPreview:PropTypes.func.isRequired, previewTargetId:PropTypes.string.isRequired, initialSection: PropTypes.string, place:PropTypes.object.isRequired,access:PropTypes.object.isRequired,onClose:PropTypes.func.isRequired,onSaved:PropTypes.func.isRequired };
