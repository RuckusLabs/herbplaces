// Show current work once; retain earlier decisions as history without deleting it.
export function getMyPlacesView(memberships, claims, requests) {
  const ownedSlugs = new Set(memberships.map(item => item.place?.urlSlug).filter(Boolean));
  const ownedIds = new Set(memberships.map(item => String(item.place_id)));
  const isOwned = claim => ownedSlugs.has(claim.urlSlug) || ownedIds.has(String(claim.place_id));
  const pendingClaims = claims.filter(claim => claim.status === 'pending' && !isOwned(claim));
  const pendingSlugs = new Set(pendingClaims.map(claim => claim.urlSlug).filter(Boolean));
  const pendingIds = new Set(pendingClaims.map(claim => String(claim.place_id)));
  return {
    pendingClaims,
    activeRequests: requests.filter(request => request.status === 'pending' ||
      (request.status === 'listed' && !ownedSlugs.has(request.place_slug) && !pendingSlugs.has(request.place_slug))),
    pastRequests: requests.filter(request => request.status === 'declined'),
    pastClaims: claims.filter(claim => claim.status !== 'pending' && !isOwned(claim) &&
      !pendingSlugs.has(claim.urlSlug) && !pendingIds.has(String(claim.place_id))),
  };
}
