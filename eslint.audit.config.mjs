import security from 'eslint-plugin-security';
export default [
  { files: ['server/**/*.js', 'public/**/*.js'],
    plugins: { security },
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', caches: 'readonly', self: 'readonly', clients: 'readonly', registration: 'readonly', Notification: 'readonly', EventSource: 'readonly', fetch: 'readonly', URL: 'readonly', location: 'readonly' } },
    rules: { 'security/detect-object-injection': 'off', 'security/detect-child-process': 'error',
             'security/detect-non-literal-fs-filename': 'warn', 'security/detect-eval-with-expression': 'error',
             'security/detect-unsafe-regex': 'warn', 'security/detect-non-literal-regexp': 'warn',
             'security/detect-buffer-noassert': 'error', 'security/detect-new-buffer': 'warn',
             'security/detect-possible-timing-attacks': 'warn' } },
];
