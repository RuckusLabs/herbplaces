import { getWebsiteUrl } from './placeDetails.js';

export const SPECIALTIES = ['Bulk herbs', 'Custom blends', 'Herbal consultations', 'Workshops', 'Tea', 'Body care', 'Plants & seeds', 'Online shopping', 'Shipping', 'Local pickup'];
export const ACTION_LABELS = ['Book a consultation', 'Shop online', 'See upcoming classes', 'Contact us'];
export const ACTIVITY_KINDS = ['profile_view', 'website_click', 'directions_click', 'phone_click', 'primary_click', 'announcement_click', 'offering_click', 'event_click'];
export const ACTIVITY_LABELS = { profile_view: 'Profile views', website_click: 'Website clicks', directions_click: 'Direction clicks', phone_click: 'Phone-link clicks', primary_click: 'Main action clicks', announcement_click: 'Announcement clicks', offering_click: 'Offering clicks', event_click: 'Event registration clicks' };
export const emptyGrowth = () => ({ primary_action: { label: '', url: '' }, specialties: [], languages: '', access_notes: '', announcement: { title: '', body: '', url: '', code: '', starts_at: '', expires_at: '' }, offerings: [], events: [] });
const text = (value, max) => String(value || '').trim().slice(0, max);
const link = value => { if (!String(value || '').trim()) return ''; const url = getWebsiteUrl(value); if (!url) throw new Error('Use a valid HTTP or HTTPS link.'); return url; };
const instant = value => { if (!value) return ''; if (!Number.isFinite(Date.parse(value))) throw new Error('Choose a valid date and time.'); return new Date(value).toISOString(); };

export function prepareGrowth(input, photos = []) {
  const base = emptyGrowth();
  const action = input.primary_action || base.primary_action;
  if (action.url && !ACTION_LABELS.includes(action.label)) throw new Error('Choose a label for your main action.');
  const announcement = { ...base.announcement, ...input.announcement };
  const starts = instant(announcement.starts_at); const expires = instant(announcement.expires_at);
  if (announcement.title?.trim() && !expires) throw new Error('Choose when your announcement ends.');
  if (starts && expires && Date.parse(starts) >= Date.parse(expires)) throw new Error('Your announcement must end after it starts.');
  if ((input.offerings?.length || 0) > 10 || (input.events?.length || 0) > 10) throw new Error('Use up to 10 offerings and 10 events.');
  const itemIds = new Set();
  const prepareItem = (item, event) => {
    if (!item.title?.trim()) throw new Error('Give each offering or event a title.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id || '') || itemIds.has(item.id)) throw new Error('Each item needs a unique identifier. Remove it and add it again.');
    itemIds.add(item.id);
    const url = link(item.url);
    if (!url) throw new Error('Add a booking, registration, or shopping link for each item.');
    const image = photos.includes(item.image) ? item.image : '';
    const result = { id: item.id, title: text(item.title, 120), description: text(item.description, 1500), price: text(item.price, 100), url, image, image_alt: text(item.image_alt, 300) };
    if (event) {
      const starts_at = instant(item.starts_at); const ends_at = instant(item.ends_at);
      if (!starts_at || !ends_at || Date.parse(starts_at) >= Date.parse(ends_at)) throw new Error('Events need a start and a later end time.');
      const timezone = text(item.timezone, 80);
      try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new Error('Choose a valid event time zone, such as America/Denver.'); }
      return { ...result, starts_at, ends_at, timezone, location: text(item.location, 300) };
    }
    return { ...result, kind: item.kind === 'service' ? 'service' : 'product' };
  };
  return { primary_action: { label: action.url ? action.label : '', url: link(action.url) },
    specialties: SPECIALTIES.filter(item => input.specialties?.includes(item)), languages: text(input.languages, 200), access_notes: text(input.access_notes, 1000),
    announcement: { title: text(announcement.title, 120), body: text(announcement.body, 1000), code: text(announcement.code, 40), url: link(announcement.url), starts_at: starts, expires_at: expires },
    offerings: (input.offerings || []).map(item => prepareItem(item, false)), events: (input.events || []).map(item => prepareItem(item, true)) };
}

export function publicGrowth(record, now = Date.now()) {
  const content = { ...emptyGrowth(), ...record?.content };
  if (record?.operating_status === 'permanently_closed') return { ...content, primary_action: { label: '', url: '' }, announcement: null, offerings: [], events: [] };
  const announcement = content.announcement;
  const active = announcement?.title && Date.parse(announcement.expires_at) > now && (!announcement.starts_at || Date.parse(announcement.starts_at) <= now);
  return { ...content, announcement: active ? announcement : null, events: (content.events || []).filter(event => Date.parse(event.ends_at) > now) };
}

export function profileChecklist(place, growth) {
  const content = growth?.content || emptyGrowth();
  return [
    { label: 'Introduce your place with a description', done: !!place.description?.trim() },
    { label: 'Add a photo of your place', done: !!place.coverPhoto && !place.coverPhoto.startsWith('/assets/') },
    { label: 'Share current hours', done: !!place.hours?.trim() },
    { label: 'Add a phone number or website', done: !!(place.phone || place.website) },
    { label: 'Choose your main customer action', done: !!content.primary_action?.url },
    { label: 'Add your specialties', done: !!content.specialties?.length },
  ];
}

export function activityCsv(report) {
  const header = ['Date (UTC)', ...ACTIVITY_KINDS.map(key => ACTIVITY_LABELS[key])];
  return [header.join(','), ...(report?.daily || []).map(row => [row.day, ...ACTIVITY_KINDS.map(key => Number(row[key] || 0))].join(','))].join('\r\n');
}
