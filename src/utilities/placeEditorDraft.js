const key = (userId, placeId) => `little-herb-editor:${userId}:${placeId}`;

export function readEditorDraft(userId, placeId) {
  if (!userId || !placeId) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(userId, placeId)));
    if (!saved || !Number.isFinite(saved.version) || !Number.isFinite(saved.savedAt) || saved.savedAt > Date.now() || saved.savedAt < Date.now() - 86400000) {
      clearEditorDraft(userId, placeId); return null;
    }
    if (!saved.draft || typeof saved.draft !== 'object' || !Array.isArray(saved.draft.photos) || !saved.draft.photos.every(photo => typeof photo === 'string')
      || !Array.isArray(saved.draft.social_links) || !saved.draft.social_links.every(link => typeof link?.label === 'string' && typeof link?.url === 'string')) return null;
    return saved;
  } catch { return null; }
}

export function saveEditorDraft(userId, placeId, draft, version) {
  if (!userId || !placeId) return;
  try { sessionStorage.setItem(key(userId, placeId), JSON.stringify({ draft, version: Number(version), savedAt: Date.now() })); } catch { /* Editing still works if storage is full or blocked. */ }
}

export function clearEditorDraft(userId, placeId) {
  try { sessionStorage.removeItem(key(userId, placeId)); } catch { /* Optional browser recovery. */ }
}
