// Native links keep new tabs, history, deep links and no-JS navigation intact.
(() => {
  const page = document.body.dataset.page;
  const header = document.querySelector('.site-header');
  const isHome = !page && !document.body.classList.contains('gallery-page');
  if (!isHome && header) {
    let frame = 0, measure = true, previousHeight = 0;
    const syncHeader = () => {
      frame = 0;
      if (measure) {
        measure = false;
        const height = header.offsetHeight;
        if (height !== previousHeight) {
          document.documentElement.style.setProperty('--header-height', height + 'px');
          previousHeight = height;
        }
      }
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(syncHeader); };
    const scheduleMeasure = () => { measure = true; schedule(); };
    syncHeader();
    if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(header);
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pageshow', scheduleMeasure);
  }
  if (page) document.querySelectorAll('nav a').forEach(link => {
    const selected = new URL(link.href).pathname === location.pathname;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const key = 'uijolfs-home-return';
  const homeSections = new Set(['home', 'about', 'research', 'notes', 'personal']);
  const homePath = new URL('index.html', location.href).pathname;
  const isHomePath = path => path === homePath || path === homePath.replace(/index\.html$/, '');
  const returnLinks = [...document.querySelectorAll('a[data-home-return]')];
  const originalLinks = new Map(returnLinks.map(link => [link, link.getAttribute('href')]));
  function syncReturnLinks() {
    let section = null;
    try {
      const record = JSON.parse(sessionStorage.getItem(key));
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === location.origin && isHomePath(referrer.pathname)
        && record?.destination === location.pathname && homeSections.has(record.section)) section = record.section;
    } catch {}
    returnLinks.forEach(link => {
      const original = originalLinks.get(link);
      if (!section) { link.setAttribute('href', original); return; }
      const url = new URL(original, location.href);
      url.hash = section;
      link.href = url.href;
    });
  }
  // Resolve the actual href before interaction, so modifier-click and copying
  // the link use the same destination as an ordinary click. BFCache retains
  // this page's destination even after another visit updates session storage.
  syncReturnLinks();
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!isHome || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || link.hasAttribute('download')
      || (link.target && link.target.toLowerCase() !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol) || isHomePath(url.pathname)) return;
    const section = link.closest('main > section')?.id || url.pathname.split('/').pop().replace(/\.html$/, '');
    if (homeSections.has(section)) {
      try { sessionStorage.setItem(key, JSON.stringify({ section, destination: url.pathname })); } catch {}
    }
  });

  // Each chapter owns its animations. Cancelling a chapter never interrupts
  // unrelated hover, focus or page-transition effects on its descendants.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window)) return;
  const records = new Map([...document.querySelectorAll('.chapter-inner')].map(element => [element,
    { visible: false, initial: true, animations: new Set() }
  ]));
  let observer = null;
  let pageMoving = document.documentElement.classList.contains('is-page-scrolling');
  function cancel(record) {
    record.animations.forEach(animation => {
      animation.onfinish = animation.oncancel = null;
      animation.cancel();
    });
    record.animations.clear();
  }
  function stop() {
    observer?.disconnect();
    observer = null;
    records.forEach(cancel);
  }
  function start(restore = false) {
    stop();
    if (reduced.matches || document.hidden || !records.size) return;
    records.forEach(record => { record.visible = false; record.initial = true; });
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const record = records.get(entry.target);
      const visible = entry.isIntersecting && entry.intersectionRatio >= (record.visible ? .04 : .12);
      const first = record.initial;
      record.initial = false;
      if (visible === record.visible) return;
      record.visible = visible;
      cancel(record);
      if (!visible || pageMoving || document.documentElement.classList.contains('is-page-scrolling')
        || reduced.matches || document.hidden || (restore && first)
        || entry.target.contains(document.activeElement)) return;
      const direction = entry.boundingClientRect.top < (entry.rootBounds?.top || 0) ? -1 : 1;
      [...entry.target.children].forEach((child, index) => {
        if (typeof child.animate !== 'function') return;
        const style = getComputedStyle(child);
        const transform = style.transform === 'none' ? '' : ' ' + style.transform;
        const animation = child.animate([
          { opacity: .65, transform: `translateY(${direction * 8}px)${transform}` },
          { opacity: style.opacity, transform: style.transform }
        ], { duration: 380, delay: Math.min(index * 20, 60), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        record.animations.add(animation);
        animation.onfinish = () => {
          record.animations.delete(animation);
          animation.onfinish = null;
          animation.cancel();
        };
      });
    }), { threshold: [0, .04, .12] });
    records.forEach((record, element) => observer.observe(element));
  }
  document.addEventListener('page-motion', event => {
    pageMoving = event.detail?.active === true;
    if (pageMoving) records.forEach(cancel);
  });
  reduced.addEventListener('change', () => start(true));
  document.addEventListener('focusin', event => {
    records.forEach((record, element) => { if (element.contains(event.target)) cancel(record); });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(true); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    pageMoving = document.documentElement.classList.contains('is-page-scrolling');
    if (event.persisted) start(true);
  });
  start();
})();
