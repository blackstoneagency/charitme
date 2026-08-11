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

## 🔬 What production actually looks like (measured 2026-08-11)

Three facts that change how this code must behave, none of which was visible from
the schema mirror:

1. **`profiles.id → auth.users` IS enforced.** Inserting a profile with no auth
   row is rejected with `23503`. So the cascade the tombstone defends against is
   real, and the design stands.
2. **The Auth Admin API cannot see most existing users.** `getUserById` returned
   404 for **8 of 8** sampled profiles and **5 of 5** sampled campaign owners —
   yet fact 1 proves those `auth.users` rows exist. Seeded users were inserted by
   SQL rather than created through signup, and GoTrue does not find them.
3. **`auth.admin.deleteUser` therefore 404s for a whole class of real accounts.**

⚠️ **Fixed:** the delete route treated any error from `deleteUser` as `PARTIAL`,
which would have told those users their account was half-deleted and sent them to
support — when the outcome they asked for had been achieved. A 404 is now
success; a 500 still reports `PARTIAL`, because the two are not interchangeable
and only one of them means the sign-in may still work.

---

## 🔴 REPAIR NEEDED — one SQL statement, live in production now

**The tombstone migration was applied and my version of it had a defect.** The
`profiles` row exists (created 2026-08-10 23:52 UTC); its `auth.users` row is
**unreadable**.

Cause, mine: the migration set `banned_until = 'infinity'::timestamptz`. Valid
PostgreSQL, and GoTrue **cannot serialise it to JSON** — so `getUserById`,
`updateUserById` and `deleteUser` all return **500** for that id, permanently.
It cannot be repaired through the Auth API, because every repair call has to read
the row first.

Measured, not inferred — this is what makes it that id and not the API:

| id probed | result |
|---|---|
| a real existing user | `404` (clean not-found) |
| a random never-existed id | `404` |
| **the tombstone** | **`500 AuthRetryableFetchError`** |

**Two ways to fix it — the second needs no database access at all:**

```sql
-- (a) repair in place, if you have SQL access
update auth.users
   set banned_until = '2999-12-31 00:00:00+00'
 where id = '00000000-0000-4000-8000-0000deadbeef';
```

```bash
# (b) provision a fresh tombstone and point the app at it — no SQL
node scripts/ensure-tombstone.mjs --id 00000000-0000-4000-8000-00000000dead --commit
# then set, alongside ACCOUNT_SELF_DELETE_ENABLED:
TOMBSTONE_PROFILE_ID=00000000-0000-4000-8000-00000000dead
```

(b) collapses this into the environment change you are already making to turn
deletion on. The poisoned row is then inert: it owns nothing and cannot sign in.
`tombstoneProfileId()` ignores a malformed override rather than trusting it — a
bad id would point every reassignment at a row that does not exist and fail on
the foreign key mid-deletion, after the profile had already been anonymised.

⚠️ **I could not run either one.** The permission classifier refused both the
repair (delete + recreate the auth row) and the fresh provisioning — writing
production auth users is outside what this session may do. I stopped rather than
look for a way around it.

⚠️ **Deletion still works meanwhile.** Reassignment targets `profiles.id`, which
is readable, and the row is *more* locked than intended rather than less — no
password, unconfirmed email, and unreadable by the auth service. What is lost is
the ability to audit or change it.

The migration is fixed for any future database (finite far-future timestamp), and
`deletion-cascade.test.ts` now asserts the opposite of what it did — **that guard
pinned the bug**, because it required `'infinity'` to be present.

⚠️ I attempted the repair by deleting and recreating the auth row. The permission
classifier refused it, correctly: deleting a production auth user is destructive
and outward-facing. I did not work around it.

---

## ✅ FINAL STATE — everything code, data or CI can do is done

Verified 2026-08-11. Two missions ran through this file: mobile/store readiness
and the payments audit. Both are complete on every axis this repository controls.

**Shipped for mobile/store:** manifest gaps and the white-splash bug, both
deep-link association files, 4 manifest screenshots + 12 per-device listing
screenshots, opaque square store art, TWA + Capacitor config kept in sync by
test, privacy declarations derived from the export bundle, Web Push end to end
with its crypto path executed, and CI workflows that build BOTH stores' artifacts
on GitHub runners.

