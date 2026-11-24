/* S10: aturan statis minimal; fungsi lint tidak menggantikan tes perilaku. */
const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  localStorage: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', requestAnimationFrame: 'readonly',
  Promise: 'readonly', Blob: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  CustomEvent: 'readonly', Event: 'readonly', Date: 'readonly', Math: 'readonly',
  JSON: 'readonly', Object: 'readonly', Array: 'readonly', String: 'readonly', Number: 'readonly',
  Boolean: 'readonly', Set: 'readonly', Map: 'readonly', RegExp: 'readonly', Error: 'readonly',
  Intl: 'readonly', CSS: 'readonly', Notification: 'readonly', crypto: 'readonly',
  matchMedia: 'readonly', FormData: 'readonly', getComputedStyle: 'readonly', ErrorEvent: 'readonly',
  fetch: 'readonly', AbortController: 'readonly', structuredClone: 'readonly',
  Utils: 'readonly', Seed: 'readonly', Store: 'readonly', UI: 'readonly', Pages: 'readonly',
  ErrLog: 'readonly', initTheme: 'readonly', __mentorT: 'writable'
};

const worker = {
  self: 'readonly', caches: 'readonly', clients: 'readonly', fetch: 'readonly',
  Response: 'readonly', Request: 'readonly', URL: 'readonly', setTimeout: 'readonly',
  Promise: 'readonly', console: 'readonly', Date: 'readonly'
};

const node = {
  require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly',
  Buffer: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  URL: 'readonly', globalThis: 'readonly'
};

// Modul IIFE global dipakai lintas berkas lewat <script>; ESLint tidak melihat pemakaiannya.
const MODULE_GLOBALS = '^(Utils|Seed|Store|UI|Pages|ErrLog)$';
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: MODULE_GLOBALS }],
  // Kode lama sengaja memakai == null / != null untuk null DAN undefined.
  eqeqeq: ['error', 'always', { null: 'ignore' }]
};

module.exports = [
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', '.git/**', '.tmp-*', 'index.html']
  },
  {
    files: ['js/**/*.js', 'scripts/**/*.js', 'sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...browser, ...worker, ...node } },
    rules
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...node, ...browser } },
    rules
  }
];
