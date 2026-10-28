const recoveryKey = 'little-herb-page-recovery';
const recoveryWindow = 5 * 60 * 1000;

export function isPageLoadError(error) {
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css|loading (?:css )?chunk .+ failed/i.test(error?.message || '');
}

export function recoverPageLoad(error, browser = window) {
  if (!isPageLoadError(error) || browser.navigator.onLine === false) return false;
  const path = browser.location.pathname.replace(/\/+$/, '') || '/';
  try {
    const previous = JSON.parse(browser.sessionStorage.getItem(recoveryKey) || 'null');
    if (previous?.path === path && Date.now() - previous.at < recoveryWindow) return false;
    // Persist before reloading so a missing file cannot cause a refresh loop.
    browser.sessionStorage.setItem(recoveryKey, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Without a reliable reload guard, show the manual retry screen instead.
    return false;
  }
  browser.location.reload();
  return true;
}