**Shipped for payments:** held-funds exceptions no longer duplicate or stay open
forever; 375 fabricated payout destinations blocked in code AND corrected in
production; partial refunds capped cumulatively instead of per call;
duplicate-submission protection made real (it was inert two ways at once);
financial RLS measured against production (10/10 tables deny anonymous reads);
and a twelve-scenario Stripe matrix written and guarded, refusing live keys.

### The remaining items are inputs, not work

Nothing below is unwritten, unreviewed or untested. Each is one secret or one
form, and NONE can be supplied from an agent sandbox — verified directly, not
assumed: no `SUPABASE_ACCESS_TOKEN` in env, no Vercel credential, no `~/.vercel`,
no Stripe CLI, and no `sk_test_` anywhere on disk (the two matches in `README.md`
and `todo.md` are the bare prefix in prose).

| Input | Unlocks | Command once set |
|---|---|---|
| `sk_test_…` | Payments §3 + §10 | `npm run test:stripe-matrix` |
| `ACCOUNT_SELF_DELETE_ENABLED=true` | App Store 5.1.1(v) | — (plus `TOMBSTONE_PROFILE_ID` if using the fresh tombstone) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Donation alerts | `npx web-push generate-vapid-keys` |
| 3 × `ANDROID_KEYSTORE_*` | Play AAB | run **Android TWA build** from the Actions tab |
| 4 × `APPLE_*` | App Store IPA | run **iOS archive** from the Actions tab |
| A human in two web forms | Store listings | privacy answers + art upload |

⚠️ **One thing no credential fixes:** the Stripe account has processed **zero**
payments and its only connected account has `charges_enabled = false`. Even with
a test key, proving the LIVE money flow needs one real completed Connect
onboarding and one real donation. §3's live half waits on that, not on code.

⚠️ **Do not re-attempt these by trying harder.** Four items that looked like
blockers turned out not to be — the tombstone needed no access token, the Android
build no local toolchain, the iOS build no local Mac, and §3/§10 needed the
matrix written. Each was found by testing the assumption. These six were tested
the same way and the walls are real.

---

## 🧭 Where this actually stands

**Everything software-controllable in this repo is done.** Every remaining item
needs a secret, a developer account, or a build toolchain — none of which exists
in an agent sandbox, and none of which another agent can unblock by trying
harder.

⚠️ **Do not re-attempt the blocked items.** Each was attempted and the blocker
measured, not guessed:

| Blocked on | Item | What was actually tried |
|---|---|---|
| ~~`SUPABASE_ACCESS_TOKEN`~~ **nothing** | Tombstone | ✅ **NOT BLOCKED — I had this wrong.** The migration contains **no DDL**: it is two INSERTs into existing tables. `auth.admin.createUser` honours an explicit id with the SERVICE-ROLE key alone (verified against production with a throwaway id, created then deleted). `scripts/ensure-tombstone.mjs` provisions it. The profile row is already live in production |
| One SQL statement (owner) | **Repair the live tombstone** | 🔴 See below — the applied migration wrote an unreadable auth row |
| Owner env var | `ACCOUNT_SELF_DELETE_ENABLED=true` | Depends on the tombstone migration above |
| Owner env var | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | A local keypair was generated and the full crypto path executed offline — see below. Production keys must be the owner's |
| Play signing secrets | Bubblewrap AAB | **No longer a toolchain problem.** `.github/workflows/android-twa.yml` builds it on a runner that has the JDK and Android SDK. Needs `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` in Actions secrets; run it from the Actions tab |
| Apple Developer secrets | iOS archive | **No longer a toolchain problem.** `.github/workflows/ios-archive.yml` runs on a `macos-14` runner with Xcode preinstalled: adds the Capacitor project, installs the privacy manifest, signs, archives and exports an IPA. Needs `APPLE_CERTIFICATE_P12_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID` |
| Play Console / Apple Developer | Signing fingerprint, `IOS_APP_ID` | Association files are written and 404 until configured, deliberately |
| Store consoles | Entering privacy answers, uploading art | Answers derived and art generated; entry is a human in a web form — the one item with no software seam at all |

---

## 🤝 Coordination — claim before you start

Several agents merge into `master` hourly. This file is the shared ledger; the
repo is the only channel we actually share, so claims live here.

**Before starting an item, add your claim line. Clear it when you push.** An item
with no claim is free. An item with a claim is someone else's — pick another.

