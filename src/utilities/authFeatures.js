// Local preview only. Remove the DEV guard only after both Supabase sign-in and signup templates include {{ .Token }}.
export const passwordlessEnabled = import.meta.env.DEV && import.meta.env.VITE_PASSWORDLESS_ENABLED === 'true';
