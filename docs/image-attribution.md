# Image attribution

## Audited local asset inventory

[`docs/image-inventory.json`](./image-inventory.json) is the authoritative ledger
for every raster file shipped from `apps/web/public`. It records the content
hash, active or retired status, visual subject, page fit, source, license basis,
and production use. `npm run audit:image-assets --workspace=apps/web` fails when
an asset is unlisted, duplicated byte-for-byte, changed without review, missing,
still referenced after retirement, or missing any provenance field.

The complete visual review was performed on 2026-08-09. The Unsplash License was
rechecked on the same date at <https://unsplash.com/license>; it permits free
commercial and non-commercial use without permission, subject to its stated
restrictions. The two generic reference images that did not match their page
subjects remain in the ledger as retired and are no longer rendered.

## First-party generated replacements

Two subject-specific replacements were generated with OpenAI ImageGen on
2026-08-09 and are CharitMe-owned project outputs:

| Image | Page | Generation brief | Reason |
|---|---|---|---|
| `matching-gifts-hero-v2.png` | `/matching` | Diverse employees reviewing a workplace charitable gift match, with coworkers volunteering in the background; polished documentary photography, wide hero composition, no text or logos. | Replaces generic hands-and-heart imagery with an employer-matching scene. |
| `reports-hero-v2.png` | `/reports` | Diverse nonprofit impact and data team reviewing a printed report and an analytics dashboard; credible professional setting, wide hero composition, no text or logos. | Replaces an unrelated mountain scene with reporting and research expertise. |

## About Us team portraits

The six `/about-us` portraits are representative stock photography, not identity
verification for the named team members. They are stored locally for reliable,
fast delivery and the page labels them as representative until verified team
portraits are supplied through the Supabase-backed system settings roster.

Each source is an Unsplash image CDN URL and is free for commercial use under
the [Unsplash License](https://unsplash.com/license). Attribution is appreciated
but not required. The CDN URLs used for download do not expose the contributor
profile, so no creator name is asserted below.

## Existing image pipelines

The pages built or wired in this pass (`/campaigns/[slug]/share`, `/partner`,
`/internships`) add **no new hosted image asset**. Every image they render comes
from a pipeline that already existed and already handles licensing.

## Campaign covers — `lib/covers.ts`

`resolveCampaignCover(storedCover, category, seed)` resolves in this order:

1. **A real uploaded cover** — supplied by the campaign organiser, stored in the
   project's own storage. Rights come from the organiser's upload agreement.
2. **A live themed Unsplash photo** — via `lib/unsplash.ts`, gated on
   `UNSPLASH_ACCESS_KEY`, day-cached. Unsplash License: free for commercial use,
   no permission needed, attribution appreciated but not required. Only the
   public **Access Key** is used; the Secret Key is not used anywhere.
3. **First-party subject artwork** — `/media/subject` renders a deterministic
   PNG labeled with the campaign and category. CharitMe owns this generated
   artwork; it requires no third-party license or attribution.

With no key set, every branch still returns a valid URL, so builds and tests
never touch the network.

Legacy Picsum and LoremFlickr URLs are treated only as placeholders. Migration
`20260903000000_first_party_subject_covers` replaces them in campaign and media
rows with unique first-party subject artwork; genuine organizer uploads are
never overwritten.

## Partner logos — `/partner`

Two sources, both already licensed by their nature:

- **`sponsors.logo_url`** — uploaded by an administrator for an organisation the
  platform has a partnership with. Rights come from that partnership.
- **A derived favicon** (`google.com/s2/favicons`) when a partner has a website
  but no uploaded logo. A site's own favicon served to identify that site is
  nominative use; no third-party photography is involved.

`sponsorLogoUrl` returns `null` rather than a guessed `/favicon.ico`, so a partner
with an unusable website renders as a name rather than a broken image.

## QR codes

`api.qrserver.com` generates the campaign QR. It encodes only the campaign's own
public URL — generated data, not a licensed work.

## Rule for future images

Any *new* external image added to these pages must record, in this file: source
URL, creator (where given), license basis, download date, the page using it, and
required attribution.

| Image | Page | Source | Creator | License | Added |
|---|---|---|---|---|---|
| `sarah-johnson.jpg` | `/about-us` | `https://images.unsplash.com/photo-1531123897727-8f129e1688ce` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
| `michael-patel.jpg` | `/about-us` | `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
| `emily-carter.jpg` | `/about-us` | `https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
| `david-lee.jpg` | `/about-us` | `https://images.unsplash.com/photo-1566492031773-4f4e44671857` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
| `aisha-khan.jpg` | `/about-us` | `https://images.unsplash.com/photo-1573496799652-408c2ac9fe98` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
| `james-wilson.jpg` | `/about-us` | `https://images.unsplash.com/photo-1560250097-0b93528c311a` | Not exposed by CDN URL | Unsplash License | 2026-08-08 |
