/* S10 / N-02: catatan bimbingan tidak hilang saat render ulang menyusul centang. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, jakarta } = require('./helpers');

test('autosave 400 ms dan render ulang setelah centang tidak menimpa catatan', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await goRoute(page, 'skripsi');
  const notes = page.locator('#mentor-notes');
  await expect(notes).toBeVisible();
  await notes.fill('Catatan awal');

  await page.clock.runFor(100);
  expect(await page.evaluate(() => Store.state.mentorshipNotes)).toBe('');

  await page.clock.runFor(370); // total 470 ms
  expect(await page.evaluate(() => Store.state.mentorshipNotes)).toBe('Catatan awal');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rutin-buah:v1')).mentorshipNotes)).toBe('Catatan awal');

  await notes.fill('Catatan revisi');
  await page.clock.runFor(640);
  expect(await page.evaluate(() => Store.state.mentorshipNotes)).toBe('Catatan revisi');
  await page.clock.runFor(900);
  expect(await page.evaluate(() => Store.state.mentorshipNotes)).toBe('Catatan revisi');

  // Klik checkbox memicu Store.update → app:changed → render ulang.
  await page.locator('[data-action="toggle-task"]').first().click();
  expect(await page.evaluate(() => Store.state.mentorshipNotes)).toBe('Catatan revisi');
  await expect(page.locator('#mentor-notes')).toHaveValue('Catatan revisi');

  await page.reload();
  await expect(page.locator('#mentor-notes')).toHaveValue('Catatan revisi');
});
