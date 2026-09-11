(() => {
  const links = [...document.querySelectorAll('.photo-link')];
  const dialog = document.querySelector('.photo-lightbox');
  if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('img');
  const stage = dialog.querySelector('.lightbox-stage');
  const status = dialog.querySelector('.lightbox-status');
  const counter = dialog.querySelector('.lightbox-counter');
  const name = dialog.querySelector('.lightbox-name');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, request = 0, returnFocus = null, start = null;
  let previousOverflow = '';

  function setHash(id) {
    const url = new URL(window.location.href);
    url.hash = id || '';
    history.replaceState(history.state, '', url);
  }
  async function showPhoto(nextIndex) {
    index = (nextIndex + links.length) % links.length;
    const link = links[index];
    const token = ++request;
    const targetIndex = index;
    stage.classList.add('is-loading');
    status.textContent = 'Loading photograph…';
    counter.textContent = `${index + 1} / ${links.length}`;
    name.textContent = link.dataset.name;
    setHash(link.id);
    const loaded = new Image();
    loaded.alt = link.querySelector('img').alt;
    try {
      await new Promise((resolve, reject) => {
        loaded.onload = resolve;
        loaded.onerror = reject;
        loaded.src = link.href;
      });
      if (loaded.decode) await loaded.decode();
      if (token !== request || !dialog.open) return;
      image.src = loaded.src;
      image.alt = loaded.alt;
      status.textContent = '';
      stage.classList.remove('is-loading');
      // Fetch just the next viewing image, after the current photo is ready.
      if (!navigator.connection?.saveData) {
        const next = new Image();
        next.src = links[(targetIndex + 1) % links.length].href;
      }
    } catch {
      if (token !== request || !dialog.open) return;
      status.textContent = 'This photograph could not load. ';
      const fallback = document.createElement('a');
      fallback.href = link.href;
      fallback.textContent = 'Open image';
      fallback.style.textDecoration = 'underline';
      status.append(fallback);
    }
  }
  function open(nextIndex, trigger) {
    if (!dialog.open) {
      returnFocus = trigger || links[nextIndex];
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.classList.add('gallery-modal-open');
      dialog.showModal();
    }
    showPhoto(nextIndex);
  }
  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    open(i, link);
  }));
  dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-step="-1"]').addEventListener('click', () => showPhoto(index - 1));
  dialog.querySelector('[data-step="1"]').addEventListener('click', () => showPhoto(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('close', () => {
    ++request;
    start = null;
    document.documentElement.classList.remove('gallery-modal-open');
    document.documentElement.style.overflow = previousOverflow;
    setHash('');
    returnFocus?.focus({ preventScroll: true });
  });
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    start = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointercancel', () => { start = null; });
  stage.addEventListener('pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(index + (dx < 0 ? 1 : -1));
  });
  const linkedIndex = links.findIndex(link => '#' + link.id === window.location.hash);
  if (linkedIndex !== -1) open(linkedIndex);

  // Small, one-time entrances; the gallery itself uses ordinary free scrolling.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (typeof entry.target.animate === 'function' && !reduced.matches) {
          entry.target.animate([{ opacity: .4, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
            { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
        }
      });
    }, { threshold: .05 });
    document.querySelectorAll('.photo-item').forEach(item => observer.observe(item));
  }
})();
