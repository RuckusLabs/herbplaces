const draftKey = placeId => `little-herb-place-claim:${placeId}`;
const fields = ['name', 'relationship', 'email', 'phone', 'verificationUrl', 'evidence'];

export function emptyClaim(email = '') {
  return { name: '', relationship: '', email, phone: '', verificationUrl: '', evidence: '' };
}

export function readClaimDraft(placeId, email = '') {
  try {
    const candidates = [];
    try { candidates.push(JSON.parse(localStorage.getItem(draftKey(placeId)))); } catch { /* Try tab storage. */ }
    try { candidates.push(JSON.parse(sessionStorage.getItem(draftKey(placeId)))); } catch { /* Shared copy may be available. */ }
    const draft = candidates.filter(item => item && Number.isFinite(item.savedAt) && item.savedAt <= Date.now() && Date.now() - item.savedAt <= 86400000)
      .sort((a, b) => b.savedAt - a.savedAt)[0];
    if (!draft) {
      clearClaimDraft(placeId);
      return emptyClaim(email);
    }
    return Object.fromEntries(fields.map(key => [key, typeof draft[key] === 'string' ? draft[key] : key === 'email' ? email : '']));
  } catch { return emptyClaim(email); }
}

export function saveClaimDraft(placeId, draft) {
  const saved = JSON.stringify({ ...draft, savedAt: Date.now() });
  // The shared copy lets an email confirmation opened in another tab resume.
  // Fall back to this tab when browser privacy settings block shared storage.
  let stored = false;
  try { localStorage.setItem(draftKey(placeId), saved); stored = true; } catch { /* Try tab storage. */ }
  try { sessionStorage.setItem(draftKey(placeId), saved); stored = true; } catch { /* Shared copy may be available. */ }
  if (!stored) throw new Error('Claim draft storage is unavailable.');
}

export function clearClaimDraft(placeId) {
  try { sessionStorage.removeItem(draftKey(placeId)); } catch { /* Storage may be unavailable. */ }
  try { localStorage.removeItem(draftKey(placeId)); } catch { /* Storage may be unavailable. */ }
}

// Keep the existing private claim API and admin review compatible with older claims.
export function claimEvidence(draft) {
  return [
    `Full name: ${draft.name.trim()}`,
    `Business email: ${draft.email.trim()}`,
    draft.phone.trim() && `Business phone: ${draft.phone.trim()}`,
    draft.verificationUrl.trim() && `Verification link: ${draft.verificationUrl.trim()}`,
    `Ownership details:\n${draft.evidence.trim()}`,
    'Confirmed: I own this business or am authorized to manage its listing, and these details are accurate.',
  ].filter(Boolean).join('\n\n');
}
