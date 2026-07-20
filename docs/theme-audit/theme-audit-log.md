# Theme Audit — Remediation Log

Chronological log of theme-visibility fixes. Each entry is build-verified; visual
validation in a real browser is noted where it still applies.

---

## 2026-07-20 — THM-001: Home hero campaign spotlight, dark-mode contrast

- **Issue ID:** THM-001
- **Route:** `/` (homepage hero)
- **Component:** `.home-spot-*` (the live campaign spotlight card; `apps/web/app/page.tsx` markup + `apps/web/app/globals.css` styles)
- **Theme:** Dark
- **Viewport:** All (accent colors are size-independent)
- **Severity:** P2 (readability / low contrast on a customer-critical, most-viewed surface)
- **Original problem:** The card (shipped in PR #22) used fixed dark accent colors for the four stat icons (`#0a7a3d` green, `#2563eb` blue, `#d97706` amber, `#7c3aed` violet) and for the "ACTIVE CAMPAIGN" pill + "Live" label (`#0a7a3d`). On the dark card surface (`--h-card` = `#141736`) these dark-on-dark accents are low contrast. Box-shadows used light-mode `rgba(2,6,23,.x)` values.
- **Root cause:** Hardcoded accent colors chosen for the light card only, with no `[data-theme="dark"]` override. The card's *surfaces* were already correct (they use `var(--h-card)`/`var(--h-card-brd)`, which the token system flips for dark).
- **Files changed:** `apps/web/app/globals.css` (added a `[data-theme="dark"] .home-spot-*` block).
- **Fix implemented:** Dark-mode overrides using the app's established dark accent variants — `#6ee7b7` (green), `#93c5fd` (blue), `#fcd34d` (amber), `#c4b5fd` (violet); lightened "ACTIVE"/"Live" text to `#6ee7b7`; brightened the pulse dot to `#34d399`; dark-appropriate shadows (`rgba(0,0,0,.45–.6)`); translucent progress track (`rgba(255,255,255,.08)`); verified-badge blue `#3b82f6`.
- **Tests:** No unit test (pure CSS); covered by production build compilation.
- **Validation performed:** `next build` succeeds; token analysis confirms the new foreground colors are the same lighter variants the rest of the app already uses for AA contrast on `#141736`. Pixel-level visual confirmation still pending a browser render.
- **Final result:** Resolved (code) — recommend a dark-mode screenshot of `/` when a rendering environment is available to close visually.
