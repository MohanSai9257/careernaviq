const usStates =
  /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
function safeJobUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      !host.includes('.') ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.includes(':')
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
async function sourceText(value, options = {}) {
  let url = safeJobUrl(value);
  if (!url) throw Error('Career link is not a public HTTPS URL.');
  for (let redirects = 0; redirects < 3; redirects++) {
    const response = await fetch(url.toString(), {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept:
          'text/html, application/json, application/rss+xml, application/xml;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; CarrerNaviq/1.0)',
        ...options.headers,
      },
    });
    if (response.status >= 300 && response.status < 400) {
      url = safeJobUrl(
        new URL(response.headers.get('location') || '', url).toString(),
      );
      if (!url)
        throw Error('Career site redirected to an unsupported address.');
      continue;
    }
    if (!response.ok) throw Error(`Career site returned ${response.status}.`);
    if (Number(response.headers.get('content-length') || 0) > 6000000)
      throw Error('Career feed is too large.');
    const reader = response.body?.getReader();
    if (!reader) throw Error('Career feed is empty.');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > 6000000) {
        await reader.cancel();
        throw Error('Career feed is too large.');
      }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      text: new TextDecoder().decode(bytes),
      url: url.toString(),
      cookies: response.headers.getSetCookie?.() || [],
    };
  }
  throw Error('Career site redirected too many times.');
}
function plain(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:amp|nbsp|quot|lt|gt|#39);/g,
      (c) =>
        ({
          '&amp;': '&',
          '&nbsp;': ' ',
          '&quot;': '"',
          '&lt;': '<',
          '&gt;': '>',
          '&#39;': "'",
        })[c] || c,
    )
    .replace(/\s+/g, ' ')
    .trim();
}
function dateValue(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) && d.getTime() < Date.now() + 86400000
    ? d.toISOString()
    : '';
}
function jobCategory(title, description = '') {
  const t = plain(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim(),
    d = plain(description).toLowerCase();
  if (
    /\b(manager|director|recruiter|sales|accountant|mechanical|electrical|manufacturing|process|hardware|product validation)\b/.test(
      t,
    )
  )
    return '';
  if (
    /\b(computer systems? validation|computerized systems? validation|csv engineer|csv consultant|csv specialist|software validation)\b/.test(
      t,
    )
  )
    return 'validation';
  if (
    /\bvalidation engineer\b/.test(t) &&
    /\b(computerized|computer systems|software|gxp|csv|pharmaceutical systems)\b/.test(
      d,
    )
  )
    return 'validation';
  if (
    /\b(devops|site reliability|\bsre\b|cloud platform|platform engineer|build and release|release engineer|cloud infrastructure|infrastructure engineer|cloud architect)\b/.test(
      t,
    )
  )
    return 'devops';
  if (
    /\b(data analyst|data engineer|big data|analytics engineer|business data analyst|bi data analyst|data platform engineer|data scientist|data architect|data management|data platform)\b/.test(
      t,
    )
  )
    return 'data';
  if (
    /\b(software engineer|software developer|software development engineer|java developer|java engineer|java software engineer|backend developer|backend engineer|back end developer|back end engineer|full stack developer|full stack engineer|application developer|application engineer|web developer|web engineer|java full stack|fullstack developer|fullstack engineer|frontend developer|frontend engineer|front end developer|front end engineer|python developer|net developer|mobile developer|android developer|ios developer|salesforce developer)\b/.test(
      t,
    ) ||
    /\bjava\b.*\b(developer|engineer)\b/.test(t)
  )
    return 'java';
  if (
    /\bprogrammer analyst\b/.test(t) &&
    /\b(software|java|application development|coding|programming)\b/.test(d)
  )
    return 'java';
  return '';
}
function usLocation(value) {
  const location = plain(value);
  if (!location) return false;
  if (/^US$/i.test(location)) return true;
  if (/^(?:IN|MX|GB|UK|AU|DE|FR|PL|RO|SG|CA)$/i.test(location)) return false;
  if (
    /\b(Canada|India|United Kingdom|Australia|Germany|Poland|Romania|France|Singapore|Mexico)\b/i.test(
      location,
    ) &&
    !/\b(United States|USA|US)\b|U\.S\./i.test(location)
  )
    return false;
  if (/\b(United States|USA|US)\b|U\.S\./i.test(location)) return true;
  // Georgia alone may refer to the country; require an explicit US marker.
  if (/\bGeorgia\b/i.test(location)) return false;
  if (usStates.test(location)) return true;
  if (
    /\b(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)\b/i.test(
      location,
    )
  )
    return true;
  return false;
}
function yearsFromDescription(description) {
  const text = plain(description).slice(0, 12000);
  const range = text.match(
    /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:\+\s*)?years?\b/i,
  );
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const minimum =
    text.match(
      /\b(?:minimum|min\.?|at least|requires?|experience of)\s*(\d{1,2})\s*\+?\s*years?\b/i,
    ) || text.match(/\b(\d{1,2})\s*\+\s*years?\b/i);
  return minimum
    ? { min: Number(minimum[1]), max: null }
    : { min: null, max: null };
}
function cleanJob(raw, company) {
  const title = plain(raw.title).slice(0, 200),
    category = jobCategory(title, raw.description);
  const apply = safeJobUrl(raw.url);
  if (
    !title ||
    !category ||
    !apply ||
    !usLocation(raw.location, company.careers)
  )
    return null;
  const years = yearsFromDescription(raw.description);
  return {
    sourceId: String(raw.id || apply.toString()).slice(0, 500),
    title,
    category,
    applyUrl: apply.toString(),
    postedAt: dateValue(raw.postedAt),
    minYears: years.min,
    maxYears: years.max,
  };
}
function jsonLdJobs(html, pageUrl) {
  const found = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(match[1]);
      const walk = (value) => {
        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }
        if (!value || typeof value !== 'object') return;
        if (String(value['@type'] || '').toLowerCase() === 'jobposting') {
          const address =
            value.jobLocation?.address || value.jobLocation?.[0]?.address || {};
          const location = [
            address.addressLocality,
            address.addressRegion,
            address.addressCountry,
            value.applicantLocationRequirements?.name,
          ]
            .filter(Boolean)
            .join(', ');
          found.push({
            id:
              value.identifier?.value ||
              value.identifier ||
              value.url ||
              pageUrl,
            title: value.title,
            url: value.url || pageUrl,
            postedAt: value.datePosted || '',
            location,
            description: value.description || '',
          });
        }
        if (value['@graph']) walk(value['@graph']);
        if (value.mainEntity) walk(value.mainEntity);
      };
      walk(data);
    } catch {}
  }
  return found;
}
function xmlValue(item, tag) {
  return plain(
    item
      .match(
        new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'),
      )?.[1]
      ?.replace(/^<!\[CDATA\[|\]\]>$/g, '') || '',
  );
}
function rssJobs(xml) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(
    ([, item]) => {
      const title = xmlValue(item, 'title'),
        trailing = title.match(/\(([^()]{2,70})\)$/);
      return {
        id: xmlValue(item, 'guid') || xmlValue(item, 'link'),
        title: trailing ? title.slice(0, trailing.index).trim() : title,
        url: xmlValue(item, 'link'),
        postedAt: xmlValue(item, 'pubDate'),
        description: xmlValue(item, 'description'),
        location: xmlValue(item, 'location') || trailing?.[1] || '',
      };
    },
  );
}
function decodeLink(value) {
  return String(value || '').replace(/&amp;|&#0*38;/g, '&');
}
async function inBatches(items, fn, size = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += size)
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return results;
}
function successFactorsRows(html, origin) {
  return [
    ...html.matchAll(
      /<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi,
    ),
  ].flatMap(([, row]) => {
    const link = [...row.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((x) =>
      /jobTitle-link/.test(x[1]),
    );
    if (!link) return [];
    const href = link[1].match(/href=["']([^"']+)/i)?.[1];
    if (!href) return [];
    const url = new URL(decodeLink(href), origin).toString();
    return [
      {
        id: url,
        title: plain(link[2]),
        url,
        location: plain(
          row.match(
            /<td\b[^>]*class=["'][^"']*colLocation[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
          )?.[1] || '',
        ),
        postedAt: plain(
          row.match(
            /<td\b[^>]*class=["'][^"']*colDate[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
          )?.[1] || '',
        ),
        description: '',
      },
    ];
  });
}
async function successFactorsJobs(origin) {
  const results = await inBatches(
    ['software', 'java', 'data', 'devops', 'validation'],
    async (term) => {
      const rows = [];
      for (let offset = 0; offset < 125; offset += 25) {
        const params = new URLSearchParams({
          q: term,
          locationsearch: 'United States',
          sortColumn: 'referencedate',
          sortDirection: 'desc',
          startrow: String(offset),
        });
        try {
          const page = await sourceText(`${origin}/search/?${params}`),
            batch = successFactorsRows(page.text, origin);
          rows.push(...batch);
          if (batch.length < 25) break;
        } catch {
          break;
        }
      }
      return rows;
    },
  );
  return results.flat();
}
async function workdayJobs(career) {
  const tenant = career.hostname.split('.')[0],
    parts = career.pathname.split('/').filter(Boolean),
    board = parts.find((x) => !/^en[-_]US$/i.test(x));
  if (!board) throw Error('Workday board is missing.');
  const root = `${career.origin}/wday/cxs/${tenant}/${board}`;
  const search = async (appliedFacets, offset = 0) =>
    JSON.parse(
      (
        await sourceText(root + '/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appliedFacets,
            limit: 20,
            offset,
            searchText: '',
          }),
        })
      ).text,
    );
  const first = await search({});
  let facet = null;
  const walk = (items) => {
    for (const item of items || []) {
      if (item.facetParameter === 'locationCountry') {
        const us = item.values?.find((v) =>
          /^United States(?: of America)?$/.test(v.descriptor),
        );
        if (us) facet = { [item.facetParameter]: [us.id] };
      }
      if (item.values) walk(item.values);
    }
  };
  walk(first.facets);
  if (!facet) {
    const locations = [];
    const walkLocations = (items) => {
      for (const item of items || []) {
        if (item.facetParameter === 'locations')
          locations.push(
            ...(item.values || [])
              .filter((v) =>
                /^(?:US\b|USA\b|United States)/i.test(v.descriptor),
              )
              .map((v) => v.id),
          );
        if (item.values) walkLocations(item.values);
      }
    };
    walkLocations(first.facets);
    if (locations.length) facet = { locations };
  }
  if (!facet)
    return {
      jobs: [],
      complete: false,
      message: 'This Workday board has no United States location filter.',
    };
  let page = await search(facet),
    postings = [...(page.jobPostings || [])];
  // Listing requests plus at most 30 detail requests stay within the Worker fetch budget.
  for (let offset = 20; offset < Math.min(page.total || 0, 160); offset += 20) {
    const next = await search(facet, offset);
    postings.push(...(next.jobPostings || []));
    if (!next.jobPostings?.length) break;
  }
  const candidates = postings
    .filter((job) => jobCategory(job.title))
    .slice(0, 30);
  let failed = false;
  const jobs = (
    await inBatches(candidates, async (job) => {
      try {
        const detail = JSON.parse(
          (await sourceText(root + job.externalPath)).text,
        ).jobPostingInfo;
        if (!detail) return null;
        // Country-filtered listings establish location even when the display says "multiple locations".
        return {
          id: detail.jobReqId || job.bulletFields?.[0] || job.externalPath,
          title: detail.title || job.title,
          url: `${career.origin}/en-US/${board}${job.externalPath}`,
          location: 'United States',
          postedAt: detail.startDate || '',
          description: detail.jobDescription || '',
        };
      } catch {
        failed = true;
        return null;
      }
    })
  ).filter(Boolean);
  return {
    jobs,
    complete:
      !failed &&
      page.total <= 160 &&
      postings.filter((job) => jobCategory(job.title)).length <= 30,
  };
}
async function oracleJobs(career) {
  const site = career.pathname.match(/\/sites\/([^/]+)/)?.[1] || 'CX_1';
  let jobs = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const query = new URLSearchParams({
      onlyData: 'true',
      expand: 'requisitionList',
      finder: `findReqs;siteNumber=${site},limit=100,offset=${offset},sortBy=POSTING_DATES_DESC`,
    });
    const data = JSON.parse(
      (
        await sourceText(
          `${career.origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?${query}`,
        )
      ).text,
    ).items?.[0];
    if (!data) throw Error('Oracle recruiting returned no search data.');
    jobs.push(
      ...(data.requisitionList || [])
        .filter(
          (j) =>
            j.PrimaryLocationCountry === 'US' &&
            (!j.PostingEndDate || Date.parse(j.PostingEndDate) >= Date.now()),
        )
        .map((j) => ({
          id: j.Id,
          title: j.Title,
          url: `${career.origin}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`,
          location: 'United States',
          postedAt: j.PostedDate,
          description: [
            j.ShortDescriptionStr,
            j.ExternalQualificationsStr,
            j.ExternalResponsibilitiesStr,
          ]
            .filter(Boolean)
            .join(' '),
        })),
    );
    if (offset + 100 >= data.TotalJobsCount) return { jobs, complete: true };
  }
  return { jobs, complete: false };
}
async function tcsJobs() {
  const base = 'https://ibegin.tcsapps.com/candidate/';
  const landing = await sourceText(base + '?geography=US&language=EN');
  if (!/data-country=["']US["']/.test(landing.text))
    throw Error('TCS did not select the United States job board.');
  const cookie = landing.cookies.map((value) => value.split(';')[0]).join('; ');
  if (!cookie) throw Error('TCS could not establish a public careers session.');
  const getPage = async (page) => {
    const response = JSON.parse(
      (
        await sourceText(base + 'api/v1/jobs/searchJ', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({
            jobTitle: null,
            jobCity: null,
            jobFunction: null,
            jobExperience: null,
            jobSkill: null,
            pageNumber: String(page),
            userText: '',
            regular: true,
            walkin: false,
          }),
        })
      ).text,
    );
    if (response.result !== 'Y')
      throw Error('TCS careers search is unavailable.');
    return response.data;
  };
  const first = await getPage(1),
    pages = Math.min(30, Math.ceil(first.totalJobs / 10));
  const rest = await inBatches(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2),
    getPage,
  );
  return {
    jobs: [first, ...rest].flatMap((data) =>
      (data.jobs || []).map((job) => ({
        id: job.id,
        title: job.jobTitle,
        url:
          base +
          'jobs/' +
          encodeURIComponent(job.id) +
          '?geography=US&language=EN',
        location: job.location,
        description: `${job.experience || ''} years. ${job.skills || ''}`,
        postedAt: '',
      })),
    ),
    complete: pages * 10 >= first.totalJobs,
  };
}
// Official recruiting boards verified against the employers' public career pages.
// Keyed by stable directory IDs, never fuzzy employer names.
const officialJobBoards = {
  'CAPGEMINI AMERICA INC': 'https://careers.capgemini.com/',
  'HCL AMERICA INC': 'https://careers.hcltech.com/',
  'Endava Solutions, LLC': 'https://careers.smartrecruiters.com/Endava',
  'NAGARRO, INC': 'https://careers.smartrecruiters.com/Nagarro1',
  'Brillio, LLC': 'https://jobs.lever.co/brillio-2',
  'Rackspace US, Inc.': 'https://rackspace.wd1.myworkdayjobs.com/External',
  'Egen Solutions LLC': 'https://jobs.lever.co/egen',
  'ATOS SYNTEL INC': 'https://jobs.atos.net/',
  'Ernst & Young U.S. LLP': 'https://careers.ey.com/',
  'Yash Technologies, Inc': 'https://careers.yash.com/',
  'Insight Direct USA, Inc.': 'https://jobsearch.insight.com/',
  'Accenture LLP': 'https://accenture.wd103.myworkdayjobs.com/AccentureCareers',
  Kyndryl: 'https://kyndryl.wd5.myworkdayjobs.com/KyndrylProfessionalCareers',
  'DXC Technology Services LLC':
    'https://dxctechnology.wd1.myworkdayjobs.com/DXCJobs',
  'Unisys Corporation': 'https://unisys.wd5.myworkdayjobs.com/External',
  'Quantiphi, Inc.':
    'https://quantiphi.wd1.myworkdayjobs.com/Careers_at_Quantiphi',
  'Hexaware Technologies, Inc.':
    'https://fa-etqo-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  'Zensar Technologies, Inc.':
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  'Iris Software, Inc': 'https://careers.irissoftware.com/',
  'CGI Technologies and Solutions Inc.':
    'https://cgi.njoyn.com/corp/xweb/xweb.asp?CLID=21001&page=joblisting&CountryID=US&lang=1',
};
async function readCompanyFeed(company, depth = 0) {
  const career = safeJobUrl(
    (depth === 0 && officialJobBoards[company.id]) || company.careers,
  );
  if (!career)
    return {
      status: 'unsupported',
      message: 'No usable official careers link.',
      jobs: [],
      complete: false,
    };
  let raw = [],
    source = 'careers page',
    complete = false;
  const host = career.hostname.toLowerCase(),
    segments = career.pathname.split('/').filter(Boolean);
  if (company.id === 'TATA CONSULTANCY SERVICES LIMITED') {
    const result = await tcsJobs();
    raw = result.jobs;
    complete = result.complete;
    source = 'TCS iBegin';
  } else if (company.id === 'Amazon.com Services LLC') {
    const pages = await Promise.all(
      [0, 100, 200, 300].map(async (offset) => {
        const query = new URLSearchParams({
          base_query: 'software engineer',
          country: 'USA',
          sort: 'recent',
          result_limit: '100',
          offset: String(offset),
        });
        return JSON.parse(
          (await sourceText(`https://www.amazon.jobs/en/search.json?${query}`))
            .text,
        );
      }),
    );
    raw = pages.flatMap((page) =>
      (page.jobs || [])
        .filter(
          (job) =>
            job.company_name === 'Amazon.com Services LLC' &&
            job.country_code === 'USA',
        )
        .map((job) => ({
          id: job.id_icims || job.id || job.job_path,
          title: job.title,
          url: new URL(job.job_path, 'https://www.amazon.jobs').toString(),
          location: job.location || 'United States',
          description: job.basic_qualifications || '',
          postedAt: job.posted_date || '',
        })),
    );
    source = 'Amazon careers';
    complete = false;
  } else if (host.endsWith('.myworkdayjobs.com')) {
    const result = await workdayJobs(career);
    raw = result.jobs;
    complete = result.complete;
    source = 'Workday careers';
  } else if (host.endsWith('.oraclecloud.com')) {
    const result = await oracleJobs(career);
    raw = result.jobs;
    complete = result.complete;
    source = 'Oracle careers';
  } else if (host === 'cgi.njoyn.com') {
    const page = await sourceText(career.toString());
    const rows = [
      ...page.text.matchAll(
        /<tr\b[^>]*HasMultipleLocations[^>]*>([\s\S]*?)<\/tr>/gi,
      ),
    ].flatMap(([, row]) => {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
          (x) => x[1],
        ),
        href = cells[0]?.match(/href=['"]([^'"]+)/)?.[1];
      if (
        !href ||
        !jobCategory(plain(cells[1])) ||
        !usLocation(plain(cells.at(-1)))
      )
        return [];
      return [
        {
          url: new URL(decodeLink(href), page.url).toString(),
          title: plain(cells[1]),
        },
      ];
    });
    raw = (
      await inBatches(rows.slice(0, 30), async (row) => {
        try {
          return jsonLdJobs((await sourceText(row.url)).text, row.url);
        } catch {
          return [];
        }
      })
    ).flat();
    source = 'CGI careers';
    complete = false;
  } else if (
    host === 'careers.smartrecruiters.com' ||
    host === 'jobs.smartrecruiters.com'
  ) {
    const board = segments[0];
    if (!board) throw Error('Recruiting board name is missing.');
    let exhausted = false,
      detailFailed = false;
    for (let offset = 0; offset < 500; offset += 100) {
      const data = JSON.parse(
        (
          await sourceText(
            `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?limit=100&offset=${offset}&country=us`,
          )
        ).text,
      );
      const postings = (data.content || [])
        .filter(
          (job) =>
            job.location?.country?.toLowerCase() === 'us' &&
            job.visibility !== 'INTERNAL' &&
            jobCategory(job.name),
        )
        .slice(0, 30 - raw.length);
      for (let i = 0; i < postings.length; i += 5)
        await Promise.all(
          postings.slice(i, i + 5).map(async (job) => {
            // Details supply the real apply URL and experience requirements.
            try {
              const detail = JSON.parse(
                (
                  await sourceText(
                    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings/${encodeURIComponent(job.id)}`,
                  )
                ).text,
              );
              if (detail.active === false || detail.visibility === 'INTERNAL')
                return;
              raw.push({
                id: job.id,
                title: detail.name,
                url: detail.postingUrl || detail.applyUrl,
                location: 'United States',
                postedAt: detail.releasedDate,
                description: Object.values(detail.jobAd?.sections || {})
                  .map((x) => x.text || '')
                  .join(' '),
              });
            } catch {
              detailFailed = true;
            }
          }),
        );
      if (raw.length >= 30) break;
      if (
        offset + (data.content || []).length >= data.totalFound ||
        (data.content || []).length < 100
      ) {
        exhausted = true;
        break;
      }
    }
    source = 'SmartRecruiters';
    complete = exhausted && !detailFailed;
  } else if (
    host === 'boards.greenhouse.io' ||
    host === 'job-boards.greenhouse.io'
  ) {
    const board =
      segments[0] === 'embed' ? career.searchParams.get('for') : segments[0];
    if (!board)
      return {
        status: 'unsupported',
        message: 'Greenhouse board name is missing.',
        jobs: [],
        complete: false,
      };
    const data = JSON.parse(
      (
        await sourceText(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`,
        )
      ).text,
    );
    raw = (data.jobs || [])
      .sort((a, b) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
      )
      .map((job) => ({
        id: job.id,
        title: job.title,
        url: job.absolute_url,
        location: job.location?.name || '',
        description: '',
        postedAt: '',
      }));
    const recent = raw
      .filter(
        (job) =>
          jobCategory(job.title) && usLocation(job.location, company.careers),
      )
      .slice(0, 30);
    for (let index = 0; index < recent.length; index += 5)
      await Promise.all(
        recent.slice(index, index + 5).map(async (job) => {
          try {
            const detail = JSON.parse(
              (
                await sourceText(
                  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(job.id)}`,
                )
              ).text,
            );
            job.postedAt = detail.first_published || '';
            job.description = detail.content || '';
          } catch {}
        }),
      );
    source = 'Greenhouse';
    complete = true;
  } else if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') {
    const board = segments[0];
    if (!board)
      return {
        status: 'unsupported',
        message: 'Lever board name is missing.',
        jobs: [],
        complete: false,
      };
    const apiHost =
      host === 'jobs.eu.lever.co' ? 'api.eu.lever.co' : 'api.lever.co';
    const data = JSON.parse(
      (
        await sourceText(
          `https://${apiHost}/v0/postings/${encodeURIComponent(board)}?mode=json`,
        )
      ).text,
    );
    raw = (Array.isArray(data) ? data : []).map((job) => ({
      id: job.id,
      title: job.text,
      url: job.hostedUrl || job.applyUrl,
      location: job.categories?.location || '',
      description: [
        job.descriptionPlain || job.description || '',
        ...(job.lists || []).map((x) => x.content || ''),
      ].join(' '),
      postedAt: job.createdAt || '',
    }));
    source = 'Lever';
    complete = true;
  } else if (host === 'jobs.ashbyhq.com') {
    const board = segments[0];
    if (!board)
      return {
        status: 'unsupported',
        message: 'Ashby board name is missing.',
        jobs: [],
        complete: false,
      };
    const data = JSON.parse(
      (
        await sourceText(
          `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`,
        )
      ).text,
    );
    raw = (data.jobs || [])
      .filter((job) => job.isListed !== false)
      .map((job) => ({
        id: job.id || job.jobUrl,
        title: job.title,
        url: job.applyUrl || job.jobUrl,
        location: [
          job.location,
          job.address?.postalAddress?.addressCountry,
          ...(job.secondaryLocations || []).flatMap((x) => [
            x.location,
            x.address?.addressCountry,
          ]),
        ]
          .filter(Boolean)
          .join(', '),
        description: job.descriptionPlain || '',
        postedAt: job.publishedAt || '',
      }));
    source = 'Ashby';
    complete = true;
  } else {
    const page = await sourceText(career.toString());
    raw = jsonLdJobs(page.text, page.url);
    const redirected = safeJobUrl(page.url);
    if (
      depth < 2 &&
      redirected &&
      redirected.hostname.endsWith('.myworkdayjobs.com')
    )
      return readCompanyFeed({ ...company, careers: page.url }, depth + 1);
    const feed =
      page.text.match(
        /<link\b[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)/i,
      ) ||
      page.text.match(
        /<link\b[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i,
      );
    if (feed) {
      const rssUrl = safeJobUrl(
        new URL(feed[1].replace(/&amp;/g, '&'), page.url).toString(),
      );
      if (rssUrl && rssUrl.hostname === new URL(page.url).hostname) {
        const rss = await sourceText(rssUrl.toString());
        raw.push(...rssJobs(rss.text));
        source = 'Careers RSS';
        complete = true;
      }
    }
    if (
      page.text.includes('BS3ColumnizedSearch') ||
      page.text.includes('/services/rss/job/')
    ) {
      const origin = new URL(page.url).origin,
        listings = await successFactorsJobs(origin);
      raw.push(...listings);
      source = 'Careers search';
      complete = false;
      if (!listings.length) {
        const fallback = await inBatches(
          ['software', 'java', 'data', 'devops', 'validation'],
          async (term) => {
            try {
              return rssJobs(
                (
                  await sourceText(
                    `${origin}/services/rss/job/?locale=en_US&keywords=${encodeURIComponent(`(${term}) AND locationSearch:(United States)`)}`,
                  )
                ).text,
              );
            } catch {
              return [];
            }
          },
        );
        raw.push(...fallback.flat());
        source = 'Careers RSS search';
      }
    }
    if (!raw.length) {
      const linked =
        page.text.match(
          /https:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com|careers\.smartrecruiters\.com)\/[a-z\d_-]+/i,
        ) ||
        page.text.match(
          /https:\/\/[a-z\d-]+\.wd\d+\.myworkdayjobs\.com\/(?:en-US\/)?[a-z\d_-]+/i,
        ) ||
        page.text.match(
          /https:\/\/[a-z\d.-]+\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/[a-z\d_-]+/i,
        );
      if (depth < 2 && linked && linked[0] !== career.toString())
        return readCompanyFeed({ ...company, careers: linked[0] }, depth + 1);
    }
    if (!raw.length) {
      // Follow actual job-detail links published by the employer; never infer a job from a search snippet.
      const links = [
        ...page.text.matchAll(
          /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        ),
      ].flatMap(([, href, title]) => {
        try {
          const u = new URL(decodeLink(href), page.url);
          return u.origin === new URL(page.url).origin &&
            /\/jobs?\/|JobDetails/i.test(u.toString()) &&
            jobCategory(plain(title))
            ? [u.toString()]
            : [];
        } catch {
          return [];
        }
      });
      const unique = [...new Set(links)].slice(0, 30);
      raw.push(
        ...(
          await inBatches(unique, async (url) => {
            try {
              return jsonLdJobs((await sourceText(url)).text, url);
            } catch {
              return [];
            }
          })
        ).flat(),
      );
      complete = false;
    }
    if (!raw.length)
      return {
        status: 'unsupported',
        message:
          'This careers page needs a company-specific job connector; no jobs were imported from it.',
        jobs: [],
        complete: false,
      };
  }
  const unique = new Map();
  for (const item of raw) {
    const job = cleanJob(item, company);
    if (job) unique.set(job.sourceId, job);
  }
  const jobs = [...unique.values()]
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
    .slice(0, 300);
  return {
    status: 'checked',
    message: `Checked ${source}.`,
    jobs,
    complete: complete && raw.length <= 300,
  };
}

const eliteSourceId = 'source:elite-technical';
const aggregateJobSourceId = 'source:career-vendors';
const jobSourceIds = [
  eliteSourceId,
  'source:vaco',
  'source:apex-systems',
  'source:motion-recruitment',
  'source:inspyr-solutions',
  'source:remotive',
  'source:remoteok',
  'source:themuse',
  'source:arbeitnow',
  'source:weworkremotely',
  'source:jobicy',
  'source:himalayas',
].map((id) => `us:${id}`);
function vendorCategory(title, description = '') {
  const category = jobCategory(title, description);
  if (category) return category;
  if (
    /\banalyst\b/i.test(title) &&
    !/\b(?:quality assurance|qa|financial|finance|accounting|budget|credit|risk|security operations|soc analyst)\b/i.test(
      title,
    )
  )
    return 'data';
  if (
    /\b(?:business systems?|systems?|compensation|operations|reporting|process|support|application|product|data|business intelligence|bi)\s+analyst\b/i.test(
      title,
    )
  )
    return 'data';
  if (
    /\b(?:data engineering|data warehouse|etl|reporting|business intelligence|analytics)\b/i.test(
      title,
    )
  )
    return 'data';
  if (
    /\bsoftware engineering\b/i.test(title) &&
    !/manager|director/i.test(title)
  )
    return 'java';
  if (
    /\b(?:servicenow|as400|bmc helix|ai\/ml|application|web|software|full stack|backend|frontend|front end|back end|java)\s+(?:developer|engineer)\b/i.test(
      title,
    )
  )
    return 'java';
  return '';
}
function cleanVendorJob(raw, source) {
  const title = plain(raw.title).slice(0, 200),
    category = vendorCategory(title, raw.description);
  const apply = safeJobUrl(raw.url);
  if (!title || !category || !apply || !usLocation(raw.location)) return null;
  const years = yearsFromDescription(raw.description || '');
  return {
    sourceId: String(raw.id || apply.toString()).slice(0, 500),
    companyName:
      plain(raw.companyName || source.name).slice(0, 200) || source.name,
    title,
    category,
    applyUrl: apply.toString(),
    postedAt: dateValue(raw.postedAt).slice(0, 10),
    minYears: years.min,
    maxYears: years.max,
  };
}
function uniqueJobs(raw, source) {
  const unique = new Map();
  for (const item of raw) {
    const job = cleanVendorJob(item, source);
    if (job) unique.set(job.sourceId, job);
  }
  return [...unique.values()]
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
    .slice(0, 300);
}
function eliteRows(html) {
  const rows = new Map();
  for (const match of html.matchAll(
    /<div class="jobbox">([\s\S]*?)<div class="jobbody">([\s\S]*?)<\/div>/gi,
  )) {
    const anchor = match[1].match(
        /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
      ),
      date = match[1].match(/Date Posted:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (!anchor || !date)
      throw Error(
        'Elite Technical changed its listing format; previous jobs were preserved.',
      );
    const url = new URL(
        anchor[1].replace(/&amp;/g, '&'),
        'https://www.elitetechnicaljobs.com',
      ),
      id = url.searchParams.get('id');
    if (
      url.hostname !== 'www.elitetechnicaljobs.com' ||
      !/^\d+$/.test(id || '')
    )
      continue;
    rows.set(id, {
      sourceId: id,
      title: plain(anchor[2]),
      description: plain(match[2]),
      applyUrl: `https://www.elitetechnicaljobs.com/job/?id=${id}`,
      postedAt: `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}`,
    });
  }
  if (!rows.size)
    throw Error(
      'Elite Technical returned no readable listings; previous jobs were preserved.',
    );
  return [...rows.values()];
}
function eliteCategory(title, description) {
  return vendorCategory(title, description);
}
async function readEliteFeed() {
  const { text } = await sourceText(
    'https://www.elitetechnicaljobs.com/?jobtext=&jobstate=',
  );
  const rows = eliteRows(text),
    candidates = rows.filter((row) =>
      eliteCategory(row.title, row.description),
    );
  const source = { id: eliteSourceId, name: 'Elite Technical' };
  const enriched = [];
  for (let offset = 0; offset < candidates.length; offset += 5) {
    enriched.push(
      ...(await Promise.all(
        candidates.slice(offset, offset + 5).map(async (row) => {
          let description = row.description;
          try {
            const detail = await sourceText(row.applyUrl);
            const data = jsonLdJobs(detail.text, row.applyUrl);
            description = data[0]?.description || description;
            row.location = data[0]?.location || '';
          } catch {}
          return {
            id: row.sourceId,
            title: row.title,
            url: row.applyUrl,
            postedAt: row.postedAt,
            description,
            location: row.location || '',
          };
        }),
      )),
    );
  }
  const jobs = uniqueJobs(enriched, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked ${rows.length} Elite Technical listings; ${jobs.length} match the technology tabs.`,
    jobs,
    complete: true,
  };
}
function tableRows(html, baseUrl, source, options = {}) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1],
      link = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => plain(cell[1]),
    );
    const posted = (row.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) || [])[1] || '';
    rows.push({
      id: new URL(decodeLink(link[1]), baseUrl).toString(),
      title: plain(link[2]),
      url: new URL(decodeLink(link[1]), baseUrl).toString(),
      postedAt: posted,
      description: cells.join(' '),
      location: cells.find((cell) => usLocation(cell)) || '',
    });
  }
  return uniqueJobs(rows, source);
}
async function readVacoFeed() {
  const source = { id: 'source:vaco', name: 'Vaco' },
    raw = [];
  for (let page = 1; page <= 3; page++) {
    const url = `https://jobs.vaco.com/api/requisitions/search${page > 1 ? `?page=${page}` : ''}`;
    raw.push(
      ...tableRows(
        (await sourceText(url)).text,
        'https://jobs.vaco.com',
        source,
      ),
    );
  }
  return {
    ...source,
    status: 'checked',
    message: `Checked Vaco jobs.`,
    jobs: raw,
    complete: false,
  };
}
async function readApexFeed() {
  const source = { id: 'source:apex-systems', name: 'Apex Systems' };
  const url =
    'https://www.apexsystems.com/search-results-crp?catalogcode=CRP&address=&radius=50&page=1&rows=100&query=%2A&remote=&sort=lastposteddesc';
  const jobs = tableRows(
    (await sourceText(url)).text,
    'https://www.apexsystems.com',
    source,
  );
  return {
    ...source,
    status: 'checked',
    message: `Checked Apex Systems jobs.`,
    jobs,
    complete: false,
  };
}
function linkJobs(html, baseUrl, source, pattern) {
  const raw = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = new URL(decodeLink(href), baseUrl).toString();
    if (!pattern.test(new URL(url).pathname)) continue;
    const title = plain(match[2]);
    if (!title || title.length < 4) continue;
    raw.push({
      id: url,
      title,
      url,
      postedAt: '',
      description: title,
      location: '',
    });
  }
  return uniqueJobs(raw, source);
}
async function readMotionFeed() {
  const source = {
    id: 'source:motion-recruitment',
    name: 'Motion Recruitment',
  };
  const jobs = linkJobs(
    (await sourceText('https://motionrecruitment.com/tech-jobs')).text,
    'https://motionrecruitment.com',
    source,
    /^\/tech-jobs\/[^/]+\/(?:contract|direct-hire)\//,
  );
  return {
    ...source,
    status: 'checked',
    message: `Checked Motion Recruitment jobs.`,
    jobs,
    complete: false,
  };
}
async function readInspyrFeed() {
  const source = { id: 'source:inspyr-solutions', name: 'INSPYR Solutions' };
  const jobs = linkJobs(
    (await sourceText('https://www.inspyrsolutions.com/job-search/')).text,
    'https://www.inspyrsolutions.com',
    source,
    /^\/job\/\d{2}-/,
  );
  return {
    ...source,
    status: 'checked',
    message: `Checked INSPYR Solutions jobs.`,
    jobs,
    complete: false,
  };
}

function epochDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  const millis = number > 100000000000 ? number : number * 1000;
  const d = new Date(millis);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}
async function readRemotiveFeed() {
  const source = { id: 'source:remotive', name: 'Remotive' };
  const data = JSON.parse(
    (await sourceText('https://remotive.com/api/remote-jobs')).text,
  );
  const raw = (data.jobs || []).map((job) => ({
    id: job.id,
    title: job.title,
    companyName: job.company_name,
    url: job.url,
    postedAt: job.publication_date,
    description: [
      job.description,
      (job.tags || []).join(' '),
      job.candidate_required_location,
    ]
      .filter(Boolean)
      .join(' '),
    location: job.candidate_required_location || '',
  }));
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked Remotive remote jobs.`,
    jobs,
    complete: true,
  };
}
async function readRemoteOkFeed() {
  const source = { id: 'source:remoteok', name: 'Remote OK' };
  const data = JSON.parse((await sourceText('https://remoteok.com/api')).text);
  const raw = (Array.isArray(data) ? data : [])
    .filter((job) => job && job.id)
    .map((job) => ({
      id: job.id,
      title: job.position,
      companyName: job.company,
      url: job.url || job.apply_url,
      postedAt: job.date || epochDate(job.epoch),
      description: [job.description, (job.tags || []).join(' '), job.location]
        .filter(Boolean)
        .join(' '),
      location: job.location || '',
    }));
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked Remote OK jobs.`,
    jobs,
    complete: true,
  };
}
async function readMuseFeed() {
  const source = { id: 'source:themuse', name: 'The Muse' },
    raw = [];
  const categories = [
    'Software Engineering',
    'Data and Analytics',
    'Computer and IT',
  ];
  for (const categoryName of categories) {
    const pages = categoryName === 'Software Engineering' ? 4 : 3;
    for (let page = 1; page <= pages; page++) {
      const url = `https://www.themuse.com/api/public/jobs?page=${page}&category=${encodeURIComponent(categoryName)}`;
      const data = JSON.parse((await sourceText(url)).text);
      raw.push(
        ...(data.results || []).map((job) => ({
          id: job.id,
          title: job.name,
          companyName: job.company?.name,
          url: job.refs?.landing_page,
          postedAt: job.publication_date,
          description: [
            job.contents,
            (job.categories || []).map((x) => x.name).join(' '),
            (job.locations || []).map((x) => x.name).join(' '),
          ]
            .filter(Boolean)
            .join(' '),
          location: (job.locations || []).map((x) => x.name).join(', '),
        })),
      );
      if (page >= Number(data.page_count || page)) break;
    }
  }
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked The Muse public jobs.`,
    jobs,
    complete: false,
  };
}
async function readArbeitnowFeed() {
  const source = { id: 'source:arbeitnow', name: 'Arbeitnow' };
  const data = JSON.parse(
    (await sourceText('https://www.arbeitnow.com/api/job-board-api')).text,
  );
  const raw = (data.data || []).map((job) => ({
    id: job.slug,
    title: job.title,
    companyName: job.company_name,
    url: job.url,
    postedAt: epochDate(job.created_at),
    description: [
      job.description,
      (job.tags || []).join(' '),
      job.location,
      job.remote ? 'remote' : '',
    ]
      .filter(Boolean)
      .join(' '),
    location: job.location || '',
  }));
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked Arbeitnow jobs.`,
    jobs,
    complete: false,
  };
}
async function readWeWorkRemotelyFeed() {
  const source = { id: 'source:weworkremotely', name: 'We Work Remotely' },
    raw = [];
  const feeds = [
    'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
  ];
  for (const feed of feeds) {
    const items = rssJobs((await sourceText(feed)).text);
    raw.push(
      ...items.map((job) => {
        const parts = job.title.split(/:\s+/),
          companyName = parts.length > 1 ? parts.shift() : '';
        return {
          ...job,
          companyName,
          title: parts.join(': ') || job.title,
          url: job.url,
          description: [job.description, 'remote', companyName].join(' '),
          location: job.location || '',
        };
      }),
    );
  }
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked We Work Remotely feeds.`,
    jobs,
    complete: true,
  };
}

async function readJobicyFeed() {
  const source = { id: 'source:jobicy', name: 'Jobicy' },
    raw = [];
  for (const tag of ['developer', 'data', 'devops']) {
    const data = JSON.parse(
      (
        await sourceText(
          `https://jobicy.com/api/v2/remote-jobs?count=100&tag=${encodeURIComponent(tag)}`,
        )
      ).text,
    );
    raw.push(
      ...(data.jobs || []).map((job) => ({
        id: job.id,
        title: job.jobTitle,
        companyName: job.companyName,
        url: job.url,
        postedAt: job.pubDate,
        description: [
          job.jobDescription,
          (job.jobIndustry || []).join(' '),
          (job.jobType || []).join(' '),
          job.jobGeo,
          tag,
        ]
          .filter(Boolean)
          .join(' '),
        location: job.jobGeo || '',
      })),
    );
  }
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked Jobicy remote jobs.`,
    jobs,
    complete: false,
  };
}
async function readHimalayasFeed() {
  const source = { id: 'source:himalayas', name: 'Himalayas' };
  const data = JSON.parse(
    (await sourceText('https://himalayas.app/jobs/api?limit=100')).text,
  );
  const raw = (data.jobs || []).map((job) => ({
    id: job.guid || job.applicationLink,
    title: job.title,
    companyName: job.companyName,
    url: job.applicationLink || job.guid,
    postedAt: epochDate(job.pubDate),
    description: [
      job.description,
      (job.categories || []).join(' '),
      (job.parentCategories || []).join(' '),
      (job.locationRestrictions || []).join(' '),
    ]
      .filter(Boolean)
      .join(' '),
    location: (job.locationRestrictions || []).join(', '),
  }));
  const jobs = uniqueJobs(raw, source);
  return {
    ...source,
    status: 'checked',
    message: `Checked Himalayas remote jobs.`,
    jobs,
    complete: false,
  };
}

async function readVendorFeeds() {
  const readers = [
    readEliteFeed,
    readVacoFeed,
    readApexFeed,
    readMotionFeed,
    readInspyrFeed,
    readRemotiveFeed,
    readRemoteOkFeed,
    readMuseFeed,
    readArbeitnowFeed,
    readWeWorkRemotelyFeed,
    readJobicyFeed,
    readHimalayasFeed,
  ];
  return inBatches(
    readers.map((reader, index) => ({ reader, index })),
    async ({ reader, index }) => {
      try {
        return await reader();
      } catch (error) {
        return {
          id: 'source:error-' + index,
          name: 'Job source',
          status: 'error',
          message: String(error.message).slice(0, 160),
          jobs: [],
        };
      }
    },
    3,
  );
}
function employerSourceId(id) {
  return `employer:${id}`;
}
async function readDirectoryFeeds(env) {
  const added = (
    await db(env)
      .prepare(
        "SELECT id,name,careers FROM added_companies WHERE careers <> ''",
      )
      .all()
  ).results;
  const candidates = new Map();
  for (const [id, , careers] of baseRows)
    if (safeJobUrl(officialJobBoards[id] || careers))
      candidates.set(id, { id, name: id, careers });
  for (const company of added)
    if (safeJobUrl(officialJobBoards[company.id] || company.careers))
      candidates.set(company.id, company);
  const checks = new Map(
    (
      await db(env)
        .prepare(
          "SELECT company_id,checked_at FROM job_source_checks WHERE company_id LIKE 'employer:%'",
        )
        .all()
    ).results.map((row) => [row.company_id, row.checked_at]),
  );
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  const boardPriority = (company) => {
    const url = officialJobBoards[company.id] || company.careers;
    if (/greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com/i.test(url))
      return 2;
    if (/\.myworkdayjobs\.com|\.oraclecloud\.com/i.test(url)) return 1;
    return 0;
  };
  const due = [...candidates.values()]
    .filter(
      (company) => (checks.get(employerSourceId(company.id)) || '') < cutoff,
    )
    .sort(
      (a, b) =>
        (checks.get(employerSourceId(a.id)) || '').localeCompare(
          checks.get(employerSourceId(b.id)) || '',
        ) || boardPriority(b) - boardPriority(a),
    )
    .slice(0, 6);
  return Promise.all(
    due.map(async (company) => {
      const id = employerSourceId(company.id);
      let result;
      try {
        result = await readCompanyFeed(company);
      } catch (error) {
        result = {
          status: 'error',
          message: String(error.message).slice(0, 160),
          jobs: [],
          complete: false,
        };
      }
      return {
        ...result,
        id,
        name: company.name || company.id,
        jobs: result.jobs.map((job) => ({
          ...job,
          companyName: company.name || company.id,
        })),
      };
    }),
  );
}
async function refreshElite(env) {
  const database = db(env),
    now = new Date().toISOString(),
    lockCutoff = new Date(Date.now() - 180000).toISOString();
  const lock = await database
    .prepare(
      "INSERT INTO job_source_checks (company_id,checked_at,status,message,jobs_found) VALUES (?,?,'refreshing','Refreshing…',0) ON CONFLICT(company_id) DO UPDATE SET checked_at=excluded.checked_at,status='refreshing',message='Refreshing…' WHERE job_source_checks.checked_at < ? RETURNING company_id",
    )
    .bind(aggregateJobSourceId, now, lockCutoff)
    .first();
  if (!lock) return { status: 'cached', message: 'Refreshing…' };
  try {
    const [vendorSources, employerSources] = await Promise.all([
        readVendorFeeds(),
        readDirectoryFeeds(env),
      ]),
      sources = [
        ...vendorSources.map((source) => ({
          ...source,
          id: `us:${source.id}`,
        })),
        ...employerSources,
      ],
      successful = sources.filter((source) => source.status === 'checked'),
      jobs = successful.flatMap((source) =>
        source.jobs.map((job) => ({
          ...job,
          sourceId: job.sourceId,
          sourceKey: source.id,
          companyName: job.companyName || source.name,
        })),
      );
    if (!successful.length)
      throw Error(
        sources
          .map((source) => source.message)
          .filter(Boolean)
          .join('; ') || 'No job sources were available.',
      );
    for (let i = 0; i < jobs.length; i += 8) {
      const values = [],
        rows = jobs.slice(i, i + 8).map((job) => {
          values.push(
            crypto.randomUUID(),
            job.sourceKey,
            job.companyName,
            job.category,
            job.title,
            job.applyUrl,
            job.sourceId,
            job.postedAt,
            now,
            now,
            job.minYears,
            job.maxYears,
          );
          return '(?,?,?,?,?,?,?,?,?,?,1,?,?)';
        });
      await database
        .prepare(
          `INSERT INTO imported_jobs (id,company_id,company_name,category,title,apply_url,source_id,posted_at,discovered_at,last_seen_at,is_open,min_years,max_years) VALUES ${rows.join(',')} ON CONFLICT(company_id,source_id) DO UPDATE SET company_name=excluded.company_name,category=excluded.category,title=excluded.title,apply_url=excluded.apply_url,posted_at=excluded.posted_at,last_seen_at=excluded.last_seen_at,is_open=1,min_years=excluded.min_years,max_years=excluded.max_years`,
        )
        .bind(...values)
        .run();
    }
    for (const source of successful.filter((source) => source.complete))
      await database
        .prepare(
          'UPDATE imported_jobs SET is_open=0 WHERE company_id=? AND last_seen_at < ?',
        )
        .bind(source.id, now)
        .run();
    for (const source of employerSources)
      await database
        .prepare(
          'INSERT INTO job_source_checks (company_id,checked_at,status,message,jobs_found) VALUES (?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,message=excluded.message,jobs_found=excluded.jobs_found',
        )
        .bind(source.id, now, source.status, source.message, source.jobs.length)
        .run();
    const message = `Loaded ${jobs.length} jobs from ${successful.length} sources.`;
    await database
      .prepare(
        "UPDATE job_source_checks SET status='checked',message=?,jobs_found=? WHERE company_id=?",
      )
      .bind(message, jobs.length, aggregateJobSourceId)
      .run();
    return {
      status: 'checked',
      message,
      jobsFound: jobs.length,
      checkedAt: now,
      sources: sources.map((source) => ({
        name: source.name,
        status: source.status,
        jobsFound: source.jobs.length,
        message: source.message,
      })),
    };
  } catch (error) {
    await database
      .prepare(
        "UPDATE job_source_checks SET status='error',message=? WHERE company_id=?",
      )
      .bind(String(error.message).slice(0, 240), aggregateJobSourceId)
      .run();
    throw error;
  }
}
