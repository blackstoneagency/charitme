# Accessibility linting (jsx-a11y)

`eslint-config-next` registers the `eslint-plugin-jsx-a11y` plugin but enables
only **6** of its rules. `apps/web/eslint.config.mjs` now turns on the plugin's
**full recommended ruleset**, so **26** a11y rules are enforced.

## Error gates (regression protection — 20 new)
Rules with zero current violations run at **error** and block CI on regressions,
e.g. `alt-text`, `anchor-has-content`, `anchor-is-valid`, `heading-has-content`,
`aria-role`, `aria-props`, `no-redundant-roles`,
`no-noninteractive-element-to-interactive-role`, `tabindex-no-positive`,
`autocomplete-valid`, `img-redundant-alt`, `scope`, `iframe-has-title`, …

## Warn backlog (incremental remediation — non-blocking)
Four high-volume/context-dependent rules run at **warn** so they surface a real
backlog without blocking CI (`eslint` exits 0 on warnings):

| Rule | Count | Remediation |
|------|------:|-------------|
| `label-has-associated-control` | 106 | wrap the control in the `<label>`, or add `htmlFor`/`id` |
| `no-static-element-interactions` | 45 | use a native `<button>`/`<a>`, or add `role` + keyboard support |
| `click-events-have-key-events` | 45 | add an `onKeyDown` (Enter/Space) beside `onClick` |
| `no-noninteractive-element-interactions` | 4 | move the handler to a native interactive element |
| `no-autofocus` | 2 | prefer a `ref` + `useEffect().focus()` on user action |

Promote a rule from `warn` to `error` in `eslint.config.mjs` once its count
reaches zero. This is the static half of CHAR-0015 (the rendered visual/axe
sweep still needs a browser).

## Fixes shipped with the rollout
- `img-redundant-alt` ×3 — reworded alts that said "image"/"photo".
- Campaign carousel thumbnails are now native `<button>`s (keyboard-operable),
  replacing click-only `<img>`s.
