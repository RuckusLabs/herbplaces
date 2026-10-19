import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { categories } from '../../utilities/placeFilters';
import { createPlaceDraft, placeSlug, preparePlaceContent } from '../../utilities/placeContent';
import { geocodePublishedPlace, managementAction, managementRpc } from '../../utilities/managementApi';
import { refreshPlaces, updatePublishedPlace } from '../../utilities/placesStore';
import { PHOTO_LIMIT, validatePhotoFile } from '../../../supabase/functions/_shared/entitlements.js';
import styles from './management.module.scss';

const fields = [
  ['name', 'Place name', 200], ['tagline', 'Tagline', 2000], ['website', 'Website', 2000], ['phone', 'Phone', 100],
  ['address', 'Street address', 500], ['city', 'City', 200], ['state', 'State or region', 200], ['zip', 'ZIP or postal code', 100],
];

export default function PlaceEditor({ place = null, onClose, onPublished }) {
  const titleId = useId();
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
  const dirty = (draft && JSON.stringify(draft) !== initial) || (creating && slug !== '');
  useEffect(() => {
    let active = true;
    setLoading(true);
    if (creating) {
      const next = createPlaceDraft({ category_ids: [], photos: [] });
      setDraft(next); setInitial(JSON.stringify(next)); setLoading(false);
      return () => { active = false; };
    }
    managementRpc('get_editable_place', { p_place_id: String(place.id) }).then(fresh => {
      if (!active) return;
      const next = createPlaceDraft(fresh);
      setSource(fresh); setDraft(next); setInitial(JSON.stringify(next)); setConflict(false); setError('');
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [place?.id, creating, attempt]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  const close = () => {
    if (busy) return;
    if (!dirty || window.confirm('Discard your unpublished changes?')) onClose();
  };
  const update = (field, value) => { if (creating && field === 'name' && !slugTouched) setSlug(placeSlug(value)); setDraft(previous => ({ ...previous, [field]: value })); setPreview(false); };
  const upload = async event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    try {
      if (draft.photos.length + files.length > Math.max(PHOTO_LIMIT, source.photos?.length || 0)) throw new Error('Use up to 20 photos. Remove a photo before adding another.');
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
      updatePublishedPlace(published);
      const notice = await geocodePublishedPlace(published);
      await refreshPlaces();
      onPublished(notice || (creating ? 'Place created. Add photos or continue editing below.' : 'Your changes are live.'), published);
      onClose();
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
  return <Modal open onClose={close} labelledBy={titleId} closeLabel="Close place editor" className={styles.editorDialog} contentClassName={styles.editorBody}>
    <h2 id={titleId} className={styles.editorHeading}>{creating ? 'Add Place' : `Edit ${place.name}`}</h2>
    <p className={styles.small}>{creating ? 'Create a new listing, then add photos on the next screen. The place will be live when you create it.' : 'Preview your changes, then publish them directly to your place.'}</p>
    {loading ? <p role="status">Loading the latest version…</p> : draft ? <form className={styles.form} onSubmit={publish}>
      {creating && <fieldset disabled={busy}><legend>Public URL</legend><label>URL slug<input value={slug} onChange={event => { setSlugTouched(true); setSlug(event.target.value); }} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={200} placeholder="the-little-herb-shop" /></label><p className={styles.small}>littleherbplaces.com/place/{slug || 'your-place'}</p></fieldset>}
      <fieldset disabled={busy}>
        <legend>About your place</legend>
        <div className={styles.formRow}>{fields.map(([field, label, maxLength]) => <label key={field}>{label}<input value={draft[field]} onChange={event => update(field, event.target.value)} maxLength={maxLength} required={field === 'name'} type={field === 'phone' ? 'tel' : 'text'} /></label>)}</div>
        <label>Description<textarea value={draft.description} onChange={event => update('description', event.target.value)} maxLength={20000} rows={7} /></label>
        <label>Opening hours<textarea value={draft.hours} onChange={event => update('hours', event.target.value)} maxLength={2000} placeholder="Monday–Friday: 10 am–6 pm" /></label>
      </fieldset>
      <fieldset disabled={busy}><legend>Categories</legend>{categories.map(category => <label className={styles.check} key={category.id}><input type="checkbox" checked={draft.category_ids.includes(category.id)} onChange={event => update('category_ids', event.target.checked ? [...draft.category_ids, category.id] : draft.category_ids.filter(id => id !== category.id))} />{category.name}</label>)}</fieldset>
      <fieldset disabled={busy}><legend>Links</legend><p className={styles.small}>Add any website, booking page, menu, or social profile. Choose the text visitors will see.</p>
        {draft.social_links.map((link, index) => <div className={styles.linkCard} key={index}><div className={styles.formRow}><label>Link text<input value={link.label} maxLength={80} placeholder="Book a consultation" onChange={event => update('social_links', draft.social_links.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label><label>Link URL<input value={link.url} maxLength={2000} onChange={event => update('social_links', draft.social_links.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /></label></div><button type="button" className="button" onClick={() => update('social_links', draft.social_links.filter((_, i) => i !== index))}>Remove link {index + 1}</button></div>)}
        {draft.social_links.length < 10 && <button className="button" type="button" onClick={() => update('social_links', [...draft.social_links, { label: '', url: '' }])}>Add Link</button>}
      </fieldset>
      {!creating && <fieldset disabled={busy}><legend>Photos</legend><p className={styles.small}>Up to 20 photos. JPEG, PNG, or WebP, no larger than 10 MB each. Removed photos disappear when you publish.</p>
        <label>Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} /></label>
        <div className={styles.photoGrid}>{draft.photos.map((photo, index) => <div className={styles.photo} key={photo}>
          <img src={photo} alt={draft.photo_alt[photo] || `Place photo ${index + 1}`} />
          <label className={styles.check}><input type="radio" name="cover" checked={draft.coverPhoto === photo} onChange={() => update('coverPhoto', photo)} />Cover photo</label>
          <label>Photo description<input value={draft.photo_alt[photo] || ''} maxLength={500} onChange={event => update('photo_alt', { ...draft.photo_alt, [photo]: event.target.value })} /></label>
          <div className={styles.actions}><button type="button" className="button" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => movePhoto(index, -1)}>←</button><button type="button" className="button" aria-label={`Move photo ${index + 1} later`} disabled={index === draft.photos.length - 1} onClick={() => movePhoto(index, 1)}>→</button><button type="button" className="button" onClick={() => removePhoto(photo)}>Remove</button></div>
        </div>)}</div>
      </fieldset>}
      {uploadProgress && <div role="status"><p>Uploading photo {uploadProgress.completed + 1} of {uploadProgress.total}…</p><progress value={uploadProgress.completed} max={uploadProgress.total} aria-label="Photos uploaded" /></div>}
      {preview && <section className={styles.preview} aria-label="Place preview"><h3>{draft.name}</h3>{draft.coverPhoto && <img src={draft.coverPhoto} alt={draft.photo_alt[draft.coverPhoto] || draft.name} />}<p>{draft.tagline}</p><p>{draft.description}</p><p>{[draft.address, draft.city, draft.state, draft.zip].filter(Boolean).join(', ')}</p>{draft.hours && <p>{draft.hours}</p>}{draft.phone && <p>{draft.phone}</p>}{draft.website && <p>{draft.website}</p>}{draft.social_links.map((link, index) => <p key={index}>{link.label}: {link.url}</p>)}</section>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {conflict && <button className="button" type="button" disabled={busy} onClick={() => { if (window.confirm('Reload the latest version and discard your unpublished changes?')) setAttempt(value => value + 1); }}>Reload Latest Version</button>}
      <div className={styles.actions}><button type="button" className="button" disabled={busy} onClick={() => setPreview(value => !value)}>{preview ? 'Hide Preview' : 'Preview Changes'}</button><button className="button" disabled={busy || !dirty || conflict}>{busy && !uploadProgress ? creating ? 'Creating…' : 'Publishing…' : creating ? 'Create Place & Add Photos' : 'Publish Changes'}</button><button type="button" className="button" disabled={busy} onClick={close}>Cancel</button></div>
    </form> : <><p role="alert" className={styles.error}>{error}</p><button className="button" onClick={() => setAttempt(value => value + 1)}>Try Again</button></>}
  </Modal>;
}
PlaceEditor.propTypes = { place: PropTypes.object, onClose: PropTypes.func.isRequired, onPublished: PropTypes.func.isRequired };