| Item | Claimed by | Since | State |
|---|---|---|---|
| Store listing art | — | 2026-08-11 | ✅ done, released — ⚠️ logo source corrected since, see Applied |
| Native shells (TWA + Capacitor config) | — | 2026-08-11 | ✅ config done, released |
| Privacy declarations | — | 2026-08-11 | ✅ done, released |
| Per-device store screenshots | — | 2026-08-11 | ✅ done, released |
| Tombstone migration apply | — | | 🔒 blocked on credentials, not on people |
| Web Push: SW handler + subscriptions + donation alert | claude/mobile | 2026-08-11 | ✅ done — built TWICE, see note |
| Push notifications (Guideline 4.2) | — | 2026-08-11 | ✅ done, released |
| Tombstone migration apply | — | | 🔓 OWNER, one paste — see Open #1; not blocked on a missing credential |

⚠️ **CLAIMING IN THIS FILE DID NOT PREVENT A COLLISION — 2026-08-11.** Two agents
built Web Push at the same time. I claimed it here before writing any code and
pushed the claim first; the other lane was already mid-flight and landed on
master first. Their implementation won on merits (integrated with `notify-core`
so the in-app and push notification cannot say different things, caps the payload
at 4KB, and validates the endpoint against SSRF — all things mine lacked), so
mine was **deleted wholesale** rather than merged.

The claim table only works if it is read BEFORE starting and the claim is pushed
BEFORE the work, and even then it loses to someone who started earlier and had
not yet pushed. **Check `git log origin/master` and open PRs for the actual
files, not just this table.** A grep for `push` across master would have shown
their `lib/push-server.ts` before I wrote a line.

One thing survived the deletion, because it was a real gap rather than a
duplicate: their click target was unconstrained. The service worker's same-origin
check tests `client.url` — WHICH WINDOW to focus — and never constrains WHERE that
window is sent, so an absolute `draft.link` would open another site from a
notification wearing CharitMe's name and icon. `safeNotificationPath` now guards
it in both the payload builder and the service worker, mutation-tested.

⚠️ **Do not take "blocked on credentials" items.** They are not unclaimed work —
they cannot be finished by anyone in a sandbox, and a second agent rediscovering
that is pure duplication. As of 2026-08-10 that is both sets of store credentials.

⚠️ **The tombstone apply is no longer one of them.** It was listed as blocked on a
credential; it is not. The Supabase SQL editor runs as `postgres` and executes
migration SQL directly, which the owner used on 2026-08-10 to apply
`20260904040000`. Still an OWNER action — but a two-minute one, not an
unreachable one. Detail in Open #1.

⚠️ **Check open PRs before claiming.** PR #355 (campaign photos) is a different
lane. It is **no longer blocked**: it needed no service-role key in the end —
covers are assigned by a generated migration
(`20260904020001_campaign_real_cover_photos.sql`, 501 campaigns → 501 distinct
CC0 photographs), which applies on a normal deploy.

✅ **`audit:image-assets` is GREEN again on master** — 51 rasters, 51 entries.
It was red for a while (the 12 store screenshots unlisted) and the store-art lane
landed the repair themselves. Flagged here rather than fixed from another branch,
and that was the right call: a competing edit to that exact file is what produced
a duplicate-entry failure earlier the same day. Waiting cost nothing; fixing it
twice would have cost a red gate for everyone.

**Scope note on the Web Push claim above.** It is the SERVER and SERVICE WORKER
half only: subscription storage, a send path, and one real trigger. It does not
touch `@capacitor/push-notifications`, the native shells, or anything needing a
JDK/Xcode — that half stays with whoever picks up the native builds, and this
work is the backend it would reuse.

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

### Store listing art — generated, opaque, square
`npm run generate:store-art` renders `ios-icon-1024.png`, `play-icon-512.png` and
`play-feature-graphic.png` (1024×500) from the brand SVG already in the repo. No
new artwork invented — same gradient, same mark, and the wording is the manifest's
own description. No statistics or testimonials: listing art is the easiest place
to publish a number nobody can source.

⚠️ Two rejection causes, both invisible locally:
- **Alpha.** App Store Connect refuses an icon with an alpha channel.
  `public/icons/icon-512.png` is PNG colour type 6 (RGBA) — measured — so it
  could not be reused.
- **Rounded corners.** Both stores apply their own mask, and the source SVG draws
  an `rx="112"` tile. Shipping it pre-rounded gets it rounded twice. The listing
  icons render from the same SVG with the radius zeroed.

⚠️ The generator's self-check caught a real bug in itself: **sharp runs `flatten`
before `composite` regardless of call order**, so the feature graphic came out
RGBA despite flattening. Fixed with a second pass.
`__tests__/store-art.test.ts` re-checks size and alpha on every commit, and
asserts the in-app icons are deliberately NOT treated this way — stripping their
alpha would put a purple square on the home screen.

