import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../Icons/Icon';
import Modal from '../Modal/Modal';
import { categories } from '../../utilities/placeFilters';
import { createPlaceDraft, placeSlug, preparePlaceContent } from '../../utilities/placeContent';
import { geocodePublishedPlace, managementAction, managementRpc } from '../../utilities/managementApi';
import { getPlacesSnapshot, refreshPlaces, updatePublishedPlace } from '../../utilities/placesStore';
import { PHOTO_LIMIT, validatePhotoFile } from '../../../supabase/functions/_shared/entitlements.js';
import styles from './management.module.scss';
import { useAuth } from '../../contexts/AuthContext';
import { clearEditorDraft, readEditorDraft, saveEditorDraft } from '../../utilities/placeEditorDraft';

const fields = [
  ['name', 'Place name', 200], ['tagline', 'Tagline', 2000], ['website', 'Website', 2000], ['phone', 'Phone', 100],
  ['address', 'Street address', 500], ['city', 'City', 200], ['state', 'State or region', 200], ['zip', 'ZIP or postal code', 100],
];

export default function PlaceEditor({ place = null, initialContent = null, onClose, onPublished, onNotice = () => {} }) {
  const titleId = useId();
  const { user } = useAuth();
  const userId = user?.id;
  const creating = !place;
  const [requestId] = useState(() => crypto.randomUUID());
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [source, setSource] = useState(null);
  const [draft, setDraft] = useState(null);
  const [initial, setInitial] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [preview, setPreview] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [restored, setRestored] = useState(false);
  const dirty = (draft && JSON.stringify(draft) !== initial) || (creating && slug !== '');
  useEffect(() => {
    let active = true;
    setLoading(true);
    if (creating) {
      const next = createPlaceDraft({ category_ids: [], photos: [], ...initialContent });
      if (initialContent?.name) setSlug(placeSlug(initialContent.name));
      setDraft(next); setInitial(JSON.stringify(next)); setLoading(false);
      return () => { active = false; };
    }
    managementRpc('get_editable_place', { p_place_id: String(place.id) }).then(fresh => {
      if (!active) return;
      const next = createPlaceDraft(fresh);
      const saved = attempt === 0 ? readEditorDraft(userId, place.id) : null;
      const recovered = saved ? createPlaceDraft(saved.draft) : next;
      const changed = saved && saved.version !== Number(fresh.content_version);
      setSource(saved ? { ...fresh, content_version: saved.version } : fresh); setDraft(recovered); setInitial(JSON.stringify(next)); setConflict(!!changed); setRestored(!!saved);
      setError(changed ? 'Your draft was recovered, but the published listing has changed. Copy any details you want to keep before reloading the latest version.' : '');
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [place?.id, creating, attempt, initialContent, userId]);
  useEffect(() => {
    if (!creating && dirty && source && !loading) saveEditorDraft(userId, place.id, draft, source.content_version);
  }, [creating, dirty, source, loading, userId, place?.id, draft]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (!preview) return;
    const target = document.getElementById(`${titleId}-preview`);
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }, [preview, titleId]);
  const close = () => {
    if (busy) return;
    if (!dirty || window.confirm('Discard your unpublished changes?')) { if (!creating) clearEditorDraft(userId, place.id); onClose(); }
  };
  const update = (field, value) => { if (creating && field === 'name' && !slugTouched) setSlug(placeSlug(value)); setDraft(previous => ({ ...previous, [field]: value })); setPreview(false); };
  const upload = async event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    try {
      if (draft.photos.length + files.length > PHOTO_LIMIT) throw new Error('Use up to 10 photos. Remove a photo before adding another.');
      files.forEach(validatePhotoFile);
      setBusy(true);
      for (let index = 0; index < files.length; index++) {
        setUploadProgress({ completed: index, total: files.length });
        const form = new FormData(); form.set('file', files[index]);
        const { url } = await managementAction('upload', place.id, form);
        setDraft(previous => ({ ...previous, photos: [...previous.photos, url], coverPhoto: previous.coverPhoto || url }));
      }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); setUploadProgress(null); }
  };
  const publish = async event => {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      const content = preparePlaceContent(draft);
      const published = creating
        ? await managementRpc('admin_create_place', { p_content: content, p_slug: slug, p_request_id: requestId })
        : await managementRpc('publish_place', { p_place_id: String(place.id), p_content: content, p_expected_version: source.content_version });
      if (!creating) clearEditorDraft(userId, place.id);
      updatePublishedPlace(published);
      // The write has committed. Directory retries and geocoding must not keep
      // the editor open or make a successful save look like a failed publish.
      onPublished(creating ? 'Place created. Add photos or continue editing below.' : 'Your changes are saved.', published);
      onClose();
      void (async () => {
        const notice = await geocodePublishedPlace(published);
        let refreshNotice = '';
        try { await refreshPlaces(); } catch { refreshNotice = 'Your changes are saved. The directory could not refresh; reload the page to check the latest listing.'; }
        if (getPlacesSnapshot().error) refreshNotice = 'Your changes are saved. The directory could not refresh; reload the page to check the latest listing.';
        if (refreshNotice || notice) onNotice(refreshNotice || notice);
      })();
    } catch (failure) {
      setError(failure.message || 'Unable to publish. Your changes are still here.');
      setConflict(failure.code === 'PT409');
    } finally { setBusy(false); }
  };
  const removePhoto = photo => {
    const photos = draft.photos.filter(item => item !== photo);
    setDraft(previous => ({ ...previous, photos, coverPhoto: previous.coverPhoto === photo ? photos[0] || '' : previous.coverPhoto }));
    setPreview(false);
  };
  const movePhoto = (index, direction) => {
    const photos = [...draft.photos];
    [photos[index], photos[index + direction]] = [photos[index + direction], photos[index]];
    update('photos', photos);
  };
  const goToSection = section => {
    const target = document.getElementById(`${titleId}-${section}`);
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  };
  const input = key => {
    const [field, label, maxLength] = fields.find(([name]) => name === key);
    return <label key={field}>{label}<input value={draft[field]} onChange={event => update(field, event.target.value)} maxLength={maxLength} required={field === 'name'} type={field === 'phone' ? 'tel' : 'text'} inputMode={field === 'website' ? 'url' : undefined} /></label>;
  };
  return <Modal open onClose={close} labelledBy={titleId} closeLabel="Close place editor" className={styles.editorDialog} contentClassName={styles.editorBody}>
    <header className={styles.editorHeader}><p className={styles.editorEyebrow}><Icon name="shop" size={24} /> Listing editor</p><h2 id={titleId} className={styles.editorHeading}>{creating ? 'Add Place' : `Edit ${place.name}`}</h2><p>{creating ? 'Start with the essentials. You can add photos once your listing is created.' : 'Make it yours. Your changes go live when you publish.'}</p></header>
    {loading ? <p className={styles.editorLoading} role="status">Loading the latest version…</p> : draft ? <>
      <nav className={styles.editorNav} aria-label="Editor sections">{[['about', 'About'], ['location', 'Visit details'], ['links', 'Links'], ...(!creating ? [['photos', 'Photos']] : [])].map(([id, label]) => <button key={id} type="button" onClick={() => goToSection(id)}>{label}</button>)}</nav>
      <form className={`${styles.form} ${styles.editorForm}`} onSubmit={publish}>
        <div className={styles.editorScroll}>
          {restored && <p role="status" className={styles.notice}>Your unpublished draft was recovered from this tab. It has not been published.</p>}
          {creating && <fieldset className={styles.editorSection} disabled={busy}><legend>Public URL</legend><label>URL slug<input value={slug} onChange={event => { setSlugTouched(true); setSlug(event.target.value); }} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={200} placeholder="the-little-herb-shop" /></label><p className={styles.editorHint}>littleherbplaces.com/place/{slug || 'your-place'}</p></fieldset>}
          <fieldset className={styles.editorSection} id={`${titleId}-about`} tabIndex={-1} disabled={busy}>
            <legend>About your place</legend><p className={styles.editorHint}>Introduce your place and what makes it special.</p>
            <div className={styles.formRow}>{input('name')}{input('tagline')}</div>
            <label>Description<textarea value={draft.description} onChange={event => update('description', event.target.value)} maxLength={20000} rows={6} placeholder="Tell visitors about your place, your approach, and what they’ll find here." /></label>
            <div className={styles.editorCategoryGroup} role="group" aria-label="Categories"><h3>Categories</h3><p className={styles.editorHint}>Choose the categories that fit your place.</p><div className={styles.editorCategories}>{categories.map(category => <label key={category.id} className={styles.editorCategory}><input type="checkbox" checked={draft.category_ids.includes(category.id)} onChange={event => update('category_ids', event.target.checked ? [...draft.category_ids, category.id] : draft.category_ids.filter(id => id !== category.id))} /><Icon name={category.icon} size={26} /><span>{category.name}</span></label>)}</div></div>
          </fieldset>
          <fieldset className={styles.editorSection} id={`${titleId}-location`} tabIndex={-1} disabled={busy}>
            <legend>Visit & contact details</legend><p className={styles.editorHint}>Help visitors find you and plan their visit.</p>
            <div className={styles.formRow}>{input('website')}{input('phone')}</div>
            {input('address')}
            <div className={styles.editorLocationRow}>{input('city')}{input('state')}{input('zip')}</div>
            <label>Opening hours<textarea value={draft.hours} onChange={event => update('hours', event.target.value)} maxLength={2000} rows={3} placeholder="Monday–Friday: 10 am–6 pm" /></label>
          </fieldset>
          <fieldset className={styles.editorSection} id={`${titleId}-links`} tabIndex={-1} disabled={busy}><legend>Links</legend><p className={styles.editorHint}>Connect visitors to your booking page, menu, shop, or social profiles.</p>
            {!draft.social_links.length && <p className={styles.editorEmpty}>No extra links yet. Add one when you’re ready.</p>}
            {draft.social_links.map((link, index) => <div className={styles.editorLinkCard} key={index}><div className={styles.editorLinkHeading}><span>Link {index + 1}</span><button type="button" className={styles.editorRemove} onClick={() => update('social_links', draft.social_links.filter((_, i) => i !== index))}>Remove link {index + 1}</button></div><div className={styles.formRow}><label>Link text<input value={link.label} maxLength={80} placeholder="Book a consultation" onChange={event => update('social_links', draft.social_links.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label><label>Link URL<input value={link.url} maxLength={2000} inputMode="url" placeholder="yourplace.com/book" onChange={event => update('social_links', draft.social_links.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /></label></div></div>)}
            {draft.social_links.length < 10 && <button className={styles.editorSecondary} type="button" onClick={() => update('social_links', [...draft.social_links, { label: '', url: '' }])}><Icon name="link" size={16} /> Add Link</button>}
          </fieldset>
          {!creating && <fieldset className={styles.editorSection} id={`${titleId}-photos`} tabIndex={-1} disabled={busy}><legend>Photos <span className={styles.editorPhotoCount}>{draft.photos.length} / {PHOTO_LIMIT}</span></legend><p className={styles.editorHint}>Choose a welcoming cover photo, then show visitors around your space.</p>
            <label className={styles.editorUpload}><Icon name="polaroid" size={42} /><strong>Add photos</strong><span>Choose JPEG, PNG, or WebP images · Up to 10 MB each</span><input aria-label="Add photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} /></label>
            {uploadProgress && <div role="status" className={styles.editorUploadProgress}><p>Uploading photo {uploadProgress.completed + 1} of {uploadProgress.total}…</p><progress value={uploadProgress.completed} max={uploadProgress.total} aria-label="Photos uploaded" /></div>}
            <div className={styles.photoGrid}>{draft.photos.map((photo, index) => <div className={`${styles.photo} ${styles.editorPhoto}`} key={photo}>
              <div className={styles.editorPhotoImage}><img src={photo} alt={draft.photo_alt[photo] || `Place photo ${index + 1}`} />{draft.coverPhoto === photo && <span>Cover photo</span>}</div>
              <label className={styles.check}><input type="radio" name="cover" checked={draft.coverPhoto === photo} onChange={() => update('coverPhoto', photo)} />Use as cover photo</label>
              <label>Photo description<input value={draft.photo_alt[photo] || ''} maxLength={500} placeholder="Describe what’s in this photo" onChange={event => update('photo_alt', { ...draft.photo_alt, [photo]: event.target.value })} /></label>
              <div className={styles.editorPhotoActions}><div><button type="button" className={styles.editorPhotoMove} aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => movePhoto(index, -1)}>←</button><button type="button" className={styles.editorPhotoMove} aria-label={`Move photo ${index + 1} later`} disabled={index === draft.photos.length - 1} onClick={() => movePhoto(index, 1)}>→</button></div><button type="button" className={styles.editorRemove} onClick={() => removePhoto(photo)}>Remove</button></div>
            </div>)}</div><p className={styles.editorHint}>Up to 10 photos. Reorder with the arrows. Removed photos disappear when you publish.</p>
          </fieldset>}
          {preview && <section id={`${titleId}-preview`} tabIndex={-1} className={`${styles.preview} ${styles.editorPreview}`} aria-label="Place preview"><p className={styles.editorEyebrow}>Preview · Unpublished</p><h3>{draft.name}</h3>{draft.coverPhoto && <img src={draft.coverPhoto} alt={draft.photo_alt[draft.coverPhoto] || draft.name} />}<p>{draft.tagline}</p><p>{draft.description}</p><p>{[draft.address, draft.city, draft.state, draft.zip].filter(Boolean).join(', ')}</p>{draft.hours && <p>{draft.hours}</p>}{draft.phone && <p>{draft.phone}</p>}{draft.website && <p>{draft.website}</p>}{draft.social_links.map((link, index) => <p key={index}>{link.label}: {link.url}</p>)}</section>}
        </div>
        {error && <div className={styles.editorFeedback}><p role="alert" className={styles.error}>{error}</p>{conflict && <button className={styles.editorSecondary} type="button" disabled={busy} onClick={() => { if (window.confirm('Reload the latest version and discard your unpublished changes?')) { clearEditorDraft(userId, place.id); setAttempt(value => value + 1); } }}>Reload Latest Version</button>}</div>}
        <footer className={styles.editorFooter}><p className={styles.editorSaveStatus}>{uploadProgress ? 'Uploading photos…' : busy ? creating ? 'Creating your place…' : 'Publishing changes…' : dirty ? 'Unpublished changes' : 'No unpublished changes'}</p><div><button type="button" className={styles.editorCancel} disabled={busy} onClick={close}>Cancel</button><button type="button" className={styles.editorSecondary} disabled={busy} onClick={() => setPreview(value => !value)}>{preview ? 'Hide Preview' : 'Preview Changes'}</button><button className={`button ${styles.editorPublish}`} disabled={busy || !dirty || conflict}>{busy && !uploadProgress ? creating ? 'Creating…' : 'Publishing…' : creating ? 'Create Place & Add Photos' : 'Publish Changes'}</button></div></footer>
      </form>
    </> : <div className={styles.editorLoading}><p role="alert" className={styles.error}>{error}</p><button className="button" onClick={() => setAttempt(value => value + 1)}>Try Again</button></div>}
  </Modal>;
}
PlaceEditor.propTypes = { place: PropTypes.object, initialContent: PropTypes.object, onClose: PropTypes.func.isRequired, onPublished: PropTypes.func.isRequired, onNotice: PropTypes.func };
