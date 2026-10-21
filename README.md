# Little Herb Places

A React and Vite directory for independent herb shops, herbalists, gardens, and plant communities. Styling uses custom Sass modules; no Tailwind or shadcn.

## Local development

Use Node.js 22 or later. Install dependencies with `npm ci`, then run `npm run dev`.

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

The homepage hero uses a lightweight Mapbox static image with accessible pins positioned from actual listing coordinates. Nearby places share a pin; selecting a grouped pin opens the map fitted to that group’s area. Single-place pins open the place’s detail page directly. The Open the Full Map button opens the map directory. Hero searches and category shortcuts open Map view with the requested filters. Both maps share their pin components; Discover retains saving, dismissible popups, and mobile bottom sheets. Its individual pin labels appear on hover, keyboard focus, or selection to keep nearby places legible. The full map library remains lazy-loaded in the directory.

Directory lists and the map results panel show at most 15 places per page. Previous/Next controls preserve filters and the current page in the URL. Filter and area changes reset to page one. All matching map pins remain available, and selecting a pin brings its result page into view. The list is the default view. `?view=map` preserves Map view in shareable URLs. Mapbox and its styles load only when the visitor chooses Map. Map view links place cards to category pins, clusters nearby places, and offers an explicit area search. Filtering preserves the current camera; Show All Places clears the area restriction and fits the matching places. On mobile, selected places appear in a bottom sheet and the results list can be expanded. Places share one pending request and a five-minute memory/local-storage cache; navigation and window focus revalidate public listings. Blocked, full, or malformed storage does not prevent loading places. Retry refreshes the cache.

Map usage is reduced in two ways: Discover enables `reuseMaps`, so switching List/Map or returning from another route reuses the existing Mapbox instance in the current page session instead of initializing another billable map load. The homepage groups similar viewport dimensions into shared static-image requests, with pins projected into that exact camera so they remain aligned when the image scales. Small resizes within a size bucket do not generate different map URLs. Static images use the browser's ordinary HTTP cache and Mapbox's `Cache-Control` headers (currently 12 hours); there is no separate tile store or cache that overrides expiration. The places-data cache above is separate from Mapbox billing.

This reduces redundant requests but does not cap charges: full page reloads, separate tabs, new visitors, and Mapbox's session limits can still create loads. See [Mapbox GL JS billing](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/), [map reuse](https://visgl.github.io/react-map-gl/docs/get-started/tips-and-tricks#minimize-cost-from-frequent-re-mounting), and [static-image caching](https://docs.mapbox.com/api/maps/static-images/#static-images-api-restrictions-and-limits). Use token URL restrictions and review usage in Mapbox to limit unauthorized use and spot unusual traffic.

Guests save places on their device; a successful new save opens an account prompt with Create an Account, Sign In, and Keep Browsing options. Removing a save does not prompt. All cards and the saved-places page share a single favorites provider.

Authenticated favorites use the existing Supabase `favorites` table. Guest saves merge automatically after sign-in or an email-confirmation callback, without replacing existing account saves. Device copies are removed only after the database confirms the merge. Failures retain local saves and provide a retry. The account forms preserve the return destination and send visitors from the save prompt to `/favorites` after syncing.

Places Near Me is available on the homepage and after All Places in the directory filters. It explains the location request before asking the browser for permission; if location permission is already granted, it opens nearby results directly. Once allowed, `/map?view=map&lat=...&lng=...` shows places within 50 miles in both Map and List views. Map view marks the location with a branded pin and a You are here label. The Places Near Me chip shows whether nearby filtering is active; select it again to remove that filter. Denied or unavailable location access offers manual map exploration. Show Places Everywhere removes the location filter.

## Live account verification

Use an email/account you control in the preview; do not share passwords in chat. While logged out, save a place, choose Create an Account (or Sign In for an existing account), and complete any email confirmation. Confirm the place appears in Saved Places, reload, then sign out and sign back in to confirm account persistence. Repeat with an existing account that already has another favorite to verify both are retained. Automated tests cover merge failures and retries; actual hosted authentication, email delivery, and database permissions still require this live check.

If email confirmation is enabled, Supabase's allowed redirect URLs must include the tested origin's `/auth/callback` URL, including localhost during local verification.

## Place photos

Detail-page photo previews fit the whole image and cap their height at 480px on desktop and 360px on mobile, also respecting the viewport height. Tap a photo or choose View Full Image for a keyboard-accessible lightbox, with previous/next controls, fit-to-screen and original-size viewing, Escape dismissal, and focus restoration.


## Place ownership and subscriptions

Owners edit directly on their place page after claim approval and an eligible Bloom subscription. Saved Places (`/favorites`) also shows My Places access, claim status, and billing for accounts with a managed place or a pending/approved claim. Existing `/my-places` links redirect there and preserve billing return parameters; `/admin` provides user lookup, claims, manager assignments, protected settings, and revision restoration. Bloom purchases stay disabled until server and frontend release flags are enabled. The customer-launch milestone adds account recovery, visible rejected claims/access errors, missing-listing requests at `/request-place`, customer notification queues, independent ownership verification, and billing recovery for missed initial webhooks. The October 21 database and function changes are deployed, while the frontend remains under review and purchases remain disabled. Actual Stripe payments and mailbox delivery still require verification. Run `node scripts/check-launch-readiness.mjs` to inspect configuration without exposing keys.

See [setup and verification](docs/place-management-setup.md) before applying the included Supabase migration or enabling payments. No hosted database changes or billing deployment happen as part of a frontend build.

