// Native links keep new tabs, history, deep links and no-JS navigation intact.
(() => {
  const page = document.body.dataset.page;
  const header = document.querySelector('.site-header');
  if (page && header) {
    const syncHeader = () => document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    syncHeader();
    if ('ResizeObserver' in window) new ResizeObserver(syncHeader).observe(header);
  }
  if (page) document.querySelectorAll('nav a').forEach(link => {
    if (link.getAttribute('href') === page + '.html') {
      link.classList.add('active'); link.setAttribute('aria-current', 'page');
    }
  });
  const key = 'uijolfs-home-return';
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!page && !document.body.classList.contains('gallery-page') && new URL(link.href).pathname !== location.pathname) {
      const section = link.closest('main > section');
      if (section) try { sessionStorage.setItem(key, section.id); } catch {}
    }
    if (link.hasAttribute('data-home-return')) {
      try { const section = sessionStorage.getItem(key); if (section) link.href = 'index.html#' + section; } catch {}
    }
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting || reduced.matches) return;
      entry.target.getAnimations().forEach(a => a.cancel());
      const children = [...entry.target.children];
      children.forEach((child, i) => child.animate?.([
        {opacity:.3, transform:'translateY(16px)'}, {opacity:1, transform:'none'}
      ], {duration:440,delay:Math.min(i*55,165),easing:'cubic-bezier(.22,1,.36,1)'}));
    }), {threshold:.12});
    document.querySelectorAll('.chapter-inner').forEach(el => observer.observe(el));
    reduced.addEventListener('change', () => {
      if (reduced.matches) document.querySelectorAll('.chapter-inner > *').forEach(el => el.getAnimations().forEach(a => a.cancel()));
    });
  }
})();