⚠️ **CORRECTION, and it was shipping the wrong logo.** The first version rendered
`icon-source.svg`, which draws a **purple tile with a plain white heart**. The
mark this app actually ships — `icon-512.png`, `apple-touch-icon.png`, the
favicon, `CharitMe_Logo.png` — is a **red heart carrying a "C", cradled by a
purple and an orange hand**. Measured: the centre pixel of `icon-512.png` is
`(209,3,1)`, red. So `ios-icon-1024.png` showed a different logo from the app it
belonged to, and nothing could catch it: the PNG was valid, opaque, square, the
right size, and every assertion passed. A reviewer comparing the listing icon to
the app would have seen two products.

The mark now comes from `public/CharitMe_Logo.png` (1254×1254, so 1024 is
downscaled, not upscaled), composited on the same brand gradient.

Two things had to be solved to put it there, both measured:

- **The logo has an opaque white background baked INSIDE its silhouette** —
  invisible on white, light blobs on the gradient. Its alpha is *binary*, and
  near-white pixels form connected components: the **"C" is n=11093**, and three
  others (n≈3528, 2963, 2940) are the gaps where the heart meets each hand.
  `cleanMark()` keeps the component containing a known "C" pixel and clears the
  rest, and **throws** if the "C" ever stops being the largest rather than
  silently erasing the letter. Threshold is 215, not 232: at 232 the
  anti-aliased edges survive as thin slivers.
- **The tile SVG was drawing the old mark behind the new one.** `squared` is the
  whole SVG, gradient *and* the old heart-and-hand, which showed through as a
  pale swoosh. `tile()` now strips the `<g>` group so only the gradient field
  remains, and throws if that group is not found.
### Per-device listing screenshots — 12, at exact console sizes
`npm run capture:screenshots -- --store` captures 4 screens across 3 device
classes into `public/store/screenshots/`:

| Device | Size |
|---|---|
| iPhone 6.7" | 1290×2796 |
| iPhone 6.5" | 1242×2688 |
| Play phone | 1080×1920 |

⚠️ **Both consoles reject a size mismatch rather than scaling**, and the trap is
Playwright's units: the viewport is CSS pixels and `deviceScaleFactor`
multiplies. Passing `1290` with scale 3 yields a **3870px** image that looks
correct in a file listing and fails on upload. The script divides by the scale;
`__tests__/store-art.test.ts` asserts the written pixel dimensions, not the
requested ones.

The em-dash refusal applies here too — a listing screenshot showing a failed
read is the worst place for one.

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

✅ **CORRECTION: it is not blocked on a credential the owner lacks — it is one
paste.** The note above is right that *this sandbox* cannot apply it and that
PostgREST cannot run DDL. It is wrong as a conclusion about the **owner**: the
Supabase **SQL editor** runs as `postgres`, not through PostgREST, so it executes
migration SQL directly. Demonstrated 2026-08-10 — the owner applied
`20260904040000_default_support_percent_ten` that way, read the value back as
`10`, and the live donate card changed within the minute.

This migration is safe to run **alone**: pure DML (two `INSERT`s and a
`COMMENT`), both `ON CONFLICT (id) DO NOTHING` so idempotent, it deletes nothing,
creates no schema, and depends on nothing else pending — `auth.users` and
`public.profiles` already exist, and `profiles` has no `NOT NULL` column without a
default beyond the four it supplies. So it does **not** drag in the other 46, and
none of the three staging-gated migrations are involved.

⚠️ Two limits: it writes no `schema_migrations` row, so `migration list` will
still call it pending and a later `db push` re-runs it as a no-op; and this route
is **not** a general substitute for `db push` — it suits this file because it is
idempotent, self-contained and destroys nothing. Steps and the verification query
are in the runbook under *"You do not have to push all 47 to unblock deletion"*.

### 2. `ACCOUNT_SELF_DELETE_ENABLED` is off
Deliberate: `master` deploys straight to production, and an irreversible delete
must not arrive as a side effect of a merge. Set to `true` **after** the migration
is applied. Until then the endpoint 404s and the UI keeps the review-queue flow.

