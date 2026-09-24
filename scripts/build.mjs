import fs from 'node:fs/promises';
const assets={};for(const f of ['index.html','recruiter-directory.html','profile.html','restricted.html','style.css','access.js','sidebar.js','profile.js','section.js','restricted.js','app.js','companies.json','logo.svg'])assets['/'+f]=await fs.readFile('dist/'+f,'utf8');
await fs.mkdir('dist/server',{recursive:true});
await fs.writeFile('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+await fs.readFile('worker/index.js','utf8'));
