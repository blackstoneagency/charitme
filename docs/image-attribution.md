# Image attribution

## No new external images were introduced

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
3. **A deterministic Picsum placeholder** — keyed on the campaign slug so the
   same campaign always gets the same image. Treated as *overridable*, so a live
   Unsplash photo replaces it when the key is configured.

With no key set, every branch still returns a valid URL, so builds and tests
never touch the network.

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
required attribution. Nothing in this pass met that condition, so the inventory
below is intentionally empty.

| Image | Page | Source | Creator | License | Added |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
