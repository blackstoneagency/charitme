# mobileGo — App Store & Play Store readiness

Status of getting **charitme.com** publishable as a mobile app. Written
2026-08-10. Every claim below was measured or read from the code; where something
is unverified it says so.

## Read this first: what "ready to publish" can and cannot mean here

This repository is a **Next.js website**. Neither store accepts a URL:

- **Google Play** takes a signed AAB. The usual route for a site like this is a
  Trusted Web Activity generated from `app/manifest.ts` by Bubblewrap.
- **Apple** takes a native binary built by Xcode.

So readiness splits in two, and only the first half can be finished in this repo:

| | Owner |
|---|---|
| Manifest, association files, deep-link paths, in-app policy compliance | **this repo** |
| Signed builds, store credentials, listing art, privacy declarations | **a developer account + a build machine** |

Nothing below claims a store submission is ready. It claims the *files this repo
owns* are, and names precisely what is not.

---

## ✅ Applied

### The splash flashed white before a black app
`background_color` was `#fbfaff` while the app opens **dark** — `layout.tsx` sets
`data-theme="dark"` unless a stored choice says otherwise, and the dark `--bg` is
`#000000`. That field is painted *before* a byte of the app renders, so every
launch of the installed app flashed white and then went black.

Invisible in a browser: only an installed app has a splash. Now `#000000`, and
`__tests__/manifest-contract.test.ts` reads the value out of `globals.css` rather
than restating it, so a theme change cannot silently reintroduce it.
→ `d9e41a0e`

### Manifest fields a store build actually reads
`scope` (Bubblewrap reads it to decide which links the Android app claims — an
inferred value can shift underneath the project), `lang`, `dir`, and three
home-screen shortcuts. Each shortcut is asserted against a real page file, **route
groups included**, since `app/campaigns/(list)/page.tsx` is missed by a plain path
join. A shortcut that 404s is a dead control on someone's home screen, where no
surface in the app can explain it and no link audit reaches it.
→ `d9e41a0e`

### Both deep-link association files
`/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`.
Together they are what makes a TWA run **without an address bar** — the detail
that gets a build read as a repackaged website.

⚠️ **Both 404 until configured, deliberately.** Each asserts an identity this repo
cannot derive: the SHA-256 of the certificate Play signs with, and
`TEAMID.bundle.id`. A placeholder does not fail loudly — Android reports
"verification did not succeed" and iOS silently declines, both of which read as a
store-console problem and send you to look in the wrong place. A malformed
fingerprint is rejected exactly like an unset one.

The iOS path list excludes `/api/*`, `/thank-you/*`, `/auth/*` **before** claiming
`/campaigns/*` and `/donate/*`. A universal link that swallows a Stripe return
strands the donor in an app screen that cannot finish the checkout the browser was
mid-way through — after the money has moved. iOS takes the **last** match, so the
ordering is load-bearing and asserted.
→ `d9e41a0e`

### Manifest screenshots — and the reason they were abandoned was wrong
The tracker recorded `page.screenshot()` timing out at 30s on `/` and
`/campaigns`, "almost certainly the hero carousel and the CountUp animations".
Re-measured: **`/` captures in 0.6–1.3s, `/campaigns` in 1.2–1.6s**, with and
without off-origin blocking. The pages were never the problem. The two settings
that *do* hang are the ones the earlier attempt used:

- `waitUntil: 'networkidle'` — never settles, because covers point at hosts the
  sandbox cannot reach
- `animations: 'disabled'` — waits for CSS animations to finish, and the hero
  carousel is infinite

`npm run capture:screenshots` writes `lib/manifest-screenshots.json`, which
`app/manifest.ts` reads. A hand-kept list drifts from `public/screenshots/`, and
its failure mode is a 404 **inside the install dialog** — a surface no route test
or link audit reaches.

**All 4 captured** at 780×1688: `/`, `/campaigns`, `/donate`, `/how-it-works`.

⚠️ The first run shipped only 1 of 4, and the guard that stopped the other three
is worth keeping. `/campaigns`, `/donate` and `/how-it-works` rendered
**"Gifts given —"** — this codebase's marker for a **failed read** — while
production rendered 592. The cause was a dead `SUPABASE_SERVICE_ROLE_KEY` in
`.env.local` (production answered `"Unregistered API key"`); anon reads returned
200, so anon-path figures rendered and every `supabaseAdmin`-path figure showed a
dash.

**Nothing downstream could have caught it**: the PNG is valid, the manifest is
valid, every test passes. It is a clean phone screenshot of a broken statistic
that would have gone straight into the store listing. The script now refuses any
shot whose `[class*=stat-value]` reads as an em dash. With the working key
supplied, all four recaptured clean — verified visually: 502 · $96,850 · 592 · 69.
→ `7b53f625`

