/**
 * actions.js — Core automation actions for Epic EHR
 *
 * Each function accepts a Puppeteer Page instance and options.
 * All actions use retry() + humanDelay() for reliability.
 */
'use strict';

require('dotenv').config();

/**
 * schedule_appointment — Schedule or reschedule patient appointments
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function schedule_appointment(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: schedule_appointment', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const BASE_URL = process.env.EPIC_URL;
    await page.goto(`${BASE_URL}/MyChart/scheduling/embeddedschedule`);
    await page.waitForSelector('#schedAppt, .appt-slot, [class*="slot-available"]', { timeout: 20000 });
    // Select first available slot
    await page.click('.appt-slot:first-child, [class*="slot-available"]:first-child');
    await page.waitForSelector('#confirmApptBtn, button[data-ng-click*="confirm"], .confirm-appt-btn');
    await page.click('#confirmApptBtn, button[data-ng-click*="confirm"]');
    await page.waitForSelector('.confirmation-number, .appt-confirmed', { timeout: 15000 });
    const confirmNum = await page.$eval('.confirmation-number, .appt-confirmed', el => el.textContent.trim()).catch(() => null);
    return { status: 'scheduled', confirmationNumber: confirmNum };
    } catch (err) {
      await page.screenshot({ path: `error-schedule_appointment-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * get_patient_info — Extract patient demographics and encounter history
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function get_patient_info(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: get_patient_info', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const BASE_URL = process.env.EPIC_URL;
    await page.goto(`${BASE_URL}/chart/`);
    await page.waitForSelector('#patientSearch input, .patient-search-input, input[placeholder*="Patient"]', { timeout: 15000 });
    await humanDelay(500, 1000);
    await page.type('#patientSearch input, .patient-search-input', opts.patientName || opts.mrn || '');
    await page.waitForSelector('.patient-result-row, .srchResultItem, .patient-search-result', { timeout: 10000 });
    await page.click('.patient-result-row:first-child, .srchResultItem:first-child');
    await page.waitForSelector('#demographicsTab, .patient-demographics', { timeout: 15000 });
    const demographics = await page.evaluate(() => {
      const fields = {};
      document.querySelectorAll('.demographics-field, [class*="patientField"]').forEach(el => {
        const label = el.querySelector('.field-label, label')?.textContent?.trim();
        const value = el.querySelector('.field-value, .value, span')?.textContent?.trim();
        if (label && value) fields[label] = value;
      });
      return fields;
    });
    return { status: 'ok', demographics };
    } catch (err) {
      await page.screenshot({ path: `error-get_patient_info-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * fill_clinical_note — Auto-fill clinical notes and smartphrases
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function fill_clinical_note(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: fill_clinical_note', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      await page.waitForSelector('#noteText, .smarttext-input, [contenteditable="true"][class*="note"]', { timeout: 15000 });
    await page.click('#noteText, .smarttext-input, [contenteditable="true"][class*="note"]');
    await humanDelay(300, 800);
    if (opts.smartphrase) {
      await page.keyboard.type('.' + opts.smartphrase); // Epic dot notation
      await page.waitForSelector('.smartphrase-popup, #SmartPhraseList', { timeout: 5000 }).catch(() => {});
      await page.keyboard.press('Tab'); // Accept first suggestion
    } else {
      await page.keyboard.type(opts.noteText || '');
    }
    await page.waitForSelector('#signNote, .sign-note-btn, button[data-ng-click*="sign"]');
    await page.click('#signNote, .sign-note-btn');
    return { status: 'signed' };
    } catch (err) {
      await page.screenshot({ path: `error-fill_clinical_note-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * export_care_gaps — Export care gap reports to CSV/JSON
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function export_care_gaps(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: export_care_gaps', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual Epic EHR selectors
    // await page.goto(`${process.env.EPIC_URL}/path/to/export-care-gaps`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('export_care_gaps complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-export_care_gaps-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * mychart_messaging — Send and receive MyChart secure messages
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function mychart_messaging(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: mychart_messaging', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual Epic EHR selectors
    // await page.goto(`${process.env.EPIC_URL}/path/to/mychart-messaging`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('mychart_messaging complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-mychart_messaging-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

module.exports = {
  schedule_appointment,
  get_patient_info,
  fill_clinical_note,
  export_care_gaps,
  mychart_messaging,
};
