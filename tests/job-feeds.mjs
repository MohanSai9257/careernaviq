import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
vm.runInThisContext(
  readFileSync(new URL('../worker/job-feeds.js', import.meta.url), 'utf8'),
);
assert.equal(jobCategory('Senior Full-Stack Developer'), 'java');
assert.equal(jobCategory('Mechanical Validation Engineer'), '');
assert.equal(usLocation('Remote, US'), true);
assert.equal(usLocation('Bangalore, IN, India'), false);
assert.equal(usLocation('Remote'), false);
const original = globalThis.fetch;
const date = new Date().toISOString();
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/postings?'))
    return Response.json({
      totalFound: 2,
      content: [
        { id: '1', name: 'Senior Java Developer', location: { country: 'us' } },
        { id: '2', name: 'Software Engineer', location: { country: 'in' } },
      ],
    });
  if (url.endsWith('/postings/1'))
    return Response.json({
      id: '1',
      name: 'Senior Java Developer',
      active: true,
      visibility: 'PUBLIC',
      postingUrl: 'https://jobs.smartrecruiters.com/Endava/1',
      releasedDate: date,
      jobAd: {
        sections: {
          qualifications: { text: 'At least 5 years of experience' },
        },
      },
    });
  throw Error('Unexpected request ' + url);
};
const r = await readCompanyFeed({
  id: 'Endava Solutions, LLC',
  careers: 'https://www.endava.com/careers',
});
assert.equal(r.jobs.length, 1);
assert.equal(r.jobs[0].postedAt, date);
assert.equal(r.jobs[0].minYears, 5);
assert.equal(r.complete, true);
globalThis.fetch = original;
console.log(
  'PASS: official board routing, US-only SmartRecruiters import, title normalization, posted date and experience.',
);
