import { publicGrowth } from './placeGrowth.js';

export function discoveryItems(places, profiles, now = Date.now()) {
  const byId = new Map(places.map(place => [String(place.id),place]));
  return profiles.flatMap(profile => {
    const place = byId.get(String(profile.place_id));
    if (!place || profile.operating_status === 'permanently_closed') return [];
    const content = publicGrowth(profile,now);
    return [...content.offerings.map(item => ({ ...item,event:false })),...content.events.map(item => ({ ...item,event:true }))].map(item => ({ ...item,place,specialties:content.specialties,path:`/discover/${item.event ? 'events' : 'offerings'}/${place.urlSlug}/${item.id}` }));
  }).sort((a,b) => Number(b.event)-Number(a.event) || (a.event ? Date.parse(a.starts_at)-Date.parse(b.starts_at) : a.title.localeCompare(b.title)));
}

export function filterDiscovery(items, query = '', kind = '') {
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!kind || (kind==='events' ? item.event : !item.event && item.kind===kind)) && words.every(word => [item.title,item.description,item.place.name,item.place.city,item.place.state,...item.specialties].join(' ').toLowerCase().includes(word)));
}
