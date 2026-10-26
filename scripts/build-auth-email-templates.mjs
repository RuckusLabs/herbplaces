import fs from 'node:fs';
import { brandedEmail } from '../supabase/functions/_shared/emailBranding.js';
const paragraph = text => `<p style="margin:0 0 18px;">${text}</p>`;
const code = `<p style="margin:22px 0 8px;padding:20px 8px;border-radius:12px;background:#eaff82;color:#2c542f;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;letter-spacing:6px;">{{ .Token }}</p>`;
const button = label => `<p style="margin:24px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 24px;border:1px solid #c0d16b;border-radius:28px;background:#eaff82;color:#2c542f;font-size:14px;font-weight:bold;text-decoration:none;">${label}</a></p>`;
const ignored = paragraph('If you didn’t request this email, you can ignore it.');
const templates = {
  'email-code': ['A little welcome.', paragraph('Enter this code on the page where you started signing in or creating your account.') + code + paragraph('Your code expires in 10 minutes. Use your most recent code, and keep it private.') + paragraph('If your page asks you to follow an email link instead, <a href="{{ .ConfirmationURL }}" style="color:#2c542f;text-decoration:underline;">continue to Little Herb Places</a>.') + ignored],
  'invite-user': ['You’re invited.', paragraph('You’ve been invited to Little Herb Places. Follow this secure link to continue to your account.') + button('Accept Invitation') + paragraph('If you weren’t expecting an invitation, you can ignore this email.')],
  'change-email': ['Confirm your email change.', paragraph('Confirm this email address for your Little Herb Places account.') + button('Confirm Email Address') + paragraph('For your security, confirm the change from both your current and new inboxes. Your current sign-in address stays in use until the change is complete.') + ignored],
  'reset-password': ['A little help signing in.', paragraph('Someone requested a password reset for your Little Herb Places account. Use this secure link to continue.') + button('Continue Securely') + paragraph('If the page offers email-code sign-in, you can return to your account without creating a password.') + ignored],
  'reauthentication': ['Confirm it’s you.', paragraph('Enter this code to confirm the account action you started on Little Herb Places.') + code + paragraph('Keep this code private and use only the most recent email.') + ignored],
};
for (const [name, [title, bodyHtml]] of Object.entries(templates)) fs.writeFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), brandedEmail({ title, bodyHtml }) + '\n');
