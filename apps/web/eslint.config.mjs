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
