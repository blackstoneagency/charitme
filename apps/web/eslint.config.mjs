import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const config = [
  ...nextVitals,
  ...nextTypescript,
  // eslint-config-next registers the jsx-a11y plugin but enables only 6 of its
  // rules. Turn on the full recommended a11y ruleset (the plugin is already
  // registered upstream, so we add rules only — re-declaring the plugin errors).
  // The four high-volume/context-dependent rules are 'warn' for now: they flag a
  // real incremental-remediation backlog (associate form labels, make clickable
  // divs keyboard-operable) without blocking CI. Everything else is a hard gate.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**'],
  },
  {
    // ImageResponse renders at the edge and cannot use next/image, so these files
    // must use a raw <img>.
    //
    // This is a CONFIG override rather than an inline eslint-disable on purpose.
    // Whether `no-img-element` fires here varies with the eslint-config-next
    // version, so an inline directive is either required (or the rule errors) or
    // unused (and the unused directive itself warns) depending on the resolved
    // version — the file has flip-flopped between those two states across several
    // branches, each "fixing" the other's warning. Turning the rule off for these
    // paths is stable under both.
    files: ['app/**/opengraph-image.tsx', 'app/**/twitter-image.tsx', 'app/**/icon.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
