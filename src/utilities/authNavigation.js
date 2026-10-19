const DESTINATION_KEY = 'auth_return_path';

export function getSafeReturnPath(value, fallback = '/map') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}

export function readAuthDestination() {
  try { return getSafeReturnPath(localStorage.getItem(DESTINATION_KEY), ''); }
  catch { return ''; }
}
export function rememberAuthDestination(path) {
  try { localStorage.setItem(DESTINATION_KEY, getSafeReturnPath(path)); }
  catch { /* The query string still preserves the destination for this tab. */ }
}
export function clearAuthDestination() {
  try { localStorage.removeItem(DESTINATION_KEY); } catch { /* Optional navigation state. */ }
}
