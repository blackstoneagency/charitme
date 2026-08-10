# App Privacy (Apple) and Data safety (Play) — the answers, and where they come from

Both consoles ask what the app collects. The answers below are **derived from the
code**, not from a template, because a wrong answer here is a compliance problem
rather than a paperwork problem — Apple treats a mismatch between the declaration
and observed behaviour as grounds for removal.

The authoritative source for "what we hold about a user" is
`lib/privacy.ts → assembleUserExport`. It is what the GDPR export actually
returns, so if a table is not in it, either we do not hold that data or the
export is incomplete — and both are worth knowing before answering a store form.
`__tests__/store-privacy-declarations.test.ts` fails if a table joins that bundle
without appearing here.

## What is collected

| Data | Where it lives | Linked to identity | Purpose |
|---|---|---|---|
| Email address | `profiles.email` | Yes | Account, receipts, notifications |
| Name | `profiles.full_name` | Yes | Attribution on campaigns and gifts |
| Photo / avatar | `profiles.avatar_url` | Yes | Profile display |
| Payment info | `donations`, `payouts`, `subscriptions` | Yes | Processing donations and payouts |
| User content | `campaigns`, `campaign_updates`, `donor_messages` | Yes | The product itself |
| Support content | `support_cases`, `privacy_requests` | Yes | Answering the user |
| Applications | `volunteer_applications`, `grant_applications`, `sponsorship_requests` | Yes | The feature the user used |
| Saved items | `saved_campaigns` | Yes | The user's own list |
| Product interaction | first-party visitor id + `/api/marketing/event` | **No** | Analytics |

⚠️ **Card numbers are NOT collected.** Checkout is a redirect to Stripe; what
comes back is a payment-intent id. "Payment info" is declared because donation
amounts, payout records and Stripe customer ids are held — not because card data
is.

## What is NOT collected, stated because reviewers check

- **No third-party analytics or advertising SDK.** There is no Google Analytics,
  no Firebase, no Meta SDK, no PostHog, no Segment — verified by grep, not by
  memory. `components/MarketingTracker.tsx` posts to a **first-party** endpoint,
  keeps its visitor id in `localStorage`, and honours an opt-out key.
- **No location.** No geolocation API is called anywhere.
- **No contacts, photos library, camera, microphone, health or financial account
  access.**
- **No advertising identifier (IDFA), and no ATT prompt**, because nothing here
  tracks across other companies' apps or sites.

## Apple App Privacy — answers

| Question | Answer |
|---|---|
| Does the app collect data? | **Yes** |
| Is data used to track you? | **No** — nothing is shared with a data broker or ad network, and no identifier is joined across other companies' properties. That is the definition of tracking, not "we have analytics". |
| Data linked to the user | Email, Name, Photo, Payment Info, User Content, User ID, Support Content |
| Data not linked to the user | Product Interaction |

`native/ios/PrivacyInfo.xcprivacy` is the machine-readable form. **Copy it into
the Xcode project root** after `npx cap add ios`; `ios/` is not committed.

⚠️ It declares `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`.
Capacitor's WebView reads UserDefaults, and omitting the required-reason entry
starts as a build warning and becomes a rejection.

## Play Data safety — answers

| Section | Answer |
|---|---|
| Data collected | Personal info (name, email), Financial info (purchase history), Photos, Messages, App activity |
| Data shared with third parties | **Yes** — see the processors below |
| Data encrypted in transit | **Yes**, HTTPS only. `capacitor.config.ts` sets `cleartext: false` and `allowMixedContent: false` |
| Can users request deletion? | **Yes** — `/privacy-center`, and self-service deletion once `ACCOUNT_SELF_DELETE_ENABLED` is on (see `mobileGo.md`) |
| Data collection optional? | Account data is required to fundraise or donate; analytics is opt-out |

⚠️ **"Data shared" must be Yes.** Sub-processors receive user data to do their
job, and Play counts that as sharing even though none of them is an ad network:

| Processor | Receives | Why |
|---|---|---|
| Stripe | Name, email, payment details | Processing donations and payouts |
| Supabase | Everything above | The database and auth provider |
| Resend | Email address, message body | Transactional email |
| OpenAI | Campaign text the user submits to an AI feature | Drafting assistance |

⚠️ OpenAI is the one most likely to be missed: a user's campaign story is *their*
content, and it leaves the platform when they use an AI drafting feature.

## Account deletion — required by both stores

Play requires a deletion route reachable **from outside the app** as well as in
it. `https://www.charitme.com/privacy-center` is that URL and should be entered
in the Data safety form.

⚠️ In-app deletion is currently the review-queue flow. Self-service deletion is
built but **off** — it needs the tombstone migration applied and
`ACCOUNT_SELF_DELETE_ENABLED=true`. Apple's 5.1.1(v) wants initiate-and-complete
in the app, so **submitting before that switch is on risks rejection**.
