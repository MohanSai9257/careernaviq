import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync('dist/theme.js', 'utf8');
function run(saved, systemDark) {
  let button;
  const select = {
    value: 'system',
    addEventListener(event, handler) {
      this[event] = handler;
    },
  };
  const listeners = {};
  const store = new Map(saved ? [['careernaviq-theme', saved]] : []);
  const dataset = {};
  const ctx = vm.createContext({
    window: {
      matchMedia: () => ({ matches: systemDark, addEventListener() {} }),
      addEventListener: (event, handler) => (listeners[event] = handler),
    },
    localStorage: {
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
    },
    document: {
      documentElement: { dataset },
      getElementById: (id) =>
        id === 'theme-toggle' ? button : id === 'profile-theme' ? select : null,
      addEventListener: (event, handler) => (listeners[event] = handler),
      querySelector: () => ({ append: (b) => (button = b) }),
      createElement: () => ({
        setAttribute() {},
        addEventListener(event, handler) {
          this[event] = handler;
        },
      }),
    },
  });
  vm.runInContext(source, ctx);
  listeners.DOMContentLoaded();
  return { dataset, button, select, store, listeners };
}
const dark = run(null, true);
assert.equal(dark.dataset.theme, 'dark');
dark.button.click();
assert.equal(dark.dataset.theme, 'light');
assert.equal(dark.store.get('careernaviq-theme'), 'light');
const remembered = run('dark', false);
assert.equal(remembered.dataset.theme, 'dark');
remembered.listeners.storage({ key: 'careernaviq-theme', newValue: 'light' });
assert.equal(remembered.dataset.theme, 'light');
remembered.select.value = 'dark';
remembered.select.change();
assert.equal(remembered.dataset.theme, 'dark');
remembered.select.value = 'system';
remembered.select.change();
assert.equal(remembered.dataset.theme, 'light');
assert.equal(remembered.store.get('careernaviq-theme'), 'system');
for (const name of [
  'index',
  'careernaviq',
  'recruiter-directory',
  'ai-auto-apply',
  'profile',
  'restricted',
]) {
  const html = fs.readFileSync(`dist/${name}.html`, 'utf8');
  assert(html.includes('/theme.js'));
  assert(html.includes('/dark-theme.css'));
}
console.log(
  'Theme system preference, saved choice, toggle, cross-tab sync, and page inclusion checks passed.',
);