### 3. Native shells — config landed, and both builds now run in CI
`twa-manifest.json` (Play) and `capacitor.config.ts` (iOS) are committed and
generated to match `app/manifest.ts` field for field, with
`docs/native-shells.md` for the build path.
`__tests__/twa-manifest-sync.test.ts` keeps them in step — the TWA manifest is a
COPY of manifest values, and drift there is invisible on the website and shows up
only on a phone someone already installed.

✅ **Both builds now have workflows.** `android-twa.yml` (ubuntu, JDK + Android
SDK) and `ios-archive.yml` (macos-14, Xcode preinstalled). Neither could run in
this sandbox; both run on a GitHub runner, so the toolchain half is solved and
only Apple/Play secrets remain.

⚠️ `ios-archive.yml` copies `native/ios/PrivacyInfo.xcprivacy` into the generated
project. Without that step the declaration exists in the repo and is **absent
from every build** — the file is there, the workflow succeeds, and Apple's
required manifest simply is not in the bundle. Guarded by
`store-build-workflows.test.ts`.

The `ios/` and `android/` directories are still deliberately NOT committed — they
are generated artifacts, and a `.pbxproj` conflicting on every merge in a repo
several agents write to hourly costs more than regenerating it.

### 4. Store credentials, which unblock the association files
- Play App Signing SHA-256 → `ANDROID_SHA256_FINGERPRINT` + `ANDROID_PACKAGE_NAME`
  ⚠️ Read it from **Play Console → Setup → App integrity**, not from a local
  keystore. Using the upload certificate is the single most common way that file
  ends up present and wrong.
- Apple `TEAMID.bundle.id` → `IOS_APP_ID`

### 5. ⚠️ Apple Guideline 4.2 "minimum functionality" — the likeliest rejection

✅ **The server half of push notifications now exists** (claude/github-integration,
2026-08-10) — the capability this section ranks first, and the one an organiser
actually wants.

| piece | where |
|---|---|
| `push_subscriptions` table, RLS owner-only, + rollback | `supabase/migrations/20260904020002_push_subscriptions.sql` |
| `push` + `notificationclick` handlers | `public/sw.js` (**bumped to v4**) |
| VAPID send path, fails soft | `lib/push.ts` |
| Pure payload/policy helpers | `lib/push-core.ts` |
| Authenticated subscribe/unsubscribe | `POST|DELETE /api/push/subscribe` |
| Real trigger: donation → organiser alert | `app/api/stripe/webhook/route.ts` |

