# Campaign Builder Audit

## Current-State Findings

| Current step or surface | Purpose | Friction or risk | Duplicate? | Required? | Decision |
|---|---|---|---|---|---|
| `/create/choose-path` | Select AI or guided creation | Correct concept, but links to two unrelated implementations | No | Yes | Keep and point both choices at one builder |
| `/ai-campaign` | Collect an AI prompt | Text-only; no voice, files, or links; hands off to a second wizard | Partial | AI only | Redesign as the AI intake for the shared builder |
| `/create/ai` | Twelve-step AI campaign wizard | No shared autosave, resume, readiness, or preview; publishes before its final steps | Yes | No | Redirect legacy links into the shared builder |
| `/create` essentials | Collect title, story, and goal together | Fast, but presents a dense form and does not honor one-question-per-screen | Yes | Yes | Split into progressive guided steps; AI may prefill them |
| `/create` basics | Collect beneficiary, category, and location | Three decisions on one screen | Yes | Conditional | Split into beneficiary, category, and location steps |
| Media upload | Add cover/gallery images | Uploads to Storage but does not create `campaign_media` rows at publish | No | Yes for launch quality | Keep, enforce 5 MB, and persist media records atomically |
| Rewards | Optional campaign rewards | Useful only for some campaign types and interrupts donation-first flow | No | No | Move behind optional campaign settings |
| Payout | Connect recipient account | Alternative handles are stored in an unrelated profile website field and cannot receive platform payouts | No | Yes before accepting donations | Use verified Stripe Connect readiness only |
| Verification | Explain external verification | Status is not read back and publication is not gated | No | Yes | Require organizer identity; require nonprofit verification when claimed |
| Review | Show readiness checklist | Only title, story, and a $1 goal block publication | No | Yes | Expand to the complete launch contract |
| Preview modal | Preview donor page | Only mobile/desktop modes; no social or checkout summary | No | Yes | Add all four preview modes and section edit links |
| Draft autosave | Local and Supabase resume | Strong base; stores unversioned opaque JSON and hardcodes analytics to guided | No | Yes | Keep, add path/schema version/history, and correct analytics |
| Campaign create API | Validate and insert campaign | Child records are written after publish or not at all; no transactional shared model | No | Yes | Validate one payload and create campaign plus child records atomically |
| AI generation API | Draft fundraising copy | Response is not schema-validated and rich output is discarded by `/create` | Partial | AI only | Validate structured output and map every generated field into the shared model |

## Target Journey

Both paths use the same draft, form model, readiness engine, preview, and publish endpoint.

1. Choose **Build with AI** or **Build Step by Step**.
2. AI accepts a prompt plus optional voice, photos, documents, and links, then fills every field it can and asks only for missing facts.
3. Guided creation asks one primary question at a time with smart defaults.
4. Every meaningful change saves locally and, once signed in, to Supabase with version history.
5. Both paths end at the same four-mode preview and readiness checklist.
6. The server independently verifies required profile, payout, verification, policy, content, media, and budget state before one atomic publish transaction.
