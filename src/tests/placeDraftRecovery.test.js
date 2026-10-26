import test from 'node:test';
import assert from 'node:assert/strict';
import { readClaimDraft, saveClaimDraft, clearClaimDraft } from '../utilities/placeClaim.js';
import { readEditorDraft, saveEditorDraft, clearEditorDraft } from '../utilities/placeEditorDraft.js';

function storage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
const claim = { name: 'Jamie', email: 'jamie@example.com', relationship: 'Owner', evidence: 'Our team page confirms my connection.', phone: '', verificationUrl: '' };
test('claim recovery works across tabs, clears both copies, and falls back when shared storage is blocked', () => {
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  saveClaimDraft(42, claim);
  globalThis.sessionStorage = storage(); // The email opened in another tab.
  assert.equal(readClaimDraft(42).name, 'Jamie');
  clearClaimDraft(42); assert.equal(readClaimDraft(42).name, '');
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  saveClaimDraft(42, claim); assert.equal(readClaimDraft(42).name, 'Jamie');
});
test('claim recovery selects a valid recent tab copy over stale shared data and expires old drafts', () => {
  globalThis.localStorage = storage(); globalThis.sessionStorage = storage();
  localStorage.setItem('little-herb-place-claim:42', JSON.stringify({ ...claim, name: 'Old', savedAt: Date.now() - 10000 }));
  sessionStorage.setItem('little-herb-place-claim:42', JSON.stringify({ ...claim, savedAt: Date.now() }));
  assert.equal(readClaimDraft(42).name, 'Jamie');
  localStorage.setItem('little-herb-place-claim:42', JSON.stringify({ ...claim, savedAt: Date.now() - 86400001 }));
  sessionStorage.removeItem('little-herb-place-claim:42');
  assert.equal(readClaimDraft(42).name, ''); assert.equal(localStorage.getItem('little-herb-place-claim:42'), null);
});
test('editor drafts retain the expected version and remain scoped to a place and account', () => {
  globalThis.sessionStorage = storage();
  const draft = { name: 'Saved draft', photos: [], social_links: [] };
  saveEditorDraft('owner',42,draft,3);
  assert.equal(readEditorDraft('owner',42).version, 3);
  assert.equal(readEditorDraft('other',42), null); assert.equal(readEditorDraft('owner',43), null);
  clearEditorDraft('owner',42); assert.equal(readEditorDraft('owner',42), null);
  sessionStorage.setItem('little-herb-editor:owner:42', JSON.stringify({ draft, version: 3, savedAt: Date.now()-86400001 }));
  assert.equal(readEditorDraft('owner',42), null);
});
