/**
 * Utility helpers — retry logic, delays, error types
 */
'use strict';

const { EpicSessionExpiredError } = require('./auth');

/**
 * Retry an async operation with exponential backoff.
 * @param {() => Promise<any>} fn
 * @param {{ retries?: number, delay?: number, backoff?: number }} opts
 */
async function withRetry(fn, opts = {}) {
  const { retries = 3, delay = 1000, backoff = 2 } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const wait = delay * Math.pow(backoff, attempt - 1);
        console.warn(`[retry] Attempt ${attempt} failed: ${err.message}. Retrying in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

/**
 * Random human-like delay between min and max ms.
 */
function humanDelay(minMs = 300, maxMs = 1200) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

module.exports = { withRetry, humanDelay, EpicSessionExpiredError };
