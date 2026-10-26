// Hosted signup and sign-in templates now include {{ .Token }}; email-code sign-in is the default.
// An explicit false value retains the legacy flow for controlled compatibility checks.
export const passwordlessEnabled = import.meta.env.VITE_PASSWORDLESS_ENABLED !== 'false';
