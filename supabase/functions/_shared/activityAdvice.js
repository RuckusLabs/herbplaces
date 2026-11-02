// Shared by the owner tools and monthly emails. No inference about actual sales.
export function activityAdvice(report, profile, now = Date.now()) {
  const content = profile?.content || {};
  const announcement = content.announcement;
  if (announcement?.title && Date.parse(announcement.expires_at) <= now) return { text: 'Your announcement has expired. Share what’s new and link to the relevant page on your website.', action: 'Refresh Your Announcement', target: 'announcement' };
  if (!content.primary_action?.url) return { text: 'Give visitors a clear next step. Add a main button linked to your shop, booking page, or current classes.', action: 'Set Your Main Action', target: 'action' };
  if (!Number(report?.current?.profile_view || 0)) return { text: 'No profile views were recorded in this period. Share your listing link with your community so people can find your visit details and main action.', action: 'Copy Your Listing Link', target: 'share' };
  if (!Number(report?.current?.primary_click || 0)) return { text: 'People explored your profile without recorded clicks on its main button. Check that the label and destination offer a useful next step.', action: 'Review Your Main Action', target: 'action' };
  return { text: 'Your main action received interest. Give people a timely reason to return with a current announcement linked to what’s new.', action: 'Update Your Announcement', target: 'announcement' };
}
