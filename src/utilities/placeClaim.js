const draftKey = placeId => `little-herb-place-claim:${placeId}`;
const fields = ['name', 'relationship', 'email', 'phone', 'verificationUrl', 'evidence'];

export function emptyClaim(email = '') {
  return { name: '', relationship: '', email, phone: '', verificationUrl: '', evidence: '' };
}

export function readClaimDraft(placeId, email = '') {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(placeId)));
    if (!draft || !Number.isFinite(draft.savedAt) || draft.savedAt > Date.now() || Date.now() - draft.savedAt > 86400000) {
      clearClaimDraft(placeId);
      return emptyClaim(email);
    }
    return Object.fromEntries(fields.map(key => [key, typeof draft[key] === 'string' ? draft[key] : key === 'email' ? email : '']));
  } catch { return emptyClaim(email); }
}

export function saveClaimDraft(placeId, draft) {
  sessionStorage.setItem(draftKey(placeId), JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export function clearClaimDraft(placeId) {
  try { sessionStorage.removeItem(draftKey(placeId)); } catch { /* Storage may be unavailable. */ }
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
