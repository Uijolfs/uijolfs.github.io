# Motion regression checks

Run from the repository root with Node.js and Playwright installed:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install --with-deps webkit
node tests/motion.cjs
python3 check_site.py
```

The browser check starts and closes its own local server. It covers spring preview and release, deliberate page turns, momentum, reversal, interruption, resizing, reduced motion, footer access, header overlap, and mobile layouts. External fonts and profile images are blocked so a network outage cannot affect the result. The 320–1440px layouts and touch input are emulated; physical trackpad feel should also be checked on a Mac.
