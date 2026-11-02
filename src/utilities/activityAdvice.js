export { activityAdvice } from '../../supabase/functions/_shared/activityAdvice.js';

export function readableReportRange(from, through) {
  const format = value => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date) : value;
  };
  return `${format(from)} – ${format(through)}`;
}
