/* S10 / V3-06, V3-09: axe WCAG A/AA, target sentuh, teks, dan lebar 390 px. */
const { test, expect } = require('@playwright/test');
const { ROUTES, openAt, goRoute, seedState, expectNoAxeViolations, jakarta } = require('./helpers');

async function measure(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) !== 0 && r.width > 0 && r.height > 0;
    };
    const selector = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role="button"]';
    const smallTargets = [...document.querySelectorAll(selector)].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: `${el.tagName.toLowerCase()}.${el.className || '-'}[${el.getAttribute('data-action') || ''}]`,
        width: r.width, height: r.height
      };
    }).filter((x) => x.width < 44 || x.height < 44);

    const tinyText = [...document.querySelectorAll('body *')].filter((el) => {
      if (!visible(el) || ['SCRIPT', 'STYLE', 'SVG'].includes(el.tagName)) return false;
      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      return hasOwnText && parseFloat(getComputedStyle(el).fontSize) < 12;
    }).map((el) => `${el.tagName.toLowerCase()}.${el.className || '-'} ${getComputedStyle(el).fontSize}`);

    return {
      smallTargets, tinyText,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    };
  });
}

const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test('axe WCAG 2.0/2.1 A+AA: 7 halaman × 2 tema tanpa pelanggaran', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  for (const theme of ['light', 'dark']) {
    for (const route of ROUTES) {
      await goRoute(page, route);
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await expectNoAxeViolations(page);
    }
  }
});

test('target sentuh ≥44 px, teks ≥12 px, tanpa scroll horizontal', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  for (const route of ROUTES) {
    await goRoute(page, route);
    const m = await measure(page);
    expect(m.smallTargets, `${route}: ${JSON.stringify(m.smallTargets)}`).toEqual([]);
    expect(m.tinyText, `${route}: ${JSON.stringify(m.tinyText)}`).toEqual([]);
    expect(m.scrollWidth, `${route}: lebar konten ${m.scrollWidth} > ${m.innerWidth}`).toBeLessThanOrEqual(m.innerWidth + 1);
  }
});

test('V3-06: tab aktif tema gelap punya kontras teks memadai', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await seedState(page, (s) => {
    s.firstUseAt = '2026-11-01T00:00:00.000Z';
    s.weeklyReviews = {
      '2026-11-16': {
        weekKey: '2026-11-16', status: 'final', isoWeek: '2026-W47',
        generatedAt: '2026-11-23T02:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z',
        seen: true, items: [], waiting: [], skippedItems: [], daily: [],
        insights: [], plan: [], score: 100, done: 1, total: 1
      }
    };
  });
  await goRoute(page, 'evaluasi');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const colors = await page.locator('.subtab.is-active').evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor
  }));
  const a = luminance(colors.color);
  const b = luminance(colors.background);
  const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
