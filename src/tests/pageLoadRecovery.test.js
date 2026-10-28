import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverPageLoad, isPageLoadError } from '../utilities/pageLoadRecovery.js';

const loadError = new TypeError('Failed to fetch dynamically imported module: https://littleherbplaces.com/assets/BusinessPlan-old.js');
function fixture() {
  const values = new Map();
  const result = {
    navigator: { onLine: true }, reloads: 0,
    location: { pathname: '/the-little-garden/bloom', reload: () => result.reloads++ },
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  };
  return result;
}

test('missing route files trigger one recovery and a persistent failure cannot refresh repeatedly', () => {
  const current = fixture();
  assert.equal(recoverPageLoad(loadError, current), true);
  current.location.pathname += '/';
  assert.equal(recoverPageLoad(loadError, current), false);
  assert.equal(current.reloads, 1);
});

test('offline, blocked storage, and application errors leave recovery to the retry screen', () => {
  const offline = fixture(); offline.navigator.onLine = false;
  const blocked = fixture(); blocked.sessionStorage.getItem = () => { throw new Error('Storage blocked'); };
  for (const current of [offline, blocked]) {
    assert.equal(recoverPageLoad(loadError, current), false);
    assert.equal(current.reloads, 0);
  }
  const current = fixture();
  assert.equal(recoverPageLoad(new Error('Unexpected component error'), current), false);
  assert.equal(current.reloads, 0);
});

test('recognizes browser import and CSS preload failures without treating ordinary errors as downloads', () => {
  for (const message of ['Importing a module script failed.', 'error loading dynamically imported module', 'Unable to preload CSS for /assets/page.css', 'Loading chunk 14 failed.']) assert.equal(isPageLoadError(new Error(message)), true);
  assert.equal(isPageLoadError(new Error('Profile not found')), false);
});
