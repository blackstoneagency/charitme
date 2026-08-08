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
| `lib/grants-server.ts` | No count rendered from the array; caller also `.catch(() => [])` | Medium | open |
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

⚠️ `grants` has a second layer: the caller wraps it in `.catch(() => [])`, so
even a throwing loader becomes "none". Fixing the loader alone would not be
enough there.

## Not verifiable from the agent sandbox

The Supabase key available here is rejected (`Unregistered API key`), so
whether any given table is genuinely empty or merely unreadable cannot be
checked from this environment. Every finding above is from reading code, not
from querying data.
