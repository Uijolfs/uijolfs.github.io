const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit } = require('playwright');

const site = path.resolve(__dirname, '..');
const report = [];
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml'
};
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(site, '.' + pathname);
    if (!file.startsWith(site + path.sep)) throw new Error('Invalid path');
    const data = fs.readFileSync(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
const check = (label, condition, detail) => {
  assert.ok(condition, label + ': ' + JSON.stringify(detail));
  report.push(label);
};

(async () => {
  let browser, context;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await webkit.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith(base + '/')) return route.abort();
      if (url.endsWith('-view.webp')) {
        // Identical white photographs expose unintended dimming between frames.
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><path fill="white" d="M0 0h1000v1000H0z"/></svg>'
        });
      }
      return route.continue();
    });
    await context.addInitScript(() => {
      const decode = HTMLImageElement.prototype.decode;
      window.decodedPhotographs = [];
      HTMLImageElement.prototype.decode = async function (...args) {
        const result = await decode.apply(this, args);
        window.decodedPhotographs.push(this.src);
        return result;
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = () => page.waitForFunction(() => document.querySelector('.lightbox-stage').getAttribute('aria-busy') === 'false');
    const animating = () => page.waitForFunction(() => document.querySelector('.lightbox-stage').getAnimations({ subtree: true }).length > 0);

    await page.goto(base + '/gallery.html');
    await page.locator('.photo-link').first().click();
    await ready();
    await page.evaluate(() => Promise.all(document.querySelector('.lightbox-stage').getAnimations({ subtree: true }).map(animation => animation.finished)));
    await page.locator('[data-step="1"]').click();
    await animating();
    const frozen = await page.evaluate(() => {
      const stage = document.querySelector('.lightbox-stage');
      stage.getAnimations({ subtree: true }).forEach(animation => {
        animation.pause();
        animation.currentTime = 30;
      });
      const image = stage.querySelector('img:not(.lightbox-outgoing)');
      const outgoing = stage.querySelector('.lightbox-outgoing');
      window.displayedPhotographs = [];
      new MutationObserver(() => window.displayedPhotographs.push(image.src)).observe(image, { attributes: true, attributeFilter: ['src'] });
      return { source: image.src, opacity: +getComputedStyle(image).opacity, outgoingOpacity: +getComputedStyle(outgoing).opacity };
    });
    check('Controlled frame lies inside the transition', frozen.opacity > 0 && frozen.opacity < 1, frozen);
    const coverage = frozen.opacity + frozen.outgoingOpacity * (1 - frozen.opacity);
    check('The blend keeps full image coverage', Math.abs(coverage - 1) < 0.00001, coverage);

    await page.evaluate(() => {
      for (let i = 0; i < 7; i++) document.querySelector('[data-step="1"]').click();
    });
    // Wait for actual decoding, without relying on a fixed network delay.
    await page.waitForFunction(() => window.decodedPhotographs.includes(document.querySelectorAll('.photo-link')[8].href));
    const during = await page.evaluate(() => {
      const image = document.querySelector('.lightbox-stage img:not(.lightbox-outgoing)');
      return { source: image.src, opacity: +getComputedStyle(image).opacity };
    });
    check('New input does not replace a partial transition', during.source === frozen.source && Math.abs(during.opacity - frozen.opacity) < 0.00001, during);
    await page.evaluate(() => document.querySelector('.lightbox-stage').getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await ready();
    const displayed = await page.evaluate(() => ({ sources: window.displayedPhotographs, expected: document.querySelectorAll('.photo-link')[8].href }));
    check('A burst displays only its latest decoded request', displayed.sources.length === 1 && displayed.sources[0] === displayed.expected, displayed);

    await page.locator('[data-step="1"]').click();
    await animating();
    // Drive the lifecycle handler directly; this is not an OS tab-switch test.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await ready();
    check('Backgrounding clears unfinished photograph animations', await page.evaluate(() => document.querySelector('.lightbox-stage').getAnimations({ subtree: true }).length === 0));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check('Returning to the foreground keeps a settled frame', await page.evaluate(() => document.querySelector('.lightbox-stage').getAnimations({ subtree: true }).length === 0));

    const zoomGuard = await page.evaluate(() => {
      const stage = document.querySelector('.lightbox-stage');
      const before = document.querySelector('.lightbox-counter').textContent;
      const viewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
      const capture = stage.setPointerCapture;
      try {
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: { scale: 1 } });
        // Synthetic pointers are not registered with the browser's capture API.
        stage.setPointerCapture = () => {};
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true, pointerId: 9, clientX: 200, clientY: 100 }));
        window.visualViewport.scale = 2;
        stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true, pointerId: 9, clientX: 100, clientY: 100 }));
        return before === document.querySelector('.lightbox-counter').textContent;
      } finally {
        stage.setPointerCapture = capture;
        if (viewport) Object.defineProperty(window, 'visualViewport', viewport);
        else delete window.visualViewport;
      }
    });
    check('Zooming during a gesture does not change the photograph', zoomGuard);
    check('No JavaScript errors', errors.length === 0, errors);
    console.log(JSON.stringify({ passed: report.length, checks: report }, null, 2));
  } finally {
    try {
      await context?.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        if (server.listening) await new Promise(resolve => {
          server.close(resolve);
          server.closeAllConnections?.();
        });
      }
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
