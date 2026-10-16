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
  const outgoing = document.createElement('img');
  outgoing.className = 'lightbox-outgoing';
  outgoing.alt = '';
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.draggable = false;
  outgoing.hidden = true;
  stage.append(outgoing);
  image.hidden = true;
  let index = 0, request = 0, returnFocus = null, start = null;
  let modalActive = false, previousHash = '', loadingTimer = 0, hashTimer = 0, lastHashWrite = 0;
  let photoAnimations = [];
  const entrances = new Set();

  function setHash(id) {
    const url = new URL(window.location.href);
    url.hash = id || '';
    if (url.hash === window.location.hash) return;
    try {
      history.replaceState(history.state, '', url);
      lastHashWrite = Date.now();
    } catch {
      // A browser history rate limit must not interrupt photograph navigation.
    }
  }
  function queueHash(id) {
    clearTimeout(hashTimer);
    const delay = Math.max(0, 350 - (Date.now() - lastHashWrite));
    if (!delay) setHash(id);
    else hashTimer = setTimeout(() => { if (dialog.open) setHash(id); }, delay);
  }
  function clearTransition() {
    photoAnimations.forEach(animation => animation.cancel());
    photoAnimations = [];
    outgoing.hidden = true;
    outgoing.removeAttribute('src');
  }
  async function showPhoto(nextIndex) {
    if (!dialog.open) return;
    index = ((nextIndex % links.length) + links.length) % links.length;
    const link = links[index];
    const token = ++request;
    const targetIndex = index;
    clearTimeout(loadingTimer);
    stage.classList.add('is-loading');
    stage.setAttribute('aria-busy', 'true');
    if (status.contains(document.activeElement)) dialog.querySelector('.lightbox-close').focus({ preventScroll: true });
    status.textContent = '';
    // Cached photographs should not flash a loading message between frames.
    loadingTimer = setTimeout(() => {
      if (token === request && dialog.open) status.textContent = 'Loading photograph…';
    }, 220);
    counter.textContent = `${index + 1} / ${links.length}`;
    name.textContent = link.dataset.name || '';
    queueHash(link.id);
    const loaded = new Image();
    loaded.alt = link.querySelector('img')?.alt || '';
    try {
      await new Promise((resolve, reject) => {
        loaded.onload = resolve;
        loaded.onerror = reject;
        loaded.src = link.href;
      });
      if (loaded.decode) await loaded.decode();
      if (token !== request || !dialog.open) return;
      // Finish this short blend before replacing its layers. Only the latest
      // decoded request continues, so quick input never resets a partial fade.
      if (photoAnimations.length) await Promise.allSettled(photoAnimations.map(animation => animation.finished));
      if (token !== request || !dialog.open) return;
      clearTimeout(loadingTimer);
      clearTransition();
      const previousSource = !image.hidden && image.getAttribute('src');
      const animate = !reduced.matches && !document.hidden && previousSource !== loaded.src && typeof image.animate === 'function';
      if (previousSource && animate) {
        outgoing.src = previousSource;
        outgoing.hidden = false;
      }
      image.src = loaded.src;
      image.alt = loaded.alt;
      image.hidden = false;
      status.textContent = '';
      stage.classList.remove('is-loading');
      stage.setAttribute('aria-busy', 'false');
      // Keep the old photograph until its replacement is decoded, then blend.
      if (animate) {
        const options = { duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' };
        photoAnimations = [image.animate([{ opacity: 0 }, { opacity: 1 }], options)];
        Promise.all(photoAnimations.map(animation => animation.finished)).then(() => {
          if (token === request) clearTransition();
        }).catch(() => {});
      }
      // Fetch just the next viewing image, after the current photo is ready.
      if (!navigator.connection?.saveData) {
        const next = new Image();
        next.src = links[(targetIndex + 1) % links.length].href;
      }
    } catch {
      if (token !== request || !dialog.open) return;
      clearTimeout(loadingTimer);
      clearTransition();
      image.hidden = true;
      image.removeAttribute('src');
      image.alt = '';
      stage.classList.remove('is-loading');
      stage.setAttribute('aria-busy', 'false');
      status.textContent = 'This photograph could not load. ';
      const fallback = document.createElement('a');
      fallback.href = link.href;
      fallback.textContent = 'Open image';
      fallback.style.textDecoration = 'underline';
      status.append(fallback);
    }
  }
  function finishClose(restoreFocus = true) {
    if (!modalActive) return;
    modalActive = false;
    ++request;
    clearTimeout(loadingTimer);
    clearTimeout(hashTimer);
    clearTransition();
    start = null;
    image.hidden = true;
    image.removeAttribute('src');
    image.alt = '';
    stage.classList.remove('is-loading');
    stage.setAttribute('aria-busy', 'false');
    status.textContent = '';
    document.documentElement.classList.remove('gallery-modal-open');
    if (links.some(link => '#' + link.id === window.location.hash)) setHash(previousHash);
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  function close() {
    dialog.close();
    // The native close event is queued; clean up before an immediate reopen.
    finishClose();
  }
  function open(nextIndex, trigger) {
    if (!dialog.open) {
      finishClose(false);
      returnFocus = trigger || links[nextIndex];
      previousHash = links.some(link => '#' + link.id === window.location.hash) ? '' : window.location.hash;
      document.documentElement.classList.add('gallery-modal-open');
      modalActive = true;
      dialog.showModal();
    }
    showPhoto(nextIndex);
  }
  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    open(i, link);
  }));
  dialog.querySelector('.lightbox-close').addEventListener('click', close);
  dialog.querySelector('[data-step="-1"]').addEventListener('click', () => showPhoto(index - 1));
  dialog.querySelector('[data-step="1"]').addEventListener('click', () => showPhoto(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')].filter(control => control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPhoto(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    // Ignore a queued event belonging to a dialog that has already reopened.
    if (!dialog.open) finishClose();
  });
  dialog.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !event.isPrimary) start = null;
  }, true);
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary || event.target.closest('a, button')) return;
    if (window.visualViewport && window.visualViewport.scale > 1.05) return;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointercancel', () => { start = null; });
  stage.addEventListener('lostpointercapture', () => { start = null; });
  stage.addEventListener('pointerup', event => {
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    if (window.visualViewport && window.visualViewport.scale > 1.05) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(index + (dx < 0 ? 1 : -1));
  });
  function syncHash() {
    const linkedIndex = links.findIndex(link => '#' + link.id === window.location.hash);
    if (linkedIndex !== -1) open(linkedIndex);
    else if (dialog.open) close();
  }
  window.addEventListener('hashchange', syncHash);
  syncHash();

  // Small, one-time entrances; the gallery itself uses ordinary free scrolling.
  let observer;
  if (!reduced.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (typeof entry.target.animate === 'function' && !reduced.matches) {
          const animation = entry.target.animate([{ opacity: .4, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
            { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
          entrances.add(animation);
          animation.finished.then(() => entrances.delete(animation), () => entrances.delete(animation));
        }
      });
    }, { threshold: .05 });
    document.querySelectorAll('.photo-item').forEach(item => observer.observe(item));
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    start = null;
    clearTransition();
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
  });
  const stopMotion = () => {
    if (!reduced.matches) return;
    clearTransition();
    entrances.forEach(animation => animation.cancel());
    entrances.clear();
    observer?.disconnect();
  };
  if (reduced.addEventListener) reduced.addEventListener('change', stopMotion);
  else reduced.addListener(stopMotion);
})();
