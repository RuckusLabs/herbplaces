# Little Herb Places

A React and Vite directory for independent herb shops, herbalists, gardens, and plant communities. Styling uses custom Sass modules; no Tailwind or shadcn.

## Local development

Install dependencies with `npm ci`, then run `npm run dev`.

Create a local `.env` file (never commit credentials):

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-public-anon-key
# Required for the homepage map and Discover Map view
VITE_MAPBOX_TOKEN=your-public-mapbox-token
```

Use a public Supabase anon key with appropriate row-level security policies, never a service-role key. Use a public Mapbox token for maps; configure it in the build environment as well as locally. Without Supabase configuration, the site renders normally and directory/account requests show an unavailable state. Restart Vite after changing environment variables.

## Maps in GitHub Pages deployments

GitHub Actions must have a repository secret named `VITE_MAPBOX_TOKEN` (Settings → Secrets and variables → Actions). Local `.env.local` settings do not reach GitHub Actions. The deployment workflow passes this secret into the Vite build and stops with a clear error if it is missing. Redeploy after adding or changing it; the value is embedded at build time.

Use the same working public Mapbox token for the homepage Static Images API and the interactive Discover map. If maps still fail, check the failed request: 401 means an invalid or deleted token; 403 can mean missing permissions or a URL restriction. Allow the actual site origin (`https://littleherbplaces.com`, plus `https://www.littleherbplaces.com` if used) and local preview origins on restricted tokens. See [Mapbox token troubleshooting](https://docs.mapbox.com/help/troubleshooting/token-errors/).

## Checks

- `npm test` checks directory search, category filtering, resilient caching, guest saves, account merges, and safe account redirects.
- `npm run build` generates the production site in `dist`.
- `npm run preview` serves the production build locally.

## Directory behavior

Homepage search links to `/map?view=map&q=...`. Category links use `/map?category=shops` (or `herbalists`, `gardens`, `workshops`); hero shortcuts also preserve Map view. Filters remain in the URL, so filtered views can be bookmarked. Categories match terms in existing listing fields; a dedicated taxonomy can replace this when the database provides one.

The homepage hero uses a lightweight Mapbox static image with accessible place-preview buttons positioned from actual listing coordinates. Nearby places share a pin and can be browsed in the preview card, including their existing Featured/Verified badges. Hero searches and category shortcuts open Map view with the requested filters. Both maps share their pin and preview components; Discover retains saving, dismissible popups, and mobile bottom sheets. Its individual pin labels appear on hover, keyboard focus, or selection to keep nearby places legible. The full map library remains lazy-loaded in the directory.

The list is the default view. `?view=map` preserves Map view in shareable URLs. Mapbox and its styles load only when the visitor chooses Map. Map view links place cards to category pins, clusters nearby places, and offers an explicit area search. Filtering preserves the current camera; Show All Places clears the area restriction and fits the matching places. On mobile, selected places appear in a bottom sheet and the results list can be expanded. Places share one pending request and a five-minute memory/local-storage cache; navigation and window focus revalidate public listings. Blocked, full, or malformed storage does not prevent loading places. Retry refreshes the cache.

Map usage is reduced in two ways: Discover enables `reuseMaps`, so switching List/Map or returning from another route reuses the existing Mapbox instance in the current page session instead of initializing another billable map load. The homepage groups similar viewport dimensions into shared static-image requests, with pins projected into that exact camera so they remain aligned when the image scales. Small resizes within a size bucket and preview selections do not generate different map URLs. Static images use the browser's ordinary HTTP cache and Mapbox's `Cache-Control` headers (currently 12 hours); there is no separate tile store or cache that overrides expiration. The places-data cache above is separate from Mapbox billing.

This reduces redundant requests but does not cap charges: full page reloads, separate tabs, new visitors, and Mapbox's session limits can still create loads. See [Mapbox GL JS billing](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/), [map reuse](https://visgl.github.io/react-map-gl/docs/get-started/tips-and-tricks#minimize-cost-from-frequent-re-mounting), and [static-image caching](https://docs.mapbox.com/api/maps/static-images/#static-images-api-restrictions-and-limits). Use token URL restrictions and review usage in Mapbox to limit unauthorized use and spot unusual traffic.

Guests save places on their device; a successful new save opens an account prompt with Create an Account, Sign In, and Keep Browsing options. Removing a save does not prompt. All cards and the saved-places page share a single favorites provider.

Authenticated favorites use the existing Supabase `favorites` table. Guest saves merge automatically after sign-in or an email-confirmation callback, without replacing existing account saves. Device copies are removed only after the database confirms the merge. Failures retain local saves and provide a retry. The account forms preserve the return destination and send visitors from the save prompt to `/favorites` after syncing.

## Live account verification

Use an email/account you control in the preview; do not share passwords in chat. While logged out, save a place, choose Create an Account (or Sign In for an existing account), and complete any email confirmation. Confirm the place appears in Saved Places, reload, then sign out and sign back in to confirm account persistence. Repeat with an existing account that already has another favorite to verify both are retained. Automated tests cover merge failures and retries; actual hosted authentication, email delivery, and database permissions still require this live check.

If email confirmation is enabled, Supabase's allowed redirect URLs must include the tested origin's `/auth/callback` URL, including localhost during local verification.

## Place photos

Detail-page photo previews fit the whole image and cap their height at 480px on desktop and 360px on mobile, also respecting the viewport height. Tap a photo or choose View Full Image for a keyboard-accessible lightbox, with previous/next controls, fit-to-screen and original-size viewing, Escape dismissal, and focus restoration.


## Place ownership and subscriptions

Owners edit directly on their place page after claim approval and an eligible Bloom subscription. `/my-places` shows access and billing; `/admin` provides user lookup, claims, manager assignments, protected settings, and revision restoration. Bloom purchases stay disabled until server and frontend release flags are enabled.

See [setup and verification](docs/place-management-setup.md) before applying the included Supabase migration or enabling payments. No hosted database changes or billing deployment happen as part of a frontend build.
