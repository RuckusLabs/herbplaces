import { getWebsiteUrl } from './placeDetails.js';
import { getPlaceCategories } from './placeFilters.js';

export const editableFields = ['name', 'tagline', 'description', 'website', 'address', 'city', 'state', 'zip', 'phone', 'hours'];

export function createPlaceDraft(place) {
  const content = Object.fromEntries(editableFields.map(field => [field, String(place?.[field] ?? '')]));
  const photos = [...new Set((Array.isArray(place?.photos) && place.photos.length ? place.photos : [place?.coverPhoto]).filter(Boolean))];
  return { ...content, photos,
    coverPhoto: photos.includes(place?.coverPhoto) ? place.coverPhoto : photos[0] || '',
    photo_alt: { ...(place?.photo_alt || {}) },
    social_links: (place?.social_links || []).map(link => ({ ...link })),
    category_ids: Array.isArray(place?.category_ids) ? [...place.category_ids] : getPlaceCategories(place || {}).map(category => category.id),
  };
}

export function preparePlaceContent(draft) {
  const content = { ...draft, ...Object.fromEntries(editableFields.map(field => [field, draft[field].trim()])) };
  if (!content.name) throw new Error('Add a name for this place.');
  if (content.website) {
    const url = getWebsiteUrl(content.website);
    if (!url) throw new Error('Enter a valid website address.');
    content.website = url;
  }
  content.social_links = draft.social_links.filter(link => link.label.trim() || link.url.trim()).map(link => {
    const url = getWebsiteUrl(link.url);
    if (!link.label.trim() || !url) throw new Error('Each link needs text and a valid website address.');
    return { label: link.label.trim(), url };
  });
  content.photos = [...new Set(draft.photos)];
  content.coverPhoto = content.photos.includes(draft.coverPhoto) ? draft.coverPhoto : content.photos[0] || '';
  content.photo_alt = Object.fromEntries(content.photos.map(photo => [photo, String(draft.photo_alt[photo] || '').trim().slice(0, 500)]));
  return content;
}

export function placeSlug(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200).replace(/-+$/g, '');
}
