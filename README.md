# For His Grace Ministries public website

Static website hosted on GitHub Pages. Blog, Events and Gallery read published content from `https://admin.hisgraceministries.co.za/api/public/` using `cms.js`. No login, credentials or API keys are included in the public website.

| Page | Portal feature | Public endpoint |
| --- | --- | --- |
| `blog.html` | Blog articles | `/api/public/blog` |
| `blog-post.html?slug=...` | Published article | `/api/public/blog/{slug}` |
| `events.html` | Published ongoing/upcoming events | `/api/public/events` |
| `gallery.html` | Published albums containing published photos | `/api/public/gallery/albums` |
| `gallery.html?album=...` | Published album photos | `/api/public/gallery/albums/{slug}` |

Deploy the matching FHGM-Admin public CORS change before deploying these pages. The portal permits GET requests from `https://hisgraceministries.co.za` and `https://www.hisgraceministries.co.za`; it does not permit cross-origin staff actions or send credentials. GitHub Pages cannot proxy `/api` to the VPS, so these pages use the portal's absolute HTTPS URL.

Staff continue using the existing portal: publish approved blog articles; publish events with future end times; publish albums and their photos. Newly published articles and events appear in the primary sections for 14 days, then move into “From the Heart” and “More events,” respectively. Blog records are sorted by publish date. Events need a `publishedAt`, `createdAt`, or `uploadedAt` timestamp from the API to move automatically; records without one remain in Upcoming Events. All pages of those feeds are loaded so older items are not missed. Gallery photos from published albums appear in “Moments in His Presence”; an album card appears only for an album returned by the admin gallery endpoint. Refresh the public page to see changes. Events that end while the page is open are removed automatically. Event times are shown in Africa/Johannesburg. Legacy blog cards are retained in “From the Heart.” Existing gallery search, category filters and the photo dialog are retained.

The blog supports plain text and the safe Markdown subset described by the renderer. Blog articles and events without a featured image use a randomly selected embedded gallery image or published album cover. Gallery photos in “Moments in His Presence” share one responsive bento grid with the embedded photos; ten photos are shown at a time, with a load-more control for the rest. Photos open in the photo viewer; album-detail photos open at full size in a new tab. Announcements are outside this integration.

## Checks

The `Public content integration` GitHub Actions workflow runs browser tests with mocked API responses for recent/archive feeds, album photos, details, safe text rendering, error/retry handling and mobile page width. These tests do not create production data. Admin integration tests separately verify publication rules and CORS boundaries.

For local tests, install Playwright (`npm install --no-save playwright@1.56.1` and `npx playwright install chromium`), serve this directory with `python3 -m http.server 8000`, then run `node tests/cms.spec.cjs`. Local manual API browsing is intentionally not granted production CORS access.

After deployment, verify all three pages on the real website with known published content and confirm unpublished content stays hidden. A missing article or album shows an unavailable message; API failures show a retry button.

## Moving existing content into the portal

Existing HTML content is not automatically imported or deleted when the first new portal item is published. Migrate each item deliberately, verify its public result, then remove its matching static card in a separate reviewed change. This avoids losing original content or reviving unpublished portal records through a cached fallback.
