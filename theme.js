// Apply the saved theme before styles paint, including on direct page visits.
(() => {
  const root = document.documentElement;
  const key = 'uijolfs-theme';
  let theme = 'light';
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  function apply(value) {
    theme = value === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0e12' : '#f2f0eb');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
      button.title = theme === 'dark' ? 'Day mode' : 'Night mode';
      button.textContent = theme === 'dark' ? '☀' : '☾';
    }
    document.dispatchEvent(new Event('themechange'));
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const actions = document.createElement('div');
    actions.className = 'header-actions';
    const github = header.querySelector('.github-link');
    if (github) { header.insertBefore(actions, github); actions.append(github); }
    else header.append(actions);
    const button = document.createElement('button');
    button.id = 'theme-toggle'; button.className = 'theme-toggle'; button.type = 'button';
    actions.append(button);
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch {}
    });
    apply(theme);
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
  window.addEventListener('pageshow', () => {
    try { apply(localStorage.getItem(key)); } catch { apply(theme); }
  });
})();