## GitHub Pages SEO and share cards

`npm run build` remains a quick app-only build. Use **`npm run build:pages` for deployment**. It builds the app, reads every public listing with the public Supabase key, and generates:

- `dist/place/<slug>/index.html` with real place content, unique titles/descriptions, canonical URLs, Open Graph/Twitter metadata, and Place/LocalBusiness plus breadcrumb structured data. These files avoid relying on the SPA's 404 fallback for valid place URLs.
- A branded 1200 × 630 JPEG for each place under `dist/og/places/`, using the listing photo, name, location, and tagline, plus 10 page-specific cards under `dist/og/pages/` for the main website and account entry pages. Image URLs change with listing content to help refresh share caches. Unavailable photos use the site's botanical fallback.
- Static public entry pages, non-indexable account entry pages, an actual non-indexable 404 page, `sitemap.xml`, `robots.txt`, and `.nojekyll`.

Install the build browser once with `npx playwright install chromium` (CI installs browser/system dependencies automatically). The Pages workflow and `npm run deploy` use the complete export. Review both webpage and place cards at `/og/preview.html` in the exported site. Missing public credentials, invalid/duplicate slugs, or an empty/failed directory response stop the release rather than silently dropping place pages. No service-role key is used.

GitHub Pages has no request-time rendering. The deployment workflow automatically checks for listing changes every 24 hours and rebuilds static content, share cards, and the sitemap when needed; the interactive app can show fresh database content sooner. Submit `https://littleherbplaces.com/sitemap.xml` in Google Search Console after deployment. Social networks may retain an older preview until their share cache is refreshed.

For an offline reproducible export after an app build, `node scripts/build-seo.mjs --places /absolute/path/to/public-places.json` accepts a public listing snapshot. Share photos are restricted to the configured Supabase public Storage origin; credentials and management/account records are never embedded in generated pages.

### Automatic rebuilds: enabled by merging this change

The default flow is **GitHub checks public listings once daily at 06:17 UTC → compares them with the last published content → regenerates and deploys only when content changed**. New places, edits, and deletions are all detected. The check and export use the same public snapshot, and failed/empty directory reads stop the run while preserving the deployed site. Pushes to `main` and manual workflow runs always rebuild, including design-only changes.

The repository's existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_MAPBOX_TOKEN` secrets were synchronized with the working local configuration on October 20, 2026; Actions is enabled and Pages publishes the `gh-pages` branch at `littleherbplaces.com`. No additional token or Supabase database setup is needed for scheduled checks. To activate:

1. Review and merge this PR into `main`. This triggers the first complete deployment and installs the schedule on the default branch.
2. Open **GitHub → Actions → Deploy to GitHub Pages** and wait for the merge-triggered run to pass. Check `/og/preview.html` and one `/place/<slug>/` URL on the live site.
3. Add or edit a normal listing. At the next scheduled check, the workflow should rebuild and deploy. For an immediate refresh, use **Run workflow → Branch: main → Run workflow** on that Actions page.

GitHub can delay scheduled runs. In public repositories, it disables schedules after 60 days without repository activity; re-enable this workflow on the Actions page if that happens. Monitor failed runs there. See [GitHub's schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### Optional faster rebuilds through Supabase

For rebuilds within roughly 30–90 seconds instead of waiting for the next scheduled check, the optional prepared flow is: **place added, edited, or deleted → Supabase queue → GitHub Actions → regenerated cards/pages/sitemap → GitHub Pages**. It also covers changes made through the Supabase dashboard or imports. The daily check remains a fallback.

1. Put the updated `.github/workflows/deploy.yml` and share-card generation files on `main`, and verify one manual run under **GitHub → Actions → Deploy to GitHub Pages → Run workflow**. The existing `workflow_dispatch` entry is the API trigger. Deployment concurrency keeps overlapping requests from publishing out of order.
2. Create a **fine-grained GitHub token** for **RuckusLabs/herbplaces only**, with repository **Actions: Read and write**. Save it through **Supabase → Vault** as `site_build_github_token`. Do not put it in a `VITE_` variable, frontend code, a SQL snippet/history, or chat. Rotate it in Vault before it expires.
3. Enable **pg_net** and **pg_cron** in Supabase, then run [`supabase/setup-site-rebuilds.sql`](supabase/setup-site-rebuilds.sql) in the SQL Editor. This setup is optional and has not been applied to the hosted database by preparing these files.
4. Make a normal listing edit. After a 30-second quiet period, the once-a-minute worker dispatches the build, usually within 30–90 seconds. GitHub then builds and deploys the current database contents. Bulk changes collapse into one pending request; failed HTTP requests retry after five minutes. Listing edits succeed even if GitHub is temporarily unavailable.
5. Check the GitHub Actions run for the final deployment result. For queue diagnostics, a database administrator can run:

```sql
select dirty_at, request_id, last_attempt_at, last_accepted_at, last_error
from site_build_private.queue;
```

`last_accepted_at` means GitHub accepted the request; it is not proof that the build succeeded. Build failures appear in GitHub Actions and can be rerun there. The token stays server-side in Vault. Only the fixed repository/workflow and the `main` ref are dispatched; no listing, account, or claim details are sent to GitHub.

To disable automatic requests, unschedule `little-herb-places-rebuild` in Supabase Cron and remove the `queue_site_rebuild` trigger from `public.places`. Manual and push-triggered builds continue to work.

References: [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Supabase Vault](https://supabase.com/docs/guides/database/vault).