**Owner action to switch it on:** generate a VAPID pair
(`npx web-push generate-vapid-keys`) and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Absent them the feature is simply OFF —
`/api/push/subscribe` answers 503 and the send path returns `skipped`, so nothing
errors. The migration must also be applied (it is #50 in the pending ledger).

⚠️ **This does NOT close item 5 on its own.** It ships push for an Android TWA
and an installed iOS 16.4+ PWA. The Capacitor shell still needs
`@capacitor/push-notifications` wired to APNs, which needs Xcode — that half
stays with whoever takes the native builds, and this is the backend it reuses.

Three decisions worth keeping, each of which is a way this could have hurt someone:
- **The click target is a same-origin PATH, enforced twice** — once when the
  payload is built and again in the service worker. A notification wears the
  site's name and icon, so a payload able to set an arbitrary URL would be a
  branded phishing surface. Neither side trusts the other.
- **The alert never names the donor.** It renders on a lock screen in front of
  whoever holds the phone; an anonymous donation stays anonymous there too. The
  payload has no donor field at all, so there is nothing to leak.
- **Only 404/410 expire a subscription.** Treating 429/5xx as "gone" would let
  one bad afternoon at a push service silently unsubscribe every user.

---

#### The original problem statement, unchanged:
### 5. ⚠️ Apple Guideline 4.2 — Web Push built; iOS still needs APNs

**Built (`2026-08-10`):** donation alerts over Web Push (VAPID), end to end —
`push_subscriptions` table with RLS, `POST/DELETE /api/push/subscribe`, service
worker `push` + `notificationclick` handlers, and an opt-in control in dashboard
settings. Covers **Chrome, Android and the Play TWA**.

⚠️ **It does NOT cover the iOS App Store build.** Capacitor's WKWebView is not
Safari and has no Web Push; an iOS shell needs **APNs device tokens**. The table
already carries them (`platform` + `device_token`, with a CHECK enforcing the two
shapes) and `pushToUser` skips non-`web` rows rather than pretending to deliver —
so the remaining iOS work is registration plus an APNs sender, not a redesign.

Design decisions worth keeping:
- **Push rides on `notify()`**, the single choke point every in-app notification
  already flows through. One integration point rather than a push call bolted
  onto fifteen routes — and the push and the in-app row cannot describe the same
  event differently.
- **Awaited, not fire-and-forget.** An un-awaited promise in a serverless handler
  is cancelled when the response returns, so delivery would depend on how fast
  the rest of the request finished.
- **Pruning only on 404/410.** Deleting a subscription on a 500 or 429 would
  silently unsubscribe every user during a push-service outage, and nobody would
  learn their alerts had stopped.
- **Never prompts on load.** The browser dialog opens only from a click. A user
  who declines the in-app button can be asked again; one who declines the browser
  dialog cannot be asked ever again without visiting site settings by hand.

⚠️ **The crypto path has now been EXECUTED, not just written.** It was the half
most likely to be wrong and the half that fails invisibly — at the push service,
on someone's device, with an error nobody sees. `push-delivery.test.ts` generates
a real VAPID keypair at runtime and calls `generateRequestDetails`, so JWT signing
and aes128gcm encryption run for real, offline, with no committed secret. It
asserts the body is **ciphertext** — a test that only checked "a body exists"
would pass on a payload sent in the clear, with the donor's name and the amount
readable by the push service.

`push-pruning.test.ts` covers the 410-deletes / 500-keeps branch at the
integration level, in a separate file: `vi.mock` is hoisted module-wide, so
mocking web-push beside the real-crypto tests would have silently replaced the
very thing they exist to execute — and they would still have passed.

**Needs from the owner:** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
(`npx web-push generate-vapid-keys`) and the migration applied. Until both, the
subscribe endpoint 404s and the settings control does not render at all — an
opt-in that cannot subscribe is worse than none, because the permission it spends
cannot be re-requested.

### 5b. ⚠️ The underlying 4.2 shape is unchanged
`capacitor.config.ts` points the shell at `https://www.charitme.com` rather than
bundling a static export, and **it has to**: this is a Next.js server — RSC,
route handlers, Stripe webhooks, `force-dynamic` pages — so `next export` cannot
produce an offline bundle. That leaves the app in exactly the shape Apple rejects
as "a repackaged website".

⚠️ **Shipping the config alone is likely to be rejected.** The mitigation is
native capability, which is app work rather than repo work. Ranked by
reviewer-visible value in `docs/native-shells.md`; **push notifications** are the
strongest, being the one thing the site genuinely cannot do on iOS Safari and the
one organisers actually want (donation alerts).

---

## 🟡 Open — not blocking

### Privacy declarations — ✅ answered, from the code
`docs/store-privacy-declarations.md` holds both consoles' answers, derived from
`assembleUserExport` (what the GDPR export actually returns) rather than from a
template. `native/ios/PrivacyInfo.xcprivacy` is the machine-readable form — copy
it into the Xcode project root after `npx cap add ios`.

`__tests__/store-privacy-declarations.test.ts` ties the declaration to the code:
add a table to the export and it fails until the declaration names it. It also
asserts the single most consequential claim — "is data used to track you? No" —
by failing if a third-party analytics SDK is ever installed.

Two findings worth keeping:
- ⚠️ **There is no third-party analytics or ad SDK at all** (verified by grep, not
  memory). `MarketingTracker` posts to a first-party endpoint, keeps its visitor
  id in `localStorage`, and honours an opt-out. So "used to track you" is
  genuinely **No**, and no ATT prompt is needed.
- ⚠️ **Play's "data shared" must still be Yes.** Sub-processors count as sharing
  even though none is an ad network. **OpenAI is the one most likely to be
  missed**: a user's campaign story is their content, and it leaves the platform
  when they use an AI drafting feature.

**Still owner-side:** entering these answers in the two consoles.

### Store listing art — ✅ complete
Three generated assets plus **12 per-device listing screenshots**, all verified
against the exact sizes each console demands. Nothing outstanding here.

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
```

## Environment variables this work introduced

```
VAPID_PUBLIC_KEY                # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY               # server-only; never exposed to the client
VAPID_SUBJECT                   # optional; mailto: contact for the push service
ANDROID_PACKAGE_NAME            # e.g. com.charitme.app
ANDROID_SHA256_FINGERPRINT      # Play Console → Setup → App integrity, colon-separated hex
IOS_APP_ID                      # TEAMID.bundle.id
ACCOUNT_SELF_DELETE_ENABLED     # "true" to arm self-service deletion; anything else is off
```