### Sign in with Apple — checked, already present
Guideline 4.8 requires it wherever a third-party login is offered, and Google
sign-in is offered. It is present (`components/AuthPanel.tsx`,
`app/api/auth/signin/route.ts`). This would have been a certain rejection;
verified rather than assumed.

### Self-service account deletion (App Store 5.1.1(v))
`/privacy-center` offered only "Request account deletion", which files a row for
an admin. Apple requires the user to **initiate and complete** deletion in-app.

⚠️ **Building it uncovered a worse hazard than the one it fixed.** The one-line
implementation — `auth.admin.deleteUser(id)` — cascades:

```
auth.users DELETE
  └─ profiles.id            ON DELETE CASCADE
      └─ campaigns.user_id  ON DELETE CASCADE
          └─ donations.campaign_id ON DELETE CASCADE
```

Deleting **one** fundraiser's account erases **every donation ever made to
them** — other people's money, their receipts, and the rows every public total is
computed from. It fails silently: the delete succeeds, pages still render, the
totals are just smaller.

The cascade is **computed from `supabase/schema.sql`**, not hand-listed, and the
computation found four paths that do not survive an eyeball read. One deleted
`profiles` row reaches **87 tables**; 15 money-bearing tables hang off 6 first
hops:

```
campaigns.user_id            → donations, donation_receipts, refunds,
                               recurring_donations, transparency_ledger_items,
                               fundraising_events → event_tickets, auction_bids
creator_profiles.user_id     → digital_products → product_orders,
                               membership_tiers → member_subscriptions,
                               creator_tips, commission_requests
nonprofit_profiles.owner_id  → tax_receipts
payouts.user_id · matching_claims.employee_id · subscriptions.user_id
```

Deletion reassigns those six columns to a tombstone profile, then deletes the auth
user, so the cascade finds nothing of value. `__tests__/deletion-cascade.test.ts`
ratchets it **both ways**: a new foreign key opening a seventh path fails the
build, and reassigning a table that does *not* protect money also fails — the
tombstone must not inherit a deleted user's private records.
→ `285c7036`, `715cc00b`

### Store listing art, generated
`npm run generate:store-art` → `public/store/`: a 1024×1024 App Store icon, a
512×512 Play icon, and a 1024×500 Play feature graphic. All three are **colour
type 2** — read back out of the PNG header, not promised by the encoder.

⚠️ **The note above this said "the existing `icon-512.png` has an alpha channel
and will be rejected as-is", which is true and led to the wrong fix.** Stripping
its alpha was never the answer: **150,377 of its 262,144 pixels are FULLY
transparent**. The mark is a logo floating on nothing, not a tile with soft
corners, so removing the channel without choosing what sits behind it composites
the artwork onto whatever the encoder defaults to.

⚠️ **The source is `public/CharitMe_Logo.png` (1254×1254), NOT
`public/icons/icon-source.svg`.** That SVG draws a purple tile with a white heart;
the shipped mark is a red heart with a "C" between a purple and an orange hand.
Caught by reading the centre pixel — `(209,3,1)`, red — before trusting a filename
that says "source". Rendering it would have produced a clean, confident, wrong
icon. 1254 also means the 1024 is downscaled rather than upscaled from the 512.

⚠️ **White is measured, not taste.** `#000000` (matching `background_color`, so
the icon would flow into the splash) and `#6d35ff` (`theme_color`) were both
generated and looked at first. Both show a light blob between the hands: the
artwork's alpha is **binary**, and the gap between the hands is filled with
**opaque near-white** — `(627,860)` and `(627,900)` both read `[246,246,245,255]`.
A leftover white background baked inside the silhouette is invisible on white and
visible on everything else. `--background` takes any colour once that fill is made
transparent.

Feature-graphic copy is **read from `app/manifest.ts`**, never written for the
listing — store text that disagrees with the app's own manifest is the defect
class removed from /corporate-partnerships.

`__tests__/store-listing-art.test.ts` asserts sizes and the absence of an alpha
channel, and is mutation-tested against a planted RGBA icon and a wrong-sized one.
It also asserts the **web** icons still *do* carry alpha, so nobody "fixes" those
by flattening them and silently changes the installed app.

### The image inventory had drifted from what ships
`audit:image-assets` was failing on `master`: `screenshots/home.png` was
recaptured after its entry was written so its recorded hash was stale, and
`campaigns.png`, `donate.png` and `how-it-works.png` were never inventoried at
all. All four are corrected and the three new store assets added — 39 entries,
39 raster files.

---

## 🔴 Open — blocking a submission

### 1. The tombstone migration is not applied to production
`supabase/migrations/20260904030000_deleted_user_tombstone.sql` is #47 in the
pending ledger. **Until it is applied, self-service deletion cannot be switched
on**, and without deletion an iOS submission fails 5.1.1(v).

