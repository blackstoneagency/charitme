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
| `lib/home-data.ts` | Feed only; homepage already degrades deliberately | Low | open |
| `lib/donor-segments-server.ts` | Admin surface, not public | Low | open |
| `lib/giving-days-server.ts` | Not yet traced to its caller | Unknown | open |
| `lib/privacy.ts` | Not yet traced to its caller | Unknown | open |

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
