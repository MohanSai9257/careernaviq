import fs from 'node:fs/promises';
const assets = {};
for (const f of [
  'index.html',
  'careernaviq.html',
  'recruiter-directory.html',
  'profile.html',
  'restricted.html',
  'style.css',
  'dark-theme.css',
  'mobile-app.css',
  'theme.js',
  'mobile-app.js',
  'vault.js',
  'chat-files.js',
  'access.js',
  'careernaviq.js',
  'sidebar.js',
  'profile.js',
  'section.js',
  'restricted.js',
  'app.js',
  'ai-auto-apply.html',
  'ai-auto-apply.js',
  'companies.json',
  'logo.svg',
])
  assets['/' + f] = await fs.readFile('dist/' + f, 'utf8');
await fs.mkdir('dist/server', { recursive: true });
await fs.writeFile(
  'dist/server/index.js',
  'const ASSETS=' +
    JSON.stringify(assets) +
    ';\n' +
    (await fs.readFile('worker/job-feeds.js', 'utf8')) +
    '\n' +
    (await fs.readFile('worker/chat.js', 'utf8')) +
    '\n' +
    (await fs.readFile('worker/vault.js', 'utf8')) +
    '\n' +
    (await fs.readFile('worker/index.js', 'utf8')),
);
