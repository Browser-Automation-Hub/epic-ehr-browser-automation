/**
 * Epic EHR Authentication Handler
 * Supports: native login, Okta SSO, Azure AD SSO, Duo MFA, TOTP MFA
 */
'use strict';

const { authenticator } = require('otplib');

class EpicSessionExpiredError extends Error {
  constructor() { super('Epic session expired — re-authentication required'); this.name = 'EpicSessionExpiredError'; }
}

class EpicAuth {
  /**
   * @param {object} opts
   * @param {string} opts.epicUrl - Base URL of Epic instance
   * @param {string} opts.username
   * @param {string} opts.password
   * @param {string} [opts.mfaSecret] - TOTP secret (base32) for authenticator-based MFA
   * @param {'native'|'okta'|'azure'|'saml'} [opts.ssoProvider='native']
   * @param {number} [opts.loginTimeoutMs=60000]
   */
  constructor(opts) {
    this.epicUrl = opts.epicUrl.replace(/\/$/, '');
    this.username = opts.username;
    this.password = opts.password;
    this.mfaSecret = opts.mfaSecret || null;
    this.ssoProvider = opts.ssoProvider || 'native';
    this.loginTimeoutMs = opts.loginTimeoutMs || 60000;
  }

  /**
   * Authenticate and return the logged-in page.
   * @param {import('puppeteer').Page} page
   * @returns {Promise<import('puppeteer').Page>}
   */
  async login(page) {
    console.log(`[EpicAuth] Logging in to ${this.epicUrl} (SSO: ${this.ssoProvider})`);
    await page.goto(this.epicUrl, { waitUntil: 'networkidle2', timeout: this.loginTimeoutMs });

    // Detect login page type
    const currentUrl = page.url();
    if (currentUrl.includes('okta.com') || this.ssoProvider === 'okta') {
      await this._handleOktaSSO(page);
    } else if (currentUrl.includes('login.microsoftonline.com') || this.ssoProvider === 'azure') {
      await this._handleAzureSSO(page);
    } else {
      await this._handleNativeLogin(page);
    }

    // Handle MFA if prompted
    await this._handleMFA(page);

    // Wait for Epic to fully load
    await this._waitForEpicLoad(page);
    console.log('[EpicAuth] Login successful');
    return page;
  }

  async _handleNativeLogin(page) {
    await page.waitForSelector('#Login', { timeout: 15000 }).catch(() => {});
    const loginInput = await page.$('#Login, input[name="Login"], input[name="username"], input[type="text"]');
    if (!loginInput) throw new Error('Could not find login field on Epic login page');
    await loginInput.click({ clickCount: 3 });
    await loginInput.type(this.username, { delay: 50 });

    const passInput = await page.$('#Password, input[name="Password"], input[type="password"]');
    if (!passInput) throw new Error('Could not find password field');
    await passInput.click({ clickCount: 3 });
    await passInput.type(this.password, { delay: 50 });

    const submitBtn = await page.$('button[type="submit"], input[type="submit"], #BtnSignIn, .sign-in-btn');
    if (submitBtn) await submitBtn.click();
    else await page.keyboard.press('Enter');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  }

  async _handleOktaSSO(page) {
    await page.waitForSelector('#okta-signin-username', { timeout: 15000 });
    await page.type('#okta-signin-username', this.username, { delay: 50 });
    await page.type('#okta-signin-password', this.password, { delay: 50 });
    await page.click('#okta-signin-submit');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  }

  async _handleAzureSSO(page) {
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', this.username, { delay: 50 });
    await page.click('input[type="submit"], #idSIButton9');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.type('input[type="password"]', this.password, { delay: 50 });
    await page.click('input[type="submit"], #idSIButton9');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  }

  async _handleMFA(page) {
    const url = page.url();
    // Duo MFA
    if (url.includes('duo') || await page.$('iframe[src*="duo"]').catch(() => null)) {
      console.log('[EpicAuth] Duo MFA detected — waiting for push approval (30s)...');
      // Click "Send me a push" if present
      const duoFrame = page.frames().find(f => f.url().includes('duo'));
      if (duoFrame) {
        const pushBtn = await duoFrame.$('button.positive.auth-button').catch(() => null);
        if (pushBtn) await pushBtn.click();
      }
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      return;
    }

    // TOTP MFA (Google Authenticator / MS Authenticator style)
    const totpInput = await page.$('input[name*="totp"], input[name*="otp"], input[name*="code"], input[placeholder*="code" i], input[placeholder*="OTP" i]').catch(() => null);
    if (totpInput && this.mfaSecret) {
      console.log('[EpicAuth] TOTP MFA detected — generating code...');
      const code = authenticator.generate(this.mfaSecret);
      await totpInput.type(code, { delay: 100 });
      const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      return;
    }
  }

  async _waitForEpicLoad(page) {
    // Wait for common Epic UI elements
    const selectors = [
      '.epic-nav', '#epic-nav', '[data-testid="navbar"]',
      '.MyChartContainer', '#welcomeMsg', '.Hyperspace',
      '#ctl00_ContentPlaceHolder1_Dashboard'
    ];
    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) return;
    }
    // Fallback: wait for network idle
    await page.waitForTimeout(2000);
  }
}

module.exports = { EpicAuth, EpicSessionExpiredError };
