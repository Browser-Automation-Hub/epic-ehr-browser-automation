/**
 * ActionBuilder — fluent API for defining reusable Epic EHR automation sequences
 *
 * Usage:
 *   const action = new ActionBuilder('my-action')
 *     .navigate('/path')
 *     .waitFor('#element')
 *     .fillField('#input', ctx => ctx.value)
 *     .click('#submit')
 *     .extract('result', '.output')
 *     .build();
 *
 *   const result = await action.run(page, { value: 'hello' });
 */
'use strict';

class ActionBuilder {
  constructor(name) {
    this.name = name;
    this.steps = [];
  }

  navigate(path) {
    this.steps.push({ type: 'navigate', path });
    return this;
  }

  waitFor(selector, opts = {}) {
    this.steps.push({ type: 'waitFor', selector, opts });
    return this;
  }

  fillField(selector, valueOrFn) {
    this.steps.push({ type: 'fill', selector, valueOrFn });
    return this;
  }

  selectOption(selector, valueOrFn) {
    this.steps.push({ type: 'select', selector, valueOrFn });
    return this;
  }

  click(selector) {
    this.steps.push({ type: 'click', selector });
    return this;
  }

  uploadFile(selector, filePathOrFn) {
    this.steps.push({ type: 'upload', selector, filePathOrFn });
    return this;
  }

  extract(key, selector) {
    this.steps.push({ type: 'extract', key, selector });
    return this;
  }

  delay(ms) {
    this.steps.push({ type: 'delay', ms });
    return this;
  }

  build() {
    const steps = this.steps.slice();
    const name = this.name;
    return {
      name,
      async run(page, ctx = {}) {
        const results = {};
        for (const step of steps) {
          switch (step.type) {
            case 'navigate':
              await page.goto(step.path.startsWith('http') ? step.path : `${page.url().split('/').slice(0,3).join('/')}${step.path}`,
                { waitUntil: 'networkidle2', timeout: 30000 });
              break;
            case 'waitFor':
              await page.waitForSelector(step.selector, { timeout: 30000, ...step.opts });
              break;
            case 'fill': {
              const val = typeof step.valueOrFn === 'function' ? step.valueOrFn(ctx) : step.valueOrFn;
              await page.waitForSelector(step.selector, { timeout: 10000 });
              await page.$eval(step.selector, (el, v) => { el.value = ''; }, val);
              await page.type(step.selector, String(val), { delay: 40 });
              break;
            }
            case 'select': {
              const val = typeof step.valueOrFn === 'function' ? step.valueOrFn(ctx) : step.valueOrFn;
              await page.select(step.selector, String(val));
              break;
            }
            case 'click':
              await page.waitForSelector(step.selector, { timeout: 10000 });
              await page.click(step.selector);
              break;
            case 'upload': {
              const fp = typeof step.filePathOrFn === 'function' ? step.filePathOrFn(ctx) : step.filePathOrFn;
              const el = await page.$(step.selector);
              if (el) await el.uploadFile(fp);
              break;
            }
            case 'extract': {
              await page.waitForSelector(step.selector, { timeout: 10000 }).catch(() => {});
              results[step.key] = await page.$eval(step.selector, el => el.textContent.trim()).catch(() => null);
              break;
            }
            case 'delay':
              await new Promise(r => setTimeout(r, step.ms));
              break;
          }
        }
        return results;
      }
    };
  }
}

module.exports = { ActionBuilder };
