import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../dist/server/index.js';
const root = new URL('..', import.meta.url).pathname;
const sqlite = new DatabaseSync(':memory:');
for (const name of readdirSync(root + '/drizzle')
  .filter((x) => /^\d+.*\.sql$/.test(x))
  .sort())
  sqlite.exec(
    readFileSync(root + '/drizzle/' + name, 'utf8').replaceAll(
      '--> statement-breakpoint',
      '',
    ),
  );
const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...v) {
        if (v.length > 100) throw Error('D1 parameter limit exceeded');
        args = v;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...args) || null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args) };
      },
      async run() {
        return sqlite.prepare(sql).run(...args);
      },
    };
  },
};
sqlite
  .prepare('INSERT INTO access_sessions VALUES (?,?,?,?)')
  .run('admin', 'chatgpt3577@gmail.com', 'admin', 'now');
sqlite
  .prepare(
    'INSERT INTO added_companies (id,normalized_name,name,careers,category) VALUES (?,?,?,?,?)',
  )
  .run(
    'test-board',
    'test board',
    'Test Board',
    'https://boards.greenhouse.io/testboard',
    'implementation',
  );
let fail = false;
const day = new Date().toISOString().slice(0, 10),
  old = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
const date = (d) => {
  const [y, m, a] = d.split('-');
  return `${m}/${a}/${y}`;
};
const listing = (id, title, d) =>
  `<div class="jobbox"><h2><a href="/job/?id=${id}">${title}</a></h2><span>Date Posted: ${date(d)}</span></div><div class="jobbody">Software development</div>`;
globalThis.fetch = async (input) => {
  if (fail) return new Response('Unavailable', { status: 503 });
  if (String(input).includes('/companies/Endava/postings?'))
    return Response.json({
      totalFound: 2,
      content: [
        { id: 'us-1', name: 'Java Developer', location: { country: 'us' } },
        { id: 'in-1', name: 'Java Developer', location: { country: 'in' } },
      ],
    });
  if (String(input).endsWith('/companies/Endava/postings/us-1'))
    return Response.json({
      id: 'us-1',
      name: 'Java Developer',
      active: true,
      visibility: 'PUBLIC',
      postingUrl: 'https://jobs.smartrecruiters.com/Endava/us-1',
      releasedDate: new Date().toISOString(),
      jobAd: {
        sections: { qualifications: { text: '5 years of experience' } },
      },
    });
  if (String(input).includes('jobtext='))
    return new Response(
      listing(101, 'Senior Java Software Engineer', day) +
        listing(102, 'Mechanical Validation Engineer', day) +
        listing(103, 'Data Engineer', old) +
        listing(101, 'Senior Java Software Engineer', day),
    );
  return new Response(
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Developer', description: '5+ years of experience', url: String(input), jobLocation: { address: { addressCountry: 'US' } } })}</script>`,
  );
};
async function call(path, body) {
  const r = await worker.fetch(
    new Request('https://directory.test' + path, {
      method: 'POST',
      headers: {
        Cookie: 'directory_session=admin',
        Origin: 'https://directory.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    { DB },
  );
  return { status: r.status, body: await r.json() };
}

let r = await call('/api/jobs/generate', {});
if (r.status !== 200 || r.body.jobsFound !== 3) throw Error(JSON.stringify(r));
r = await call('/api/jobs/generate', {});
if (
  r.body.status !== 'cached' ||
  sqlite.prepare('SELECT count(*) n FROM imported_jobs').get().n !== 3
)
  throw Error('dedup/cooldown failed');
if (
  sqlite
    .prepare(
      "SELECT count(*) n FROM imported_jobs WHERE apply_url LIKE '%/in-1'",
    )
    .get().n !== 0
)
  throw Error('Non-US employer job imported');
sqlite
  .prepare(
    'INSERT INTO imported_jobs (id,company_id,company_name,category,title,apply_url,source_id,posted_at,discovered_at,last_seen_at,is_open,min_years,max_years) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)',
  )
  .run(
    'legacy-overseas',
    'source:legacy',
    'Legacy overseas source',
    'java',
    'Java Developer',
    'https://example.com/legacy-overseas',
    'legacy-overseas',
    day,
    new Date().toISOString(),
    new Date().toISOString(),
    null,
    null,
  );
r = await call('/api/jobs/query', { category: 'java', window: 'day' });
if (r.body.items.length !== 2 || !r.body.items.some((x) => x.posted_at === day))
  throw Error('US source/date/category filter failed');
r = await call('/api/jobs/query', { category: 'data', window: 'day' });
if (r.body.items.length) throw Error('old date included');
r = await call('/api/jobs/query', {
  category: 'data',
  window: 'all',
  maxYears: 4,
});
if (r.body.items.length) throw Error('experience filter failed');
r = await call('/api/jobs/query', {
  category: 'data',
  window: 'all',
  minYears: 5,
});
if (r.body.items.length !== 1) throw Error('experience match failed');
sqlite.prepare("UPDATE job_source_checks SET checked_at='2000-01-01'").run();
fail = true;
r = await call('/api/jobs/generate', {});
if (r.status === 200) throw Error('failure hidden');
r = await call('/api/jobs/query', { category: 'java', window: 'all' });
if (r.body.items.length !== 2 || r.body.source.status !== 'error')
  throw Error('saved data lost on failure');
const denied = await worker.fetch(
  new Request('https://directory.test/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'refresh_elite_jobs' },
    }),
  }),
  { DB },
);
if (denied.status !== 403) throw Error('unattended writer unprotected');
console.log(
  'PASS: Elite import, duplicate prevention, refresh cooldown, real date/category/experience filters, source failure preserves jobs, updater authorization.',
);
