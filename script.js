// Keep navigation and sticky-header styling aligned with the reading position.
(() => {
  if (document.body.classList.contains('inner-page')) return;
  const header = document.querySelector('.site-header');
  const links = [...document.querySelectorAll('nav a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1) || link.pathname.split('/').pop().replace('.html', '')));
  let frame = 0, previousHeight = 0, previousActive = null;
  let readingOffset = 0, bottom = 0, offsets = [];
  const stylesheets = [...document.querySelectorAll('head link[rel="stylesheet"]')]
    .filter(link => new URL(link.href).origin === location.origin);
  const failedStylesheets = new WeakSet();
  function measure() {
    // A cached script can execute before a slow stylesheet. Never turn an
    // unstyled header measurement into the height of every section.
    if (document.readyState !== 'complete' && stylesheets.some(link => !link.sheet && !failedStylesheets.has(link))) return;
    const height = header?.offsetHeight || 88;
    if (height !== previousHeight) {
      document.documentElement.style.setProperty('--header-height', height + 'px');
      previousHeight = height;
    }
    readingOffset = height + Math.min(innerHeight * .2, 160);
    offsets = sections.map(section => section ? section.getBoundingClientRect().top + scrollY : Infinity);
    bottom = document.documentElement.scrollHeight - innerHeight - 4;
    schedule();
  }
  function update() {
    frame = 0;
    const readingLine = scrollY + readingOffset;
    let active = -1;
    offsets.forEach((top, index) => { if (top <= readingLine) active = index; });
    if (scrollY > 0 && scrollY >= bottom) active = links.length - 1;
    header?.classList.toggle('is-scrolled', scrollY > 12);
    if (active === previousActive) return;
    previousActive = active;
    links.forEach((link, index) => {
      const selected = index === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  stylesheets.forEach(link => {
    if (link.sheet) return;
    link.addEventListener('load', measure, { once: true });
    link.addEventListener('error', () => { failedStylesheets.add(link); measure(); }, { once: true });
  });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', measure);
  window.addEventListener('load', measure, { once: true });
  if ('ResizeObserver' in window) {
    const layout = new ResizeObserver(measure);
    if (header) layout.observe(header);
    document.querySelectorAll('main > section, footer').forEach(section => layout.observe(section));
  }
  document.fonts?.ready.then(measure);
  measure();
})();

// Lorenz's equations, integrated with fourth-order Runge–Kutta.
// The faint orbit gives context; the bright trail follows the evolving state.
(() => {
  'use strict';
  const canvas = document.getElementById('lorenz');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const button = document.getElementById('chaos-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manualPreference = false;
  const backdrop = document.createElement('canvas');
  const bg = backdrop.getContext('2d');
  if (!bg) return;
  const dt = .005;
  function derivative([x, y, z]) { return [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z]; }
  function step(p) {
    const a = derivative(p);
    const b = derivative(p.map((v, i) => v + dt * a[i] / 2));
    const c = derivative(p.map((v, i) => v + dt * b[i] / 2));
    const d = derivative(p.map((v, i) => v + dt * c[i]));
    return p.map((v, i) => v + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
  }
  let state = [1, 1, 1];
  for (let i = 0; i < 1800; i++) state = step(state);
  const orbit = [];
  for (let i = 0; i < 9000; i++) { state = step(state); orbit.push(state); }
  const trail = orbit.slice(-600);
  let width = 0, height = 0, ratio = 1, frame = 0, last = 0, carry = 0;
  let visible = true, scrolling = false, pageMoving = false, scrollTimer = 0;
  let paused = reduced.matches;
  let dark = document.documentElement.dataset.theme === 'dark';
  // An almost frontal x-z projection retains the familiar butterfly silhouette.
  function project([x, y, z]) {
    const scale = Math.min(width / 49, height / 54);
    return [width / 2 + (x + .12 * y) * scale, height / 2 - (z - 25) * scale];
  }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0, width, height);
    ctx.lineWidth = 1.35;
    ctx.lineCap = 'round';
    // Batch the trail into age bands rather than hundreds of separate strokes.
    for (let band = 0; band < 16; band++) {
      const start = Math.floor(band * (trail.length - 1) / 16);
      const end = Math.floor((band + 1) * (trail.length - 1) / 16);
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const [x, y] = project(trail[i]);
        if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${dark ? '119,175,255' : '82,111,128'},${.12 + .88 * (band / 15) ** 1.6})`;
      ctx.stroke();
    }
    const [x, y] = project(trail[trail.length - 1]);
    ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#f3f4f6' : '#526f80'; ctx.shadowColor = dark ? '#77afff' : '#879487'; ctx.shadowBlur = dark ? 12 : 8;
    ctx.fill(); ctx.shadowBlur = 0;
  }
  function resize() {
    width = canvas.clientWidth; height = canvas.clientHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = backdrop.width = Math.round(width * ratio);
    canvas.height = backdrop.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    bg.setTransform(ratio, 0, 0, ratio, 0, 0);
    bg.strokeStyle = dark ? 'rgba(119,175,255,.17)' : 'rgba(82,111,128,.20)'; bg.lineWidth = .65;
    bg.beginPath();
    orbit.forEach((p, i) => { const [x, y] = project(p); if (i === 0) bg.moveTo(x, y); else bg.lineTo(x, y); });
    bg.stroke(); draw();
  }
  function tick(time) {
    frame = 0;
    if (paused || !visible || scrolling || pageMoving || document.hidden) { last = 0; return; }
    if (last) carry += Math.min((time - last) / 1000, .08) * .65;
    last = time;
    let changed = false;
    while (carry >= dt) {
      state = step(state); trail.push(state); trail.shift(); carry -= dt; changed = true;
    }
    if (changed) draw();
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    if (!paused && visible && !scrolling && !pageMoving && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (!button) { schedule(); return; }
    button.textContent = paused ? 'Play motion' : 'Pause motion';
    button.setAttribute('aria-label', paused ? 'Play Lorenz animation' : 'Pause Lorenz animation');
    button.setAttribute('aria-pressed', String(paused));
    schedule();
  }
  button?.addEventListener('click', () => { manualPreference = true; paused = !paused; sync(); });
  reduced.addEventListener('change', event => { if (event.matches || !manualPreference) { paused = event.matches; sync(); } });
  document.addEventListener('page-motion', event => {
    pageMoving = !!event.detail?.active;
    schedule();
  });
  document.addEventListener('scroll', () => {
    if (!scrolling) { scrolling = true; schedule(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; schedule(); }, 120);
  }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', () => {
    clearTimeout(scrollTimer); scrolling = pageMoving = false;
    cancelAnimationFrame(frame); frame = 0; last = 0;
  });
  window.addEventListener('pageshow', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener('resize', resize, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; schedule();
  }).observe(canvas);
  document.addEventListener('themechange', () => {
    dark = document.documentElement.dataset.theme === 'dark';
    resize();
  });
  resize(); sync();
})();


// Swap the cover and project content without changing the card's footprint.
(() => {
  document.querySelectorAll('.research-card').forEach(card => {
    const front = card.querySelector('.research-front');
    const back = card.querySelector('.research-back');
    const open = card.querySelector('.research-open');
    const close = card.querySelector('.research-back-button');
    if (!front || !back || !open || !close) return;
    function setActive(active, moveFocus = true) {
      card.classList.toggle('is-active', active);
      front.inert = active;
      back.inert = !active;
      front.setAttribute('aria-hidden', String(active));
      back.setAttribute('aria-hidden', String(!active));
      open.setAttribute('aria-expanded', String(active));
      if (moveFocus) (active ? close : open).focus({ preventScroll: true });
    }
    open.disabled = false;
    close.hidden = false;
    card.classList.add('is-ready');
    setActive(false, false);
    open.addEventListener('click', () => setActive(true));
    close.addEventListener('click', () => setActive(false));
    card.addEventListener('keydown', event => {
      if (event.key === 'Escape' && card.classList.contains('is-active')) {
        event.preventDefault();
        setActive(false);
      }
    });
  });
})();


// Quiet entrances yield to paging so content and the viewport never drift separately.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window)) return;
  const groups = [
    '.hero-heading, .hero-intro, .chaos-figure',
    '.about-sidebar, .about-section .section-body',
    '.research-layout > .section-marker, .research-layout > .section-intro',
    '.research-grid > .research-card',
    '.learning-header, .learning-grid > .learning-column',
    '.personal-section .section-marker, .personal-content, .personal-album',
    'footer.page-width'
  ];
  const records = new Map();
  let observer = null;
  groups.forEach(selector => {
    document.querySelectorAll(selector).forEach((element, index) => {
      if (typeof element.animate === 'function') {
        records.set(element, { visible: null, animation: null, delay: Math.min(index * 30, 60) });
      }
    });
  });
  function cancel(record) {
    if (!record.animation) return;
    record.animation.onfinish = record.animation.oncancel = null;
    record.animation.cancel();
    record.animation = null;
  }
  function reset() {
    observer?.disconnect();
    observer = null;
    records.forEach(record => { cancel(record); record.visible = null; });
  }
  function start(restore = false) {
    reset();
    if (reduced.matches) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;
        const record = records.get(element);
        if (!record) continue;
        // Wait until a card has left the viewport before replaying its entrance.
        // Ratio thresholds can leave tall content permanently faded on small screens.
        const visible = entry.isIntersecting;
        if (visible === record.visible) continue;
        const previous = record.visible;
        record.visible = visible;
        if (!visible || reduced.matches || document.hidden || document.documentElement.classList.contains('is-page-scrolling') || (restore && previous === null) || element.contains(document.activeElement)) {
          cancel(record);
          continue;
        }
        cancel(record);
        const animation = element.animate(
          [{ opacity: .65, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
          { duration: 380, delay: record.delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }
        );
        record.animation = animation;
        animation.onfinish = () => {
          if (record.animation === animation) {
            animation.onfinish = null;
            animation.cancel();
            record.animation = null;
          }
        };
      }
    }, { threshold: 0, rootMargin: '24px 0px' });
    records.forEach((record, element) => observer.observe(element));
  }
  document.addEventListener('page-motion', event => {
    if (event.detail?.active) records.forEach(cancel);
  });
  reduced.addEventListener('change', () => start(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
    else start(true);
  });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => { if (event.persisted) start(true); });
  document.addEventListener('focusin', event => {
    records.forEach((record, element) => {
      if (element.contains(event.target)) {
        cancel(record);
        record.visible = true;
      }
    });
  });
  start();
})();


// A resisted pull, a short release, and a quiet landing share one scroll position.
(() => {
  const desktop = matchMedia('(min-width: 851px) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const pages = [...document.querySelectorAll('main > section')];
  const footer = document.querySelector('footer');
  if (!pages.length || !footer) return;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const enabled = () => desktop.matches && !reduced.matches;
  const geometry = () => [innerWidth, innerHeight, header?.offsetHeight || 88];
  const maximum = () => Math.max(0, root.scrollHeight - innerHeight);
  let frame = 0, releaseTimer = 0, layoutFrame = 0, lastFrame = 0;
  let mode = 'idle', position = scrollY, velocity = 0, target = scrollY;
  let origin = scrollY, dragBase = scrollY, budget = 0, destination = null;
  let preview = null, flight = null, queuedBudget = null;
  let points = [], limit = maximum(), layoutAnchor = null, previousGeometry = null;
  let layoutReady = document.readyState === 'complete';
  let lastWritten = null, lastInput = -Infinity, lastMagnitude = 0, lastDirection = 0, locked = false;
  let nativeScroller = null, nativeDirection = 0, edgeBudget = 0, edgeStreak = 0;

  function moving(active) {
    if (root.classList.contains('is-page-scrolling') === active) return;
    root.classList.toggle('is-page-scrolling', active);
    document.dispatchEvent(new CustomEvent('page-motion', { detail: { active } }));
  }
  function clearPreview() {
    preview?.classList.remove('spring-preview');
    preview = null;
  }
  function cancel() {
    cancelAnimationFrame(frame); cancelAnimationFrame(layoutFrame);
    clearTimeout(releaseTimer);
    frame = layoutFrame = releaseTimer = 0;
    layoutAnchor = flight = queuedBudget = destination = null;
    mode = 'idle'; velocity = budget = 0; locked = false;
    nativeScroller = null; edgeBudget = edgeStreak = 0;
    lastWritten = null; lastInput = -Infinity; lastMagnitude = lastDirection = 0;
    clearPreview(); moving(false);
  }
  function readStops() {
    limit = maximum();
    const offset = header?.offsetHeight || 88;
    const stops = [...pages, footer].map(element => ({ element,
      position: clamp(element.getBoundingClientRect().top + scrollY - offset, 0, limit)
    }));
    stops.push({ position: limit, element: footer });
    points = stops.sort((a, b) => a.position - b.position).filter((point, index, all) =>
      !index || point.position - all[index - 1].position > 2);
  }
  function configure() {
    const measured = geometry();
    const resized = previousGeometry && measured.some((value, i) => value !== previousGeometry[i]);
    previousGeometry = measured;
    const anchor = layoutAnchor || (layoutReady && resized ? (mode === 'commit' ? destination :
      points.find(point => Math.abs(point.position - (mode === 'idle' ? scrollY : origin)) < 4)) : null);
    cancel(); root.classList.toggle('wheel-paging', enabled()); layoutAnchor = anchor;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0; layoutAnchor = null; readStops();
      if (enabled() && anchor) {
        const next = points.find(point => point.element === anchor.element);
        if (next) scrollTo({ top: next.position, behavior: 'instant' });
      }
    });
  }
  function nextStop(direction) {
    return direction > 0 ? points.find(point => point.position > origin + 2)
      : [...points].reverse().find(point => point.position < origin - 2);
  }
  function effortLimit(point) {
    const base = clamp(innerHeight * .37, 300, 360);
    // A short footer needs proportionately less effort than a complete page.
    return Math.min(base, Math.max(100, Math.abs(point.position - origin) * .55));
  }
  function scrollable(element, direction) {
    for (; element && element !== document.body && element !== root; element = element.parentElement) {
      if (element.scrollHeight <= element.clientHeight + 2) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY)) continue;
      if (direction > 0 && element.scrollTop < element.scrollHeight - element.clientHeight - 2) return element;
      if (direction < 0 && element.scrollTop > 2) return element;
    }
    return null;
  }
  function schedule() {
    if (frame) return;
    lastFrame = performance.now(); frame = requestAnimationFrame(tick);
  }
  function writePosition() {
    const rounded = Math.round(position);
    if (lastWritten === null || Math.abs(rounded - lastWritten) >= 1) {
      scrollTo({ top: rounded, behavior: 'instant' });
      lastWritten = scrollY;
    }
  }
  function startGesture() {
    origin = position = target = dragBase = scrollY;
    budget = velocity = 0; lastWritten = null; flight = null;
    readStops();
  }
  function release() {
    releaseTimer = 0;
    if (mode !== 'preview') return;
    mode = 'return'; budget = 0; target = origin; schedule();
  }
  function commit(now) {
    mode = 'commit'; target = destination.position; locked = true;
    const distance = target - position;
    const duration = clamp(.18 + Math.abs(distance) / 1700, .18, .52);
    // Quintic Hermite: keep position/velocity, arrive with zero velocity/acceleration.
    // Limiting normalized initial speed keeps short transitions monotonic.
    const speed = Math.sign(distance) * clamp(velocity * Math.sign(distance), 0, 2.5 * Math.abs(distance) / duration);
    const tangent = speed * duration;
    // A small forward acceleration releases the resistance without an idle beat.
    // Keep it within the monotonic Hermite range, including very short landings.
    const normalizedSpeed = distance ? tangent / distance : 0;
    const acceleration = distance * Math.max(0, Math.min(4, 20 - 8 * normalizedSpeed));
    flight = { start: now, duration, from: position, distance, tangent, acceleration };
    velocity = speed;
    clearPreview();
  }
  function pull(delta, accumulated = false) {
    clearTimeout(releaseTimer);
    budget += accumulated ? delta : clamp(delta, -140, 140);
    destination = nextStop(Math.sign(budget) || Math.sign(delta));
    if (!destination) {
      mode = 'return'; target = origin; budget = 0; clearPreview(); schedule(); return;
    }
    const effort = effortLimit(destination);
    if (Math.abs(budget) >= effort) commit(performance.now());
    else {
      mode = 'preview';
      if (preview !== destination.element) {
        clearPreview(); preview = destination.element; preview.classList.add('spring-preview');
      }
      const direction = Math.sign(destination.position - origin);
      const span = Math.abs(destination.position - origin);
      const progress = Math.abs(budget) / effort;
      const travel = Math.min(span * .44, effort * .84) * (1.5 * progress / (1 + .5 * progress));
      target = clamp(dragBase + direction * travel,
        Math.min(origin, destination.position), Math.max(origin, destination.position));
      // Regrabbing a returning page starts where the hand found it, not at zero.
      target = direction > 0 ? Math.min(target, destination.position - 1) : Math.max(target, destination.position + 1);
      releaseTimer = setTimeout(release, 190);
    }
    moving(true); schedule();
  }
  function finish() {
    position = target; velocity = 0; writePosition();
    const queued = queuedBudget;
    clearPreview(); mode = 'idle'; destination = flight = queuedBudget = null; budget = 0;
    if (queued !== null) {
      startGesture(); locked = false;
      if (nextStop(Math.sign(queued))) { pull(queued, true); return; }
    }
    moving(false);
  }
  function tick(time) {
    frame = 0;
    // Native focus, anchors and history always win over an outstanding animation.
    if (lastWritten !== null && Math.abs(scrollY - lastWritten) > 3) { cancel(); return; }
    const dt = clamp((time - lastFrame) / 1000, .001, .05);
    lastFrame = time;
    if (mode === 'commit' && flight) {
      const u = clamp((time - flight.start) / (flight.duration * 1000), 0, 1);
      const { from, distance: d, tangent: m, acceleration: a, duration } = flight;
      position = from + m * u + (10 * d - 6 * m) * u ** 3 + (-15 * d + 8 * m) * u ** 4 + (6 * d - 3 * m) * u ** 5 + .5 * a * u ** 2 * (1 - u) ** 3;
      velocity = (m + (30 * d - 18 * m) * u ** 2 + (-60 * d + 32 * m) * u ** 3 + (30 * d - 15 * m) * u ** 4 + .5 * a * (2 * u - 9 * u ** 2 + 12 * u ** 3 - 5 * u ** 4)) / duration;
      if (u === 1) { finish(); return; }
    } else {
      const omega = mode === 'preview' ? 72 : 22;
      const displacement = position - target;
      const momentum = velocity + omega * displacement;
      const decay = Math.exp(-omega * dt);
      position = target + (displacement + momentum * dt) * decay;
      velocity = (velocity - omega * momentum * dt) * decay;
      if (Math.abs(target - position) < .6 && Math.abs(velocity) < 12) {
        if (mode !== 'preview') { finish(); return; }
        position = target; velocity = 0; writePosition(); return;
      }
    }
    position = clamp(position, 0, limit); writePosition();
    frame = requestAnimationFrame(tick);
  }
  addEventListener('wheel', event => {
    if (!enabled() || event.defaultPrevented || !event.cancelable) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) { cancel(); return; }
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const element = event.target instanceof Element ? event.target : document.body;
    if (element.closest('input, textarea, select, [contenteditable], dialog, [role="dialog"]')) { cancel(); return; }
    const now = performance.now(), idle = now - lastInput;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    const magnitude = Math.abs(delta), direction = Math.sign(delta), previousMagnitude = lastMagnitude;
    const fresh = idle >= 160 || direction !== lastDirection || (magnitude >= 12 && magnitude > previousMagnitude * 2 + 4);
    lastInput = now; lastMagnitude = magnitude; lastDirection = direction;
    if (mode === 'commit') {
      event.preventDefault();
      if (direction !== Math.sign(target - origin)) {
        mode = 'return'; target = origin; flight = queuedBudget = null; budget = 0; locked = true;
        clearPreview(); schedule();
      } else if (queuedBudget !== null || (fresh && now - flight.start > 140)) {
        queuedBudget = (queuedBudget || 0) + clamp(delta, -140, 140);
      }
      return;
    }
    if (locked && !fresh) { event.preventDefault(); return; }
    locked = false;
    if (mode === 'idle') {
      const scroller = scrollable(element, direction);
      if (scroller) { nativeScroller = scroller; nativeDirection = direction; edgeBudget = edgeStreak = 0; return; }
      let carry = 0;
      if (nativeScroller && direction === nativeDirection && !fresh) {
        // Decaying momentum stays in the section; sustained pressure can keep going.
        const steady = magnitude >= 18 && magnitude >= previousMagnitude * .92;
        edgeStreak = steady ? edgeStreak + 1 : 0;
        edgeBudget = steady ? edgeBudget + clamp(delta, -140, 140) : 0;
        if (edgeStreak < 2) { event.preventDefault(); return; }
        carry = edgeBudget - clamp(delta, -140, 140);
      }
      nativeScroller = null; edgeBudget = edgeStreak = 0;
      startGesture(); budget = carry;
      if (!nextStop(direction)) return;
    } else if (mode === 'return') {
      dragBase = position; budget = 0;
      // A hand catching the page absorbs its opposite momentum immediately.
      if (velocity * direction < 0) velocity = 0;
    }
    event.preventDefault(); root.classList.add('wheel-paging'); pull(delta);
  }, { passive: false });
  addEventListener('resize', configure, { passive: true });
  addEventListener('keydown', cancel);
  addEventListener('pointerdown', cancel, { passive: true });
  addEventListener('touchstart', () => { cancel(); root.classList.remove('wheel-paging'); }, { passive: true });
  document.addEventListener('focusin', cancel);
  addEventListener('hashchange', cancel); addEventListener('popstate', cancel);
  addEventListener('pagehide', cancel); addEventListener('pageshow', configure);
  addEventListener('load', () => {
    layoutReady = true; previousGeometry = null;
    if (mode === 'idle') configure();
  }, { once: true });
  if (header && 'ResizeObserver' in window) new ResizeObserver(configure).observe(header);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  desktop.addEventListener('change', configure); reduced.addEventListener('change', configure);
  configure();
})();
