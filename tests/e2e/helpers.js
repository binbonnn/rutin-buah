/* S10: bersama untuk seluruh spesifikasi E2E. */
const { expect } = require('@playwright/test');

const ROUTES = ['dashboard', 'jadwal', 'evaluasi', 'skripsi', 'buah', 'belanja', 'pengaturan'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Pasang jam PALING DAHULU, sebelum halaman dimuat. */
async function openAt(page, iso, route = 'dashboard') {
  await page.clock.install({ time: new Date(iso) });
  await page.goto(`/#/${route}`);
  // initOnboarding() dijadwalkan 300 ms setelah init.
  await page.clock.runFor(500);
  const cancel = page.locator('#modal-cancel');
  if (await cancel.isVisible()) await cancel.click();
  await expect(page.locator('#page-title')).toBeVisible();
}

async function goRoute(page, route) {
  await page.evaluate((key) => { location.hash = '#/' + key; }, route);
  await expect(page.locator('#page-title')).toBeVisible();
}

/**
 * Mutator dijalankan di halaman lewat Store.update. Karena sumbernya dikirim
 * sebagai teks, semua nilai dari Node harus lewat argumen kedua — bukan closure.
 */
async function seedState(page, mutator, arg = null) {
  await page.evaluate(({ src, arg }) => {
    const fn = new Function('s', 'arg', `return (${src})(s, arg);`);
    Store.update((s) => fn(s, arg), true);
  }, { src: mutator.toString(), arg });
}

async function setNow(page, iso) {
  await page.clock.setFixedTime(new Date(iso));
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));
}

async function expectNoAxeViolations(page) {
  const hasAxe = await page.evaluate(() => !!window.axe);
  if (!hasAxe) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async (tags) => window.axe.run(document, {
    runOnly: { type: 'tag', values: tags }
  }), AXE_TAGS);
  expect(result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' '))
  }))).toEqual([]);
}

/** Tanggal Jakarta stabil di CI: 'YYYY-MM-DDTHH.mm.ss+07:00' */
function jakarta(yyyy, mm, dd, hh = 0, mi = 0, ss = 0) {
  return `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(ss).padStart(2, '0')}+07:00`;
}

module.exports = { ROUTES, openAt, goRoute, seedState, setNow, expectNoAxeViolations, jakarta };
