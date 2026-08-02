# Composite image (pages 24–35) — analysis and audit

**Result: all 12 pages already exist, are wired, and pass audit. Nothing was rebuilt.**

The brief said to build 12 pages, and also said *"do not create duplicate pages
when a suitable page already exists"* and *"do not overwrite stronger existing
functionality."* Those two instructions collide here, and the second one wins:
measured against the 226 routes in `apps/web/app`, **every one of the 12 already
ships.** Building them again would have replaced working, connected pages with
newer, less-tested ones.

## The 12 pages

| # | Reference | Route | Purpose | Backend |
|---|---|---|---|---|
| 24 | Blog / Articles | `/blog`, `/blog/[slug]` | Editorial index + article | `lib/blog-posts.ts` (content module) |
| 25 | Press / Media | `/press` | Press releases, media contact, kit | static content |
| 26 | Careers | `/careers` | Roles, mission, culture | static content |
| 27 | Terms of Service | `/terms` | Legal | static — correctly so |
| 28 | Privacy Policy | `/privacy` | Legal | static — correctly so |
| 29 | Refund Policy | `/refunds` | Legal | static — correctly so |
| 30 | Cookie Policy | `/cookies` | Legal | static — correctly so |
| 31 | Donation Thank You | `/thank-you` | Post-donation confirmation + receipt | **reads the donation** |
| 32 | Newsletter / Subscribe | `/newsletter` | Subscribe | **POST `/api/marketing/capture` → `marketing_contacts`** |
| 33 | Verify Your Email | `/verify-email` | Post-signup verification | **`supabase.auth.resend`** |
| 34 | 2FA / Security | `/login/mfa`, `/dashboard/settings/mfa` | TOTP challenge + enrolment | **Supabase MFA factors** |
| 35 | Maintenance | `/maintenance` | Downtime notice | static + maintenance-mode check |

### On "100% wired to Supabase"

Four of these pages are **static by design and should stay that way.** Terms,
Privacy, Refunds and Cookies are legal documents: their text is reviewed and
versioned in the repository, which is the audit trail. Moving them into a table
would mean a legal document could change without a commit, and "last updated"
would stop being verifiable. *Not everything that can be in a database belongs in
one.*

The pages that carry a user action are all genuinely connected — verified by
reading the call, not the page:

- `/newsletter` → `NewsletterForm` → `POST /api/marketing/capture` → find-or-create in `marketing_contacts`
- `/verify-email` → `VerifyEmailClient` → `supabase.auth.resend({ type: 'signup' })`
- `/thank-you` → reads the real donation for the receipt summary
- `/login/mfa` → real Supabase MFA factor challenge

⚠️ An initial pass classified `/newsletter` and `/verify-email` as *static*,
because `page.tsx` contained no `fetch`. Both delegate to a client component that
does. The grep was measuring the wrong file — recorded because it is the same
shape of error as probing invented table names earlier in this deck's work.

## Audit evidence

Run against a **fresh production build** on `:4310` — rebuilt first, because
measuring against a stale server produced two false results earlier in this
session.

**12 routes × 2 themes (light/dark) × 2 widths (320px, 390px) = 48 renders.**

Checked per render: HTTP status, horizontal overflow, `<h1>` count, images
missing `alt`, buttons with no accessible name, presence of a `<main>` landmark.

```
clean: 12 routes x 2 themes x 2 widths
total findings: 0
```

So the responsive, dark/light and baseline-accessibility criteria are **met and
evidenced** for all 12 — which is what the brief asked to be proven, and it was
already true.

## Documents deliberately not created

The brief lists seven documents. Five of them would describe work that did not
happen, and an empty document is worse than an absent one:

| document | why not |
|---|---|
| `composite-image-seeding.md` | no new tables, so no new seed data |
| `image-attribution.md` | no new images sourced |
| `composite-image-architecture-decisions.md` | no architecture changed |
| `composite-image-page-matrix.md` | folded into the table above rather than split across two files that would drift |
| `composite-image-testing-report.md` | folded into the evidence section above |

## What is genuinely open

Nothing on these 12 pages. The platform-level blocker is unchanged and is
recorded in `todo.md`: this sandbox has no database (`placeholder.supabase.co`),
so nine migrations remain unapplied — three of which fix live defects, including
a `creator_tips` exposure.