The endpoint fails safe meanwhile: it refuses with `TOMBSTONE_MISSING` (503)
rather than deleting, so an unapplied migration disables the feature instead of
corrupting anything. `tombstonePresent` is `boolean | null` and `null` refuses too
— "could not confirm it exists" is not "it exists".

⚠️ **Still cannot be applied from here, and a working service-role key does NOT
change that.** One was supplied on 2026-08-10 and verified working (reads return
200; `donations` counts 740 rows exactly) — it fixed the screenshot capture, but
it cannot run DDL: **PostgREST executes RPCs, not schema changes**. Applying
migrations needs a `SUPABASE_ACCESS_TOKEN` (Management API) or the database
password, neither of which is present.

Runbook: **`docs/apply-pending-migrations.md`**, which also flags that a single
`db push` applies 46 other migrations, three of them recorded by their own authors
as needing staging verification first.

✅ **But the whole batch is not the only route, and this blocker is one paste
away.** The Supabase **SQL editor** runs as `postgres`, not through PostgREST, so
it executes migration SQL directly — proved 2026-08-10, when the owner applied
`20260904040000_default_support_percent_ten` that way and the live donate card
changed within the minute.

This migration is **safe to run alone**: pure DML (two `INSERT`s and a `COMMENT`),
both inserts `ON CONFLICT DO NOTHING` so it is idempotent, it deletes nothing, it
creates no schema, and it depends on nothing else in the pending batch —
`auth.users` and `public.profiles` already exist. It writes no ledger row, so
`migration list` will still call it pending and a later `db push` re-runs it as a
no-op. Steps and the verification query are in the runbook under *"You do not have
to push all 47 to unblock deletion"*.

### 2. `ACCOUNT_SELF_DELETE_ENABLED` is off
Deliberate: `master` deploys straight to production, and an irreversible delete
must not arrive as a side effect of a merge. Set to `true` **after** the migration
is applied. Until then the endpoint 404s and the UI keeps the review-queue flow.

### 3. No native shells exist
No Capacitor project, no Bubblewrap project, no Xcode project. This is the gap
between "the website is store-ready" and "there is something to upload".

### 4. Store credentials, which unblock the association files
- Play App Signing SHA-256 → `ANDROID_SHA256_FINGERPRINT` + `ANDROID_PACKAGE_NAME`
  ⚠️ Read it from **Play Console → Setup → App integrity**, not from a local
  keystore. Using the upload certificate is the single most common way that file
  ends up present and wrong.
- Apple `TEAMID.bundle.id` → `IOS_APP_ID`

### 5. ⚠️ Apple Guideline 4.2 "minimum functionality"
A web view in a native shell is the most common rejection for a site-as-app.
Mitigation is native capability — push notifications, share sheet, biometric
unlock — which is app work, not repo work. Flagged so it is a decision rather
than a surprise at review.

---

## 🟡 Open — not blocking

### Privacy declarations
- iOS `PrivacyInfo.xcprivacy` + App Privacy answers
- Play Data safety form

Both collect: email, donation/payment data, and campaign content. Neither exists
yet; both are store-console forms rather than repo files, but the answers must
match what the code actually collects.

### Store listing art
**Per-device screenshots** are still outstanding — those are device-frame captures
made in the store consoles, not repo files.

The three repo-ownable pieces are now generated: see *Store listing art, generated*
under Applied.

---

## Decisions deliberately NOT taken

**Edge-to-edge (`viewport-fit: cover`) was proposed and rejected — twice.** My
mobile pass opened with it plus safe-area insets, the standard fix. A prior
session had already made that call and reverted it, leaving
`__tests__/viewport-safe-area.test.ts` behind: the `contain` default lays the page
out inside the display's safe rectangle, so nothing renders under the home
indicator and `env()` correctly returns `0`. Opting out makes **every**
edge-anchored element the author's problem at once. My version handled three
insets and missed `top`, so the guard would have failed it.

The guard does not forbid `cover` — it forbids `cover` **without all four
insets**. If a native shell later needs edge-to-edge, that is the bar to clear.

---

## Commands

```bash
npm run capture:screenshots -- --base http://127.0.0.1:4123   # needs a live build
npx vitest run __tests__/manifest-contract.test.ts
npx vitest run __tests__/app-store-associations.test.ts
npx vitest run __tests__/deletion-cascade.test.ts
npx vitest run __tests__/account-self-deletion.test.ts
npx vitest run __tests__/store-listing-art.test.ts
npm run generate:store-art          # regenerates public/store/ from the 1254px logo
npm run audit:image-assets          # every raster inventoried, hashed, provenanced
```

## Environment variables this work introduced

```
ANDROID_PACKAGE_NAME            # e.g. com.charitme.app
ANDROID_SHA256_FINGERPRINT      # Play Console → Setup → App integrity, colon-separated hex
IOS_APP_ID                      # TEAMID.bundle.id
ACCOUNT_SELF_DELETE_ENABLED     # "true" to arm self-service deletion; anything else is off
```
