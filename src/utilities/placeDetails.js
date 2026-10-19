export function getPlacePhotos(place) {
  const photos = Array.isArray(place?.photos) ? place.photos.filter(photo => typeof photo === 'string' && photo.trim()) : [];
  return [...new Set(photos.length ? photos : [place?.coverPhoto || '/assets/pages/home/hero.jpg'])];
}

export function getWebsiteUrl(website) {
  if (typeof website !== 'string' || !website.trim()) return null;
  try {
    const value = website.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch { return null; }
}
