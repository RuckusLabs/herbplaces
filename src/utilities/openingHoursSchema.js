import { getOpeningHours } from './placeDetails.js';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayIndex = value => days.findIndex(day => day.toLowerCase().startsWith(value.toLowerCase().replace(/\.$/, '')));
function time(value) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : !match[2] || hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Only publish unambiguous, complete schedules. Free text remains visible even
// when it cannot safely be converted to structured opening hours.
export function openingHoursSchema(hours) {
  const specifications = [];
  for (const line of getOpeningHours(hours)) {
    const match = line.match(/^([a-z]+)\.?\s*(?:[–—-]\s*([a-z]+)\.?)?\s*:\s*(.+)$/i);
    if (!match) return [];
    const first = dayIndex(match[1]); const last = match[2] ? dayIndex(match[2]) : first;
    if (first < 0 || last < 0) return [];
    const selected = [first];
    while (selected[selected.length - 1] !== last) selected.push((selected[selected.length - 1] + 1) % 7);
    const closed = /^closed$/i.test(match[3]);
    const range = match[3].split(/\s*[–—-]\s*/);
    const opens = closed ? '00:00' : time(range[0] || '');
    const closes = closed ? '00:00' : range.length === 2 ? time(range[1]) : null;
    if (!opens || !closes || (!closed && opens === closes)) return [];
    if (specifications.some(spec => spec.dayOfWeek.some(day => selected.some(index => day.endsWith(days[index]))))) return [];
    specifications.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: selected.map(index => `https://schema.org/${days[index]}`), opens, closes });
  }
  return specifications;
}
