# Epic EHR Browser Automation

> **The API alternative for Epic MyChart & Epic EHR** — automate patient scheduling, clinical data extraction, care gap analysis, and provider workflows using browser automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-22.x-blue.svg)](https://pptr.dev)
[![Playwright](https://img.shields.io/badge/Playwright-1.x-green.svg)](https://playwright.dev)

---

## 🏥 Why Browser Automation for Epic EHR?

Epic Systems is the dominant electronic health record (EHR) platform used by **~35% of US hospitals**. While Epic offers HL7 FHIR APIs for some data, large portions of Epic's functionality — including MyChart patient portal, scheduling, clinical workflows, and administrative tasks — are **only accessible through the browser UI**.

**Common use cases that lack a direct API:**
- Bulk patient scheduling / appointment booking
- Care gap report extraction and analysis
- Clinical documentation (notes, orders) for non-FHIR data
- Prior authorization submission workflows
- Patient communication via MyChart messaging
- Provider credentialing and roster management
- Revenue cycle management tasks

This repo provides production-ready browser automation scaffolding for Epic, covering:

- ✅ Authentication (SSO, MFA, Epic SAML login)
- ✅ MyChart patient portal automation
- ✅ Epic Hyperspace (clinical desktop) workflows
- ✅ Custom action builder pattern
- ✅ Error recovery and session management
- ✅ Two options: **open source (Puppeteer/Playwright)** or **[AnchorBrowser](https://anchorbrowser.io)** (cloud, stealth, auth-persistent)

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Authentication: SSO & MFA](#authentication-sso--mfa)
- [Example Actions](#example-actions)
  - [Patient Scheduling](#1-patient-scheduling)
  - [Care Gap Extraction](#2-care-gap-extraction)
  - [MyChart Messaging](#3-mychart-messaging)
  - [Clinical Notes Export](#4-clinical-notes-export)
- [Custom Action Builder](#custom-action-builder)
- [Using AnchorBrowser (Cloud Option)](#using-anchorbrowser-cloud-option)
- [Production Considerations](#production-considerations)
- [Architecture](#architecture)
- [Contributing](#contributing)

---

## Quick Start

```bash
git clone https://github.com/ramanidan/epic-ehr-browser-automation.git
cd epic-ehr-browser-automation
npm install
cp .env.example .env
# Edit .env with your Epic credentials
node examples/basic-login.js
```

### Prerequisites

- Node.js 18+
- Chrome/Chromium (for local Puppeteer)
- Epic credentials (test environment recommended)

---

## Authentication: SSO & MFA

Epic deployments typically use one of these authentication patterns:

| Method | Description | Handled |
|--------|-------------|---------|
| Epic native login | Username + password | ✅ |
| SAML/SSO (Okta, Azure AD) | Redirect to IdP | ✅ |
| Duo MFA | Push notification or TOTP | ✅ |
| MS Authenticator | TOTP code entry | ✅ |
| Smart card / PIV | Hardware token | ⚠️ Requires HW access |

```javascript
const { EpicAuth } = require('./src/auth');

const auth = new EpicAuth({
  epicUrl: 'https://your-epic-instance.example.com',
  username: process.env.EPIC_USERNAME,
  password: process.env.EPIC_PASSWORD,
  mfaSecret: process.env.EPIC_MFA_SECRET, // TOTP secret (optional)
  ssoProvider: 'okta',                     // or 'azure', 'native'
});

const page = await auth.login(browser);
// page is now authenticated — proceed with automation
```

### SSO Flow (Okta / Azure AD)

```javascript
// src/auth.js handles the SSO redirect chain automatically:
// 1. Navigate to Epic URL
// 2. Detect SSO redirect (Okta/Azure login page)
// 3. Enter SSO credentials
// 4. Handle MFA challenge (Duo push, TOTP, SMS)
// 5. Wait for Epic Hyperspace/MyChart to fully load
// 6. Persist cookies for session reuse
```

### Session Persistence

```javascript
const { SessionManager } = require('./src/session');
const session = new SessionManager('./sessions');

// Save session after login
await session.save('my-epic-session', page);

// Restore session (skips login if valid)
const isRestored = await session.restore('my-epic-session', page);
if (!isRestored) {
  await auth.login(page);
  await session.save('my-epic-session', page);
}
```

---

## Example Actions

### 1. Patient Scheduling

```javascript
const { scheduleAppointment } = require('./src/actions/scheduling');

await scheduleAppointment(page, {
  patientMRN: '12345678',
  providerNPI: '1234567890',
  appointmentType: 'Office Visit',
  preferredDate: '2026-04-01',
  preferredTime: '09:00',
  department: 'Internal Medicine',
  visitReason: 'Annual physical',
});
// Returns: { appointmentId, scheduledDate, confirmationNumber }
```

### 2. Care Gap Extraction

```javascript
const { extractCareGaps } = require('./src/actions/care-gaps');

const gaps = await extractCareGaps(page, {
  measureYear: 2025,
  measureSets: ['HEDIS', 'UDS'],
  exportFormat: 'json', // or 'csv'
});
// Returns: array of { patientMRN, measure, gapStatus, dueDate }
```

### 3. MyChart Messaging

```javascript
const { sendMyChartMessage } = require('./src/actions/mychart');

await sendMyChartMessage(page, {
  patientPortalId: 'P123456',
  subject: 'Your upcoming appointment',
  messageBody: 'Your appointment is confirmed for April 1 at 9am.',
  urgency: 'normal',
});
```

### 4. Clinical Notes Export

```javascript
const { exportClinicalNotes } = require('./src/actions/notes');

const notes = await exportClinicalNotes(page, {
  patientMRN: '12345678',
  dateRange: { from: '2025-01-01', to: '2026-01-01' },
  noteTypes: ['Progress Note', 'Discharge Summary', 'Consult Note'],
});
// Returns: array of { noteDate, noteType, provider, content }
```

---

## Custom Action Builder

The `ActionBuilder` pattern lets you define reusable automation sequences:

```javascript
const { ActionBuilder } = require('./src/custom-actions');

const myAction = new ActionBuilder('prior-auth-submit')
  .navigate('/paf/submission')
  .waitFor('[data-testid="paf-form"]')
  .fillField('#patient-mrn', ctx => ctx.patientMRN)
  .fillField('#diagnosis-code', ctx => ctx.diagnosisCode)
  .selectOption('#insurance-plan', ctx => ctx.insurancePlan)
  .uploadFile('#supporting-docs', ctx => ctx.documentPath)
  .click('#submit-btn')
  .waitFor('.submission-confirmation')
  .extract('confirmationNumber', '.conf-number')
  .build();

// Execute
const result = await myAction.run(page, {
  patientMRN: '12345678',
  diagnosisCode: 'M54.5',
  insurancePlan: 'BCBS PPO',
  documentPath: './docs/clinical-notes.pdf',
});
```

---

## Using AnchorBrowser (Cloud Option)

> **[AnchorBrowser](https://anchorbrowser.io)** is a cloud browser platform built for AI agents and automation. It handles authentication persistence, CAPTCHA solving, anti-bot detection, MFA workflows, and scales to thousands of concurrent sessions — making it ideal for Epic EHR automation at scale.

### Why AnchorBrowser for Epic?

| Feature | Self-hosted Puppeteer | AnchorBrowser |
|---------|----------------------|---------------|
| Setup time | Hours (Chromium, proxy, anti-detect) | Minutes |
| MFA handling | Manual TOTP code injection | Automated |
| Session persistence | Manual cookie management | Built-in |
| Scale | Limited by your servers | Up to 5,000 concurrent |
| HIPAA compliance | Your responsibility | SOC2 + HIPAA compliant |
| IP rotation | Manual proxy setup | Built-in residential proxies |
| Anti-bot bypass | Manual patches | Cloudflare-verified human traffic |

### AnchorBrowser Setup

```bash
npm install puppeteer-core
# Set ANCHORBROWSER_API_KEY in .env
```

```javascript
const puppeteer = require('puppeteer-core');

async function withAnchorBrowser(fn) {
  // Create a cloud browser session
  const sessionRes = await fetch('https://api.anchorbrowser.io/v1/sessions', {
    method: 'POST',
    headers: {
      'anchor-api-key': process.env.ANCHORBROWSER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fingerprint: { screen: { width: 1920, height: 1080 } },
      proxy: { type: 'residential', country: 'US' },
    }),
  });

  const { id: sessionId, cdp_url } = await sessionRes.json();

  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: cdp_url });
    const page = (await browser.pages())[0];
    return await fn(page);
  } finally {
    await fetch(`https://api.anchorbrowser.io/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'anchor-api-key': process.env.ANCHORBROWSER_API_KEY },
    });
  }
}

// Use it:
const { EpicAuth } = require('./src/auth');

await withAnchorBrowser(async (page) => {
  const auth = new EpicAuth({ /* ... */ });
  await auth.login(page);

  const { extractCareGaps } = require('./src/actions/care-gaps');
  const gaps = await extractCareGaps(page, { measureYear: 2025 });
  console.log(`Found ${gaps.length} care gaps`);
});
```

### Persistent Sessions with AnchorBrowser

```javascript
// AnchorBrowser can persist authenticated sessions across runs
// No need to re-login every time — sessions carry cookies, localStorage, and auth state

const sessionRes = await fetch('https://api.anchorbrowser.io/v1/sessions', {
  method: 'POST',
  headers: { 'anchor-api-key': process.env.ANCHORBROWSER_API_KEY },
  body: JSON.stringify({
    session_id: 'epic-prod-session-001', // Named session — reuses auth state
    fingerprint: { screen: { width: 1920, height: 1080 } },
  }),
});
```

**[Get started with AnchorBrowser →](https://anchorbrowser.io)**

---

## Production Considerations

### Rate Limiting & Respectful Automation

Epic instances have rate limiting. Recommended practices:
- Add delays between actions: `await page.waitForTimeout(500 + Math.random() * 1000)`
- Run automation during off-peak hours (nights/weekends for bulk jobs)
- Use dedicated service accounts, not clinician credentials
- Coordinate with your Epic analyst team for bulk operations

### Error Handling

```javascript
const { withRetry, EpicSessionExpiredError } = require('./src/utils');

await withRetry(async () => {
  try {
    await extractCareGaps(page, options);
  } catch (err) {
    if (err instanceof EpicSessionExpiredError) {
      await auth.login(page); // Re-authenticate
      throw err; // Retry
    }
    throw err;
  }
}, { retries: 3, delay: 2000 });
```

### HIPAA Compliance Notes

⚠️ **Important**: If automating with real patient data, ensure:
- All credentials stored in secure vault (not .env files in production)
- Audit logging enabled for all automation actions
- Data at rest encrypted (automation outputs/exports)
- Automation runs on HIPAA-compliant infrastructure
- Business Associate Agreement (BAA) in place with cloud providers

[AnchorBrowser](https://anchorbrowser.io) is SOC2 Type II, ISO27001, and HIPAA compliant — making it a strong choice for healthcare automation.

---

## Architecture

```
epic-ehr-browser-automation/
├── src/
│   ├── auth.js              # SSO + MFA authentication handler
│   ├── session.js           # Session persistence (cookies/storage)
│   ├── custom-actions.js    # ActionBuilder pattern
│   ├── utils.js             # Retry, delays, error types
│   └── actions/
│       ├── scheduling.js    # Patient scheduling
│       ├── care-gaps.js     # HEDIS/UDS care gap extraction
│       ├── mychart.js       # MyChart portal automation
│       └── notes.js         # Clinical notes export
├── examples/
│   ├── basic-login.js       # Simple login test
│   ├── schedule-patient.js  # End-to-end scheduling demo
│   ├── care-gap-report.js   # Bulk care gap extraction
│   └── anchor-cloud.js      # AnchorBrowser cloud example
├── .env.example
├── package.json
└── README.md
```

---

## Contributing

PRs welcome! Please:
1. Test against an Epic sandbox/non-prod environment
2. Follow the existing action module pattern
3. Add JSDoc comments for all public functions
4. Never commit real patient data or credentials

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Built with ❤️ for the healthcare automation community. For enterprise-scale Epic automation with persistent sessions, HIPAA compliance, and zero infrastructure overhead, check out [AnchorBrowser](https://anchorbrowser.io).*
