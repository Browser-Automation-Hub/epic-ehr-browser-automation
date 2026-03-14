/**
 * Clinical notes export from Epic EHR
 */
'use strict';
const { humanDelay } = require('../utils');

/**
 * Export clinical notes for a patient.
 * @param {import('puppeteer').Page} page
 * @param {object} opts
 * @returns {Promise<Array<{noteDate, noteType, provider, content}>>}
 */
async function exportClinicalNotes(page, opts = {}) {
  const {
    patientMRN,
    dateRange = {},
    noteTypes = ['Progress Note', 'Discharge Summary'],
  } = opts;

  const baseUrl = new URL(page.url()).origin;
  await page.goto(`${baseUrl}/chart/notes?mrn=${encodeURIComponent(patientMRN)}`, { waitUntil: 'networkidle2' });
  await humanDelay(800, 1500);

  // Apply date filter
  if (dateRange.from) {
    const fromInput = await page.$('input[name="fromDate"], input[placeholder*="Start"]');
    if (fromInput) { await fromInput.click({ clickCount: 3 }); await fromInput.type(dateRange.from); }
  }
  if (dateRange.to) {
    const toInput = await page.$('input[name="toDate"], input[placeholder*="End"]');
    if (toInput) { await toInput.click({ clickCount: 3 }); await toInput.type(dateRange.to); }
  }

  // Filter by note types
  for (const noteType of noteTypes) {
    const el = await page.$(`input[value="${noteType}"], label:has-text("${noteType}") input`).catch(() => null);
    if (el) { const checked = await el.evaluate(el => el.checked); if (!checked) await el.click(); }
  }

  await page.click('#apply-filters, button[data-action="filter"]').catch(() => {});
  await page.waitForSelector('.note-list, [data-testid="note-list"]', { timeout: 20000 });

  const notes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.note-item, [data-testid="note-item"]')).map(note => ({
      noteDate: note.querySelector('[data-field="date"]')?.textContent.trim() || '',
      noteType: note.querySelector('[data-field="type"]')?.textContent.trim() || '',
      provider: note.querySelector('[data-field="provider"]')?.textContent.trim() || '',
      content: note.querySelector('.note-content, [data-field="content"]')?.textContent.trim() || '',
    }));
  });

  console.log(`[notes] Exported ${notes.length} clinical notes for MRN ${patientMRN}`);
  return notes;
}

module.exports = { exportClinicalNotes };
