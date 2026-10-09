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
