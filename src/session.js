/**
 * Session persistence manager — save/restore cookies and localStorage for Epic sessions
 */
'use strict';

const fs = require('fs');
const path = require('path');

class SessionManager {
  /**
   * @param {string} sessionsDir - Directory to store session files
   */
  constructor(sessionsDir = './sessions') {
    this.sessionsDir = sessionsDir;
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
  }

  sessionPath(name) {
    return path.join(this.sessionsDir, `${name}.json`);
  }

  /**
   * Save current page session (cookies + localStorage)
   */
  async save(name, page) {
    const cookies = await page.cookies();
    const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
    const session = { cookies, localStorage, savedAt: new Date().toISOString() };
    fs.writeFileSync(this.sessionPath(name), JSON.stringify(session, null, 2));
    console.log(`[SessionManager] Saved session '${name}' (${cookies.length} cookies)`);
  }

  /**
   * Restore session. Returns true if restored successfully, false if expired/missing.
   */
  async restore(name, page) {
    const p = this.sessionPath(name);
    if (!fs.existsSync(p)) return false;

    try {
      const session = JSON.parse(fs.readFileSync(p, 'utf8'));
      const ageMins = (Date.now() - new Date(session.savedAt).getTime()) / 60000;
      if (ageMins > 480) { // 8 hours max
        console.log(`[SessionManager] Session '${name}' too old (${ageMins.toFixed(0)}m) — will re-login`);
        return false;
      }

      await page.setCookie(...session.cookies);
      if (session.localStorage) {
        await page.evaluate((ls) => {
          const data = JSON.parse(ls);
          for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        }, session.localStorage);
      }

      console.log(`[SessionManager] Restored session '${name}'`);
      return true;
    } catch (err) {
      console.warn(`[SessionManager] Could not restore '${name}': ${err.message}`);
      return false;
    }
  }

  /** Delete a saved session */
  delete(name) {
    const p = this.sessionPath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

module.exports = { SessionManager };
