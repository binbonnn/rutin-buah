/* Harness minimal untuk memuat skrip browser di Node (tanpa jsdom). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['utils.js', 'seed.js', 'store.js'].map((f) => path.join(ROOT, 'js', f));

function createEnv(initialState) {
  const storage = new Map();
  if (initialState !== undefined) storage.set('rutin-buah:v1', JSON.stringify(initialState));
  const events = [];
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)); },
      removeItem: (key) => storage.delete(key)
    },
    document: {
      dispatchEvent(event) { events.push(event.type); return true; }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    }
  });
  FILES.forEach((file) => {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  });
  const DateCtor = vm.runInContext('Date', context);
  return {
    storage,
    events,
    context,
    Utils: vm.runInContext('Utils', context),
    Seed: vm.runInContext('Seed', context),
    Store: vm.runInContext('Store', context),
    // Fungsi biasa (bukan arrow) agar bisa dipakai dengan atau tanpa `new`.
    date: function dateFactory(...args) { return new DateCtor(...args); },
    saved: () => JSON.parse(storage.get('rutin-buah:v1') || '{}')
  };
}

/** State bersih dengan satu aktivitas 07.00–08.00 dan aturan aktif sejak lama. */
function singleActivityEnv(opts = {}) {
  const probe = createEnv();
  const state = probe.Store.normalizeState({});
  state.settings.strictSince = '2000-01-01';
  state.settings.markGraceMinutes = 10;
  state.activities = [{
    id: 'a1', title: 'Aktivitas uji', dayOfWeek: 1, category: 'Pribadi',
    startTime: opts.start || '07.00', endTime: opts.end || '08.00',
    isRecurring: true, isTemplate: false
  }];
  state.completion = {};
  return createEnv(state);
}

module.exports = { createEnv, singleActivityEnv, ROOT };
