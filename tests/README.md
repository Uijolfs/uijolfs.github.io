# Motion regression checks

Run from the repository root with Node.js and Playwright installed:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install --with-deps webkit
node tests/motion.cjs
node tests/gallery.cjs
python3 check_site.py
```

Each browser check starts and closes its own local server. External fonts and profile images are blocked so a network outage cannot affect the result.

The motion check uses browser wheel events and checks visible scroll positions and direction. It covers resisted previews, release, catching a returning page, monotonic page turns, bounded landings, and the short turn into the footer. It also checks that a new gesture during a turn can advance another page, while a decaying momentum tail does not. A short viewport exercises native scrolling inside a long section, sustained input at its boundary, and momentum at the same boundary.

Other checks cover reversal, interruption, resizing, reduced motion, fragment navigation and reloads (including a delayed stylesheet on tablet), the 88px desktop header, control overlap, and layouts from 320px to 1440px. Landing checks allow generous time for slower machines; they do not assert a frame rate or an exact animation duration. Mobile layouts and touch capability are emulated. Physical trackpad feel and display refresh rates should also be checked on a Mac.

The gallery check covers opacity throughout image transitions, rapid requests that retain only the latest selection, uninterrupted transitions, cleanup when the page enters the background, and protection for zoom gestures.
