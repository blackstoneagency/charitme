# Theme token reference & contrast audit

Authoritative source of truth: `apps/web/app/globals.css` — the light palette is
the `:root` block; the dark palette is the `[data-theme="dark"] { … }` root block.
Theme is applied via `data-theme` on `<html>` (default `dark`), set by
`components/ThemeProvider.tsx` and the anti-flash inline script in `app/layout.tsx`.

This app uses **inline styles + CSS variables** (no Tailwind, no shadcn). There is
no `--foreground/--card-foreground` semantic layer; the text tiers are `--t1..t4`
and surfaces are `--s1..s3`.

Contrast is verified automatically by `apps/web/__tests__/theme-contrast.test.ts`,
which reads these values out of `globals.css` and asserts WCAG 2.2 AA (4.5:1 for
normal text) for every text tier on every card surface, in both themes.

## Text tiers (fixed — all clear AA on s1/s2/s3 in both themes)

| Token | Role | Light | Dark | Notes |
|-------|------|-------|------|-------|
| `--t1` | Primary body / headings | `#0f1238` | `#e2e8f8` | ≥12:1 everywhere |
| `--t2` | Secondary text | `#27305d` | `#b8c2de` | ≥9:1 everywhere |
| `--t3` | Muted text | `#5b6688` *(was `#65708f`)* | `#8090b5` | now ≥4.7:1 on all surfaces |
| `--t4` | Faintest text | `#616a84` *(was `#8c95b2`)* | `#828cb1` *(was `#5a6898`)* | was **2.7:1** in light (FAIL) |
| `--muted` | Legacy muted alias | `#5b6688` *(was `#65708f`)* | `#8e99b8` | aligned with `--t3` |

**What was wrong:** `--t4` (the faintest text tier — timestamps, metadata, helper
text) rendered at **2.70–2.98:1** on light surfaces and **3.05–3.59:1** on dark —
well under the 4.5:1 AA floor for normal text. `--t3`/`--muted` were marginal
(4.46:1) on the tinted `--s2`/`--s3` surfaces. Darkening the light tiers and
lightening the dark faint tier brings every text tier to ≥4.5:1 while preserving
the visual hierarchy (t1 → t4 still steps from strong to faint).

## Surfaces

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--bg`/body | radial `#f3f0ff→#fff` | radial `#1a1040→#090b1e` | page background |
| `--s1` | `#fbfaff` | `#121530` | base card |
| `--s2` | `#f5f2ff` | `#181c3c` | elevated / tinted panel |
| `--s3` | `#eee8ff` | `#1e2348` | inset / deep-tinted panel |
| `--b1`/`--b2` | `#e8e4fb`/`#ddd5ff` | `#252948`/`#303668` | borders |

## Accent-as-text tokens (added — clear AA as colored status text)

The base `--green/--blue/--red/--orange` stay vivid for **fills, badges, and
progress bars** (unchanged — no visual-identity shift). For text, dedicated
darkened tokens were added and every `color:` usage of an accent was migrated to
them (73 call sites in TSX + 3 in `globals.css`). These are covered by the
contrast regression test.

| Token | Light | Dark | Min contrast on s1–s3 |
|-------|-------|------|-----------------------|
| `--green-text` | `#0d783c` | `#12a653` | ≥4.68 (light) / ≥4.75 (dark) |
| `--blue-text` | `#2164d5` | `#448aff` | ≥4.58 / ≥4.55 |
| `--red-text` | `#c42d49` | `#ff4768` | ≥4.61 / ≥4.57 |
| `--orange-text` | `#a05712` | `#ff8a1c` | ≥4.56 / ≥6.41 |

**Usage rule:** use `var(--<accent>-text)` for `color:`; use `var(--<accent>)`
for `background`/`border`/`fill`. Text on a saturated accent *fill* stays white.

## Brand fills — white-on-fill contrast (still owner's call)

The base fills remain as-is. As background fills with **white text**, several
clear AA only for large/bold text (≥3:1), and orange fails even that:

| Color | Value | White-on-fill | As text on light `--s1` | As text on dark `--s1` |
|-------|-------|---------------|-------------------------|------------------------|
| `--violet` (primary) | `#6d35ff` | **5.83 ✓** | — | — |
| `--green` | `#12a653` | 3.18 | 3.06 ✗ | 5.62 ✓ |
| `--green-dark` | `#08763b` | **5.73 ✓** | 5.52 ✓ | — |
| `--blue` | `#2878ff` | 4.02 | 3.87 ✗ | 4.44 |
| `--red` | `#ff3b5f` | 3.48 | 3.35 ✗ | 5.14 ✓ |
| `--orange` | `#ff8a1c` | 2.36 | 2.27 ✗ | 7.57 ✓ |

Legend: **✓** ≥4.5 · unmarked 3–4.5 (passes AA only for *large/bold* text, ≥3:1) ·
**✗** <3 or otherwise failing normal-text AA.

### Recommended follow-up (needs owner sign-off — changes the look)

- **Primary CTA (violet) is already compliant** — no action.
- For status **text** on light surfaces, introduce dedicated darker text tokens
  (`--green-text`, `--blue-text`, `--red-text`, `--orange-text`) rather than
  darkening the base fills, so buttons/badges keep their current brand color.
  `--green-dark` (`#08763b`, 5.52:1) is already a good green-text value.
- For **white-on-fill** small text (green/blue/red/orange buttons), either bump to
  bold ≥18.66px (clears the 3:1 large-text bar for green/blue) or darken the fill.
  **Orange (2.36:1) fails even the large-text bar** and should be darkened or never
  paired with white text.

Because these touch every badge, button, and progress bar in the app, they are
left for a deliberate, reviewed change rather than an automated sweep.
