// Apply the saved theme before styles paint, including on direct page visits.
(() => {
  const root = document.documentElement;
  const key = 'uijolfs-theme';
  let theme = 'light';
  let unsaved = false;
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  function apply(value) {
    theme = value === 'dark' ? 'dark' : 'light';
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0e12' : '#f2f0eb');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      // A toggle's name stays stable; aria-pressed describes its current state.
      button.setAttribute('aria-label', 'Night mode');
      button.title = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';
      button.textContent = theme === 'dark' ? '☀' : '☾';
    }
    if (changed) document.dispatchEvent(new Event('themechange'));
  }
  apply(theme);
  function setup() {
    const header = document.querySelector('.site-header');
    if (!header || document.getElementById('theme-toggle')) return;
    let actions = header.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      const github = header.querySelector('.github-link');
      if (github) { header.insertBefore(actions, github); actions.append(github); }
      else header.append(actions);
    }
    const button = document.createElement('button');
    button.id = 'theme-toggle'; button.className = 'theme-toggle'; button.type = 'button';
    actions.append(button);
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); unsaved = false; } catch { unsaved = true; }
    });
    apply(theme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== localStorage) return;
      unsaved = false;
      // Several tabs can toggle quickly; read the latest value, not an older
      // value from a storage event that was waiting in the event queue.
      apply(localStorage.getItem(key));
    } catch {}
  });
  window.addEventListener('pageshow', () => {
    // Keep the user's current choice when persistence is blocked or full.
    if (unsaved) return;
    try { apply(localStorage.getItem(key)); } catch { apply(theme); }
  });
})();
