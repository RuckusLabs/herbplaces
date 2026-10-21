export function getPlacePhotos(place) {
  const photos = Array.isArray(place?.photos) ? place.photos.filter(photo => typeof photo === 'string' && photo.trim()) : [];
  return [...new Set(photos.length ? photos : [place?.coverPhoto || '/assets/pages/home/hero.jpg'])];
}

export function getWebsiteUrl(website) {
  if (typeof website !== 'string' || !website.trim()) return null;
  try {
    const value = website.trim();
    const hostWithPort = /^(?:\[[a-f\d:.]+\]|[^:/?#\s]+):\d+(?:[/?#]|$)/i.test(value);
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value) && !hostWithPort;
    const url = new URL(hasScheme ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch { return null; }
}

export function getOpeningHours(hours) {
  if (typeof hours !== 'string') return [];
  // Split existing free-text schedules without breaking day ranges or time ranges.
  return hours.split(/\r?\n|;|\s*[•|]\s*|,\s*(?=(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day|sday|nesday|rsday|urday)?\b)|\.\s+(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)/i)
    .map(line => line.trim().replace(/^[•*-]\s+/, '')).filter(Boolean);
}
