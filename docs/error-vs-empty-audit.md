# `if (error) return []` — the loaders that conflate failure with emptiness

A read that returns `[]` on error tells the page "there are none", which is a
different claim from "we could not read this". When the page then states that
in words or in a count, an outage produces a confident falsehood.

This is the same failure class as `?? 0` on a count, already removed from
/causes, /campaigns, /contact, /impact and the homepage. The empty array hides
it better than a zero does, which is why it survived longer.

## Verified sites (grep, then read each caller)

| Loader | Renders a count or claim? | Severity | Status |
|---|---|---|---|
| `lib/volunteers-server.ts` | **Yes** — 4 count tiles AND "No volunteer opportunities listed yet" | **High** | **FIXED** (`e4090fa8`) |
| `lib/grants-server.ts` | No count rendered — cards only | **Not a bug** | deliberate, see below |
| `lib/home-data.ts` | Feed only — the homepage already degrades deliberately via `loadOrDegrade` | Low, by design | no action |
| `lib/donor-segments-server.ts` | `loadContacts` → `/dashboard/segments` (authenticated). An outage shows an owner "no contacts" | **Medium** | traced, open |
| `lib/giving-days-server.ts` | `ownedNonprofitIds` → `/dashboard/segments` **and two API routes that gate WRITES on it** | **High for the owner** | attempted, see below |
| `lib/privacy.ts` | No public caller found by grep; needs a direct read before grading | Ungraded | open |

### Traced, so nothing is left as "Unknown"

Both remaining Medium cases sit on `/dashboard/segments`, an **authenticated**
page rather than a public one. That is a smaller blast radius than /volunteer —
it misleads one signed-in owner rather than every visitor — but it is the same
falsehood: "you have no contacts" / "you own no nonprofits" stated on the
strength of a read that failed. Worth fixing with the same shape below; not
worth fixing blind, which is the mistake /grants caught.

### `ownedNonprofitIds` — attempted, reverted, and exactly what it needs

Reading `app/dashboard/segments/page.tsx` showed this is worse than the grep
suggested: the page short-circuits on `owned.length === 0`, skipping every
downstream fetch. A failed ownership read therefore renders a real owner a
completely empty dashboard.

Changing the signature to `Promise<string[] | null>` typechecks cleanly in the
loader and the page, but surfaces **four** further call sites — and they are
ownership checks that gate WRITES:

```
app/api/crm/segments/route.ts:62    if (!ctx.owned.includes(nonprofitId)) -> 403
app/api/crm/segments/route.ts:110   owned passed as readonly string[]
app/api/crm/segments/route.ts:131   owned passed as readonly string[]
app/api/giving-days/route.ts:59     ownedNonprofitIds passed into the actor
```

The change was **reverted rather than half-landed**, because these are
authorization paths and a partially-typed edit there is the wrong thing to
leave in a repository.

What the fix must do, and it is not the same as the /volunteer one: a `null`
ownership read has to **fail closed**, and it has to say why. Returning 403
("you do not own this") on a failed read states something false about the
user's account; the correct response is a 503-class "we could not verify
ownership". The page keeps the banner treatment; the API routes need the
explicit deny.

Estimated at well under an hour with the call sites above already located.

## The fix shape, as applied to volunteers

1. Loader returns `T[] | null` — `null` for a failed read, `[]` only for a
   genuinely empty list.
2. Caller sets `const readFailed = result === null` and renders an em dash for
   any count, a real `0` when zero is the measurement.
3. A test pins both cases so they cannot be collapsed again
   (`__tests__/volunteer-read-failure.test.ts`).

⚠️ **Correction to an earlier version of this file.** It graded `grants` as a
Medium-severity instance of the same bug, on the strength of a grep. Reading
the caller shows the opposite: `app/grants/page.tsx` carries a comment stating
that an empty list here is an honest "nothing to show" — the page renders
cards, not statistics, so there is no count to be falsely confident about —
and that the `.catch(() => [])` exists because the page returned **500 on a
cold production build with Supabase unreachable**. It is a deliberate,
reasoned choice, and removing it would reintroduce a measured outage.

The distinction that matters is therefore not "does the loader return `[]` on
error" but "does the page then STATE the emptiness". /volunteer did, in four
count tiles and a sentence. /grants does not.

## Not verifiable from the agent sandbox

The Supabase key available here is rejected (`Unregistered API key`), so
whether any given table is genuinely empty or merely unreadable cannot be
checked from this environment. Every finding above is from reading code, not
from querying data.

---

# Seed-data census (anon key, production project `yanexccimwooursawynm`)

Taken while auditing whether every page pulls real data.

| Table | anon count | Reading |
|---|---|---|
| `campaigns` | 352 | seeded, publicly readable |
| `volunteer_opportunities` | **180** | seeded, publicly readable |
| `grants` | 180 | seeded, publicly readable |
| `aeo_entries` | 212 | seeded |
| `campaign_updates` | 740 | seeded |
| `supported_countries` | 69 | seeded |
| `donations` | **0** | **NOT empty — RLS hides them.** Production reports 592 gifts. |
| `giving_days` | 0 | inconclusive: empty, or RLS, cannot tell |
| `events`, `teams`, `webinars`, `blog_posts` | `null` | RLS blocks the count outright |

⚠️ **The caveat that makes this census weaker than it looks.** An anon count
reflects what RLS permits, not what the table holds. `donations` proves it: the
count is 0 while production reports 592 gifts. So a 0 or `null` here is NOT
evidence a table is unseeded — only a non-zero count is evidence of anything,
and it is evidence of two things at once (rows exist AND are publicly
readable).

Distinguishing "empty" from "hidden" needs a working service-role key. The one
in the agent sandbox is rejected (`Unregistered API key`).

## What the census settled

`volunteer_opportunities` holds **180 rows**, 120 `open` and 60 `upcoming`,
none soft-deleted — every one matching `getPublicOpportunities`'s filter. The
loader's exact query (same columns, filters, ordering, limit) returns 48 rows
when replayed against this database.

Production nonetheless renders zero, uncached (`x-vercel-cache: MISS`,
`age: 0`). Deployment markers show production is running a build BEFORE
`e4090fa8`, so its `0` is the old `if (error) return []` — consistent with the
read failing and being swallowed.

Leading cause is a `boundedQuery` timeout on the `verified` + `starts_at`
ordering, ahead of a bad service-role key: an invalid key would break
/campaigns too, and /campaigns renders fine.

**`e4090fa8` makes this self-diagnosing.** Once deployed, `—` means the read
errored; `0` means it genuinely returned nothing. One look decides it.
