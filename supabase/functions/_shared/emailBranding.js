export const emailLogoUrl = 'https://qtpepsebztlremlhpxdt.supabase.co/storage/v1/object/public/brand-assets/little-herb-places-logo-v1.png';
export function escapeEmailHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// bodyHtml must be trusted template markup or escaped with textEmailHtml below.
export function brandedEmail({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeEmailHtml(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f8faf3;color:#2c542f;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;border:1px solid #c0d16b;border-radius:20px;background:#ffffff;overflow:hidden;">
<tr><td align="center" bgcolor="#f8faf3" style="padding:28px 24px 24px;border-bottom:5px solid #eaff82;background:#f8faf3;"><a href="https://littleherbplaces.com" style="display:inline-block;color:#2c542f;"><img src="${emailLogoUrl}" width="112" height="91" alt="Little Herb Places" style="display:block;width:112px;height:91px;border:0;"></a></td></tr>
<tr><td style="padding:28px 28px 20px;color:#2c542f;font-size:15px;line-height:1.75;">
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.2;color:#2c542f;">${escapeEmailHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td bgcolor="#f8faf3" style="padding:22px 28px;border-top:1px solid #c0d16b;background:#f8faf3;color:#2c542f;text-align:center;font-size:12px;line-height:1.7;">
<p style="margin:0 0 10px;">Rooted in nature.<br>Connected through community.</p>
<p style="margin:0;"><a href="https://littleherbplaces.com" style="color:#2c542f;text-decoration:underline;">Little Herb Places</a> &nbsp;·&nbsp; <a href="mailto:help@littleherbplaces.com" style="color:#2c542f;text-decoration:underline;">Need a hand?</a></p>
</td></tr></table></body></html>`;
}

export function textEmailHtml(title, text) {
  const bodyHtml = text.split('\n\n').map(paragraph => `<p style="margin:0 0 18px;overflow-wrap:anywhere;">${escapeEmailHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('\n');
  return brandedEmail({ title, bodyHtml });
}
