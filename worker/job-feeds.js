const usStates=/\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
function safeJobUrl(value){
 try{const url=new URL(value);const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||!host.includes('.')||/^\d+(?:\.\d+){3}$/.test(host)||host.includes(':'))return null;return url;}catch{return null;}
}
async function sourceText(value){
 let url=safeJobUrl(value);if(!url)throw Error('Career link is not a public HTTPS URL.');
 for(let redirects=0;redirects<3;redirects++){
  const response=await fetch(url.toString(),{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html, application/json, application/rss+xml, application/xml;q=0.9'}});
  if(response.status>=300&&response.status<400){url=safeJobUrl(new URL(response.headers.get('location')||'',url).toString());if(!url)throw Error('Career site redirected to an unsupported address.');continue;}
  if(!response.ok)throw Error(`Career site returned ${response.status}.`);
  if(Number(response.headers.get('content-length')||0)>6000000)throw Error('Career feed is too large.');
  const reader=response.body?.getReader();if(!reader)throw Error('Career feed is empty.');
  const chunks=[];let size=0;
  while(true){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.byteLength;if(size>6000000){await reader.cancel();throw Error('Career feed is too large.');}chunks.push(chunk);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return {text:new TextDecoder().decode(bytes),url:url.toString()};
 }
 throw Error('Career site redirected too many times.');
}
function plain(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp|quot|lt|gt|#39);/g,c=>({'&amp;':'&','&nbsp;':' ','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[c]||c)).replace(/\s+/g,' ').trim();}
function dateValue(value){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())&&d.getTime()<Date.now()+86400000?d.toISOString():'';}
function jobCategory(title,description=''){
 const t=plain(title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),d=plain(description).toLowerCase();
 if(/\b(manager|director|recruiter|sales|accountant|mechanical|electrical|manufacturing|process|hardware|product validation)\b/.test(t))return '';
 if(/\b(computer systems? validation|computerized systems? validation|csv engineer|csv consultant|csv specialist|software validation)\b/.test(t))return 'validation';
 if(/\bvalidation engineer\b/.test(t)&&/\b(computerized|computer systems|software|gxp|csv|pharmaceutical systems)\b/.test(d))return 'validation';
 if(/\b(devops|site reliability|\bsre\b|cloud platform|platform engineer|build and release|release engineer|cloud infrastructure|infrastructure engineer)\b/.test(t))return 'devops';
 if(/\b(data analyst|data engineer|big data|analytics engineer|business data analyst|bi data analyst|data platform engineer|data scientist)\b/.test(t))return 'data';
 if(/\b(software engineer|software developer|software development engineer|java developer|java engineer|java software engineer|backend developer|backend engineer|back end developer|back end engineer|full stack developer|full stack engineer|application developer|application engineer|web developer|web engineer|java full stack|fullstack developer|fullstack engineer|frontend developer|frontend engineer|front end developer|front end engineer|python developer|net developer|mobile developer|android developer|ios developer)\b/.test(t))return 'java';
 if(/\bprogrammer analyst\b/.test(t)&&/\b(software|java|application development|coding|programming)\b/.test(d))return 'java';
 return '';
}
function usLocation(value,sourceUrl=''){
 const location=plain(value),source=String(sourceUrl);
 if(/^US$/i.test(location))return true;
 if(/^(?:IN|MX|GB|UK|AU|DE|FR|PL|RO|SG|CA)$/i.test(location))return false;
 if(/\b(United States|USA|US)\b|U\.S\./i.test(location))return true;
 if(/\b(Canada|India|United Kingdom|Australia|Germany|Poland|Romania|France|Singapore|Mexico)\b/i.test(location))return false;
 if(usStates.test(location))return true;
 return /\/us-en\/|\/us\/|united.states|\/usa\//i.test(source)&&(!location||/^remote$/i.test(location));
}
function yearsFromDescription(description){
 const text=plain(description).slice(0,12000);
 const range=text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:\+\s*)?years?\b/i);
 if(range)return {min:Number(range[1]),max:Number(range[2])};
 const minimum=text.match(/\b(?:minimum|min\.?|at least|requires?|experience of)\s*(\d{1,2})\s*\+?\s*years?\b/i)||text.match(/\b(\d{1,2})\s*\+\s*years?\b/i);
 return minimum?{min:Number(minimum[1]),max:null}:{min:null,max:null};
}
function cleanJob(raw,company){
 const title=plain(raw.title).slice(0,200),category=jobCategory(title,raw.description);
 const apply=safeJobUrl(raw.url);if(!title||!category||!apply||!usLocation(raw.location,company.careers))return null;
 const years=yearsFromDescription(raw.description);
 return {sourceId:String(raw.id||apply.toString()).slice(0,500),title,category,applyUrl:apply.toString(),postedAt:dateValue(raw.postedAt),minYears:years.min,maxYears:years.max};
}
function jsonLdJobs(html,pageUrl){
 const found=[];
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const data=JSON.parse(match[1]);const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=='object')return;if(String(value['@type']||'').toLowerCase()==='jobposting'){
   const address=value.jobLocation?.address||value.jobLocation?.[0]?.address||{};
   const location=[address.addressLocality,address.addressRegion,address.addressCountry,value.applicantLocationRequirements?.name].filter(Boolean).join(', ');
   found.push({id:value.identifier?.value||value.identifier||value.url||pageUrl,title:value.title,url:value.url||pageUrl,postedAt:value.datePosted||'',location,description:value.description||''});
  }if(value['@graph'])walk(value['@graph']);if(value.mainEntity)walk(value.mainEntity);};walk(data);}catch{}
 }
 return found;
}
function xmlValue(item,tag){return plain(item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g,'')||'');}
function rssJobs(xml){return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([,item])=>{const title=xmlValue(item,'title'),trailing=title.match(/\(([^()]{2,70})\)$/);return {id:xmlValue(item,'guid')||xmlValue(item,'link'),title:trailing?title.slice(0,trailing.index).trim():title,url:xmlValue(item,'link'),postedAt:xmlValue(item,'pubDate'),description:xmlValue(item,'description'),location:xmlValue(item,'location')||trailing?.[1]||''};});}
// Official recruiting boards verified against the employers' public career pages.
// Keyed by stable directory IDs, never fuzzy employer names.
const officialJobBoards={
 'Endava Solutions, LLC':'https://careers.smartrecruiters.com/Endava',
 'NAGARRO, INC':'https://careers.smartrecruiters.com/Nagarro1',
 'Brillio, LLC':'https://jobs.lever.co/brillio-2',
 'Rackspace US, Inc.':'https://jobs.lever.co/rackspace',
 'Egen Solutions LLC':'https://jobs.lever.co/egen',
 'ATOS SYNTEL INC':'https://jobs.atos.net/',
 'Ernst & Young U.S. LLP':'https://careers.ey.com/',
 'Yash Technologies, Inc':'https://careers.yash.com/',
 'Insight Direct USA, Inc.':'https://jobsearch.insight.com/'
};
async function readCompanyFeed(company){
 const career=safeJobUrl(officialJobBoards[company.id]||company.careers);if(!career)return {status:'unsupported',message:'No usable official careers link.',jobs:[],complete:false};
 let raw=[],source='careers page',complete=false;
 const host=career.hostname.toLowerCase(),segments=career.pathname.split('/').filter(Boolean);
 if(host==='careers.smartrecruiters.com'||host==='jobs.smartrecruiters.com'){
  const board=segments[0];if(!board)throw Error('Recruiting board name is missing.');
  let exhausted=false,detailFailed=false;
  for(let offset=0;offset<500;offset+=100){
   const data=JSON.parse((await sourceText(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?limit=100&offset=${offset}&country=us`)).text);
   const postings=(data.content||[]).filter(job=>job.location?.country?.toLowerCase()==='us'&&job.visibility!=='INTERNAL');
   for(let i=0;i<postings.length;i+=5)await Promise.all(postings.slice(i,i+5).map(async job=>{
    // Details supply the real apply URL and experience requirements.
    try{const detail=JSON.parse((await sourceText(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings/${encodeURIComponent(job.id)}`)).text);
     if(detail.active===false||detail.visibility==='INTERNAL')return;
     raw.push({id:job.id,title:detail.name,url:detail.postingUrl||detail.applyUrl,location:'United States',postedAt:detail.releasedDate,description:Object.values(detail.jobAd?.sections||{}).map(x=>x.text||'').join(' ')});
    }catch{detailFailed=true;}
   }));
   if(offset+(data.content||[]).length>=data.totalFound||(data.content||[]).length<100){exhausted=true;break;}
  }
  source='SmartRecruiters';complete=exhausted&&!detailFailed;
 }else if(host==='boards.greenhouse.io'||host==='job-boards.greenhouse.io'){
  const board=segments[0]==='embed'?career.searchParams.get('for'):segments[0];if(!board)return {status:'unsupported',message:'Greenhouse board name is missing.',jobs:[],complete:false};
  const data=JSON.parse((await sourceText(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`)).text);
  raw=(data.jobs||[]).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).map(job=>({id:job.id,title:job.title,url:job.absolute_url,location:job.location?.name||'',description:'',postedAt:''}));
  const recent=raw.filter(job=>jobCategory(job.title)&&usLocation(job.location,company.careers)).slice(0,30);
  for(let index=0;index<recent.length;index+=5)await Promise.all(recent.slice(index,index+5).map(async job=>{try{const detail=JSON.parse((await sourceText(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(job.id)}`)).text);job.postedAt=detail.first_published||'';job.description=detail.content||'';}catch{}}));
  source='Greenhouse';complete=true;
 }else if(host==='jobs.lever.co'||host==='jobs.eu.lever.co'){
  const board=segments[0];if(!board)return {status:'unsupported',message:'Lever board name is missing.',jobs:[],complete:false};
  const apiHost=host==='jobs.eu.lever.co'?'api.eu.lever.co':'api.lever.co';
  const data=JSON.parse((await sourceText(`https://${apiHost}/v0/postings/${encodeURIComponent(board)}?mode=json`)).text);
  raw=(Array.isArray(data)?data:[]).map(job=>({id:job.id,title:job.text,url:job.hostedUrl||job.applyUrl,location:job.categories?.location||'',description:[job.descriptionPlain||job.description||'',...(job.lists||[]).map(x=>x.content||'')].join(' '),postedAt:job.createdAt||''}));
  source='Lever';complete=true;
 }else if(host==='jobs.ashbyhq.com'){
  const board=segments[0];if(!board)return {status:'unsupported',message:'Ashby board name is missing.',jobs:[],complete:false};
  const data=JSON.parse((await sourceText(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`)).text);
  raw=(data.jobs||[]).filter(job=>job.isListed!==false).map(job=>({id:job.id||job.jobUrl,title:job.title,url:job.applyUrl||job.jobUrl,location:[job.location,job.address?.postalAddress?.addressCountry,...(job.secondaryLocations||[]).flatMap(x=>[x.location,x.address?.addressCountry])].filter(Boolean).join(', '),description:job.descriptionPlain||'',postedAt:job.publishedAt||''}));
  source='Ashby';complete=true;
 }else{
  const page=await sourceText(career.toString());raw=jsonLdJobs(page.text,page.url);
  const feed=page.text.match(/<link\b[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)/i)||page.text.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i);
  if(feed){const rssUrl=safeJobUrl(new URL(feed[1].replace(/&amp;/g,'&'),page.url).toString());if(rssUrl&&rssUrl.hostname===new URL(page.url).hostname){const rss=await sourceText(rssUrl.toString());raw.push(...rssJobs(rss.text));source='Careers RSS';complete=true;}}
  if(page.text.includes('BS3ColumnizedSearch')||page.text.includes('/services/rss/job/')){
   const terms=['software','java','data','devops','validation'];
   const searches=await Promise.all(terms.map(async term=>{try{const query=`(${term}) AND locationSearch:(United States)`;const feedUrl=`${new URL(page.url).origin}/services/rss/job/?locale=en_US&keywords=${encodeURIComponent(query)}`;return rssJobs((await sourceText(feedUrl)).text);}catch{return [];}}));
   raw.push(...searches.flat());source='Careers RSS search';complete=false;
  }
  if(!raw.length){
   const linked=page.text.match(/https:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com|careers\.smartrecruiters\.com)\/[a-z\d_-]+/i);
   if(linked&&linked[0]!==career.toString())return readCompanyFeed({...company,careers:linked[0]});
  }
  if(!raw.length)return {status:'unsupported',message:'This careers page needs a company-specific job connector; no jobs were imported from it.',jobs:[],complete:false};
 }
 const unique=new Map();for(const item of raw){const job=cleanJob(item,company);if(job)unique.set(job.sourceId,job);}
 const jobs=[...unique.values()].sort((a,b)=>(b.postedAt||'').localeCompare(a.postedAt||'')).slice(0,300);
 return {status:'checked',message:`Checked ${source}.`,jobs,complete:complete&&raw.length<=300};
}
