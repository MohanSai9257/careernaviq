(() => {
  const key = 'careernaviq-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let choice;
  try {
    choice = localStorage.getItem(key);
  } catch {}
  const current = () =>
    ['light', 'dark'].includes(choice)
      ? choice
      : system.matches
        ? 'dark'
        : 'light';
  function apply() {
    const dark = current() === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const select = document.getElementById('profile-theme');
    if (select)
      select.value = ['light', 'dark'].includes(choice) ? choice : 'system';
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    button.setAttribute(
      'aria-label',
      dark ? 'Switch to light theme' : 'Switch to dark theme',
    );
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? 'Light theme' : 'Dark theme';
    button.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 13.2A9 9 0 0 1 10.8 3.2 9 9 0 1 0 20.8 13.2Z"/></svg>';
  }
  function choose(value) {
    choice = value;
    try {
      localStorage.setItem(key, choice);
    } catch {}
    apply();
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('profile-theme');
    select?.addEventListener('change', () => choose(select.value));
    const header = document.querySelector('.masthead .brand');
    if (!header) return;
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.type = 'button';
    button.className = 'theme-toggle';
    button.addEventListener('click', () => {
      choose(current() === 'dark' ? 'light' : 'dark');
    });
    header.append(button);
    apply();
  });
  system.addEventListener('change', apply);
  window.addEventListener('storage', (event) => {
    if (event.key === key) {
      choice = event.newValue;
      apply();
    }
  });
})();
