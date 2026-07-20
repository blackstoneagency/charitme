# Theme visibility audit — report (pass 1: token-system contrast)

**Scope of this pass:** an objective, reproducible contrast audit of the app's
**theme token system** in both light and dark mode, plus the automated fix and
regression coverage for the defects it surfaced. This is the foundation layer:
because the whole app is styled from `--t1..t4` / `--s1..s3` / semantic tokens,
fixing readability at the token level fixes it everywhere those tokens are used.

This pass deliberately did **not** attempt to render-and-screenshot every route ×
state × viewport × theme. That end-to-end visual sweep is real work but requires a
running app with seeded data and a screenshot pipeline; it is scoped as a
follow-up (see "Not yet done"). Findings here are derived from the CSS token
values themselves, which is exact and does not depend on rendering.

## Method

- Extracted the light (`:root`) and dark (`[data-theme="dark"]`) token values from
  `apps/web/app/globals.css`.
- Computed WCAG 2.2 relative-luminance contrast ratios for every text tier
  (`--t1..t4`, `--muted`) against every card surface (`--s1..s3`) and the page
  background, in both themes.
- Computed white-on-fill and color-as-text ratios for the semantic/brand colors.
- Encoded the assertions as a regression test that reads the live CSS.

## Findings & resolutions

| ID | Severity | Theme | Problem | Root cause | Status |
|----|----------|-------|---------|------------|--------|
| T-01 | **P1** | light | Faintest text tier `--t4` at 2.70–2.98:1 (invisible-grade muted text) | `#8c95b2` too light on `#fbfaff`-family surfaces | **Fixed** → `#616a84` (≥4.5:1) |
| T-02 | P2 | dark | `--t4` at 3.05–3.59:1 | `#5a6898` too dark on dark cards | **Fixed** → `#828cb1` (≥4.5:1) |
| T-03 | P2 | light | `--t3`/`--muted` at 4.46:1 on tinted `--s2`/`--s3` | `#65708f` marginal | **Fixed** → `#5b6688` (≥4.7:1) |
| T-04 | P2 | light | `--orange` `#ff8a1c` white-on-fill 2.36:1 & as text 2.27:1 | saturated brand orange | **Documented** — rebrand decision (owner) |
| T-05 | P2 | light | `--green`/`--blue`/`--red` fail normal-text AA as text / white-on-fill | brand colors tuned for large/bold use | **Documented** — see token reference |

See `theme-token-reference.md` for exact values and the recommended (owner-gated)
follow-up for the brand colors.

## Verification

- `apps/web/__tests__/theme-contrast.test.ts` — **31 assertions**, reads the real
  `globals.css` and asserts AA for all text tiers × surfaces in both themes. Passes.
- Full suite: vitest green; `tsc --noEmit` clean; `next build` succeeds.
- No visual identity change: only the muted/faint text tiers moved, and only
  toward higher contrast.

## What was confirmed healthy

- Dark mode is a real, layered system (725 `[data-theme="dark"]` rules; surfaces
  step `--s1→s3`, not flat black), with an anti-flash inline theme script and
  localStorage persistence — no wrong-theme flash by construction.
- Primary body/secondary text (`--t1`/`--t2`) clears AA with large margins in both
  themes on every surface.
- The primary CTA color (`--violet` `#6d35ff`) clears AA white-on-fill (5.83:1).

## Not yet done (scoped follow-ups)

1. **Brand-color decision (T-04/T-05):** darken accent fills / add `--*-text`
   tokens for colored status text. Changes the look → needs owner sign-off.
2. **Rendered route sweep:** drive each route (public, auth, dashboard, admin,
   checkout, settings, error/empty states) in both themes at mobile/tablet/desktop
   and eyeball for overflow, invisible borders, disappearing transparent logos.
3. **Icon/SVG `currentColor` audit:** confirm no hardcoded `fill="#000/#fff"` in
   inline SVGs that would vanish against one theme.
4. **Focus-ring visibility** pass across interactive components in both themes.
