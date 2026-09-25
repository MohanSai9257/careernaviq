import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
const root=new URL('..',import.meta.url).pathname;
const sqlite=new DatabaseSync(':memory:');
for(const name of readdirSync(root+'/drizzle').filter(x=>/^\d+.*\.sql$/.test(x)).sort())sqlite.exec(readFileSync(root+'/drizzle/'+name,'utf8').replaceAll('--> statement-breakpoint',''));
const DB={prepare(sql){let args=[];return {bind(...v){if(v.length>100)throw Error('D1 parameter limit exceeded');args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}};
sqlite.prepare('INSERT INTO access_sessions VALUES (?,?,?,?)').run('admin','chatgpt3577@gmail.com','admin','now');
sqlite.prepare('INSERT INTO added_companies (id,normalized_name,name,careers,category) VALUES (?,?,?,?,?)').run('test-board','test board','Test Board','https://boards.greenhouse.io/testboard','implementation');
const realFetch=globalThis.fetch;
const recentDate=new Date(Date.now()-3600000).toISOString();
const previousDate=new Date(Date.now()-2*86400000).toISOString();
globalThis.fetch=async (input,options)=>{
 const url=String(input);
 if(url==='https://boards-api.greenhouse.io/v1/boards/testboard/jobs')return Response.json({jobs:[
  {id:101,title:'Senior Java Software Engineer',absolute_url:'https://boards.greenhouse.io/testboard/jobs/101',updated_at:'2026-09-24T15:00:00Z',location:{name:'Austin, TX'}},
  {id:102,title:'Mechanical Validation Engineer',absolute_url:'https://boards.greenhouse.io/testboard/jobs/102',updated_at:'2026-09-24T12:00:00Z',location:{name:'Austin, TX'}},
  {id:103,title:'Data Engineer',absolute_url:'https://boards.greenhouse.io/testboard/jobs/103',updated_at:'2026-09-24T11:00:00Z',location:{name:'Boston, MA'}}]});
 if(url.endsWith('/jobs/101'))return Response.json({first_published:recentDate,content:'5+ years of software development'});
 if(url.endsWith('/jobs/103'))return Response.json({first_published:previousDate,content:'3+ years of data engineering'});
 return realFetch(input,options);
};
async function call(path,body){const r=await worker.fetch(new Request('https://directory.test'+path,{method:'POST',headers:{Cookie:'directory_session=admin',Origin:'https://directory.test','Content-Type':'application/json'},body:JSON.stringify(body)}),{DB});return {status:r.status,body:await r.json()};}
let r=await call('/api/jobs/generate',{companyId:'test-board'});if(r.status!==200||r.body.jobsFound!==2)throw Error(JSON.stringify(r));
r=await call('/api/jobs/generate',{companyId:'test-board'});if(r.status!==200||sqlite.prepare('SELECT count(*) n FROM imported_jobs').get().n!==2)throw Error('duplicate jobs');
r=await call('/api/jobs/query',{companyIds:['test-board'],category:'java',window:'all',search:'',minYears:null,maxYears:null});if(r.body.items.length!==1||r.body.items[0].title!=='Senior Java Software Engineer')throw Error(JSON.stringify(r));
r=await call('/api/jobs/query',{companyIds:['test-board'],category:'java',window:'day',search:'',minYears:null,maxYears:4});if(r.body.items.length!==0)throw Error('experience filter failed');
r=await call('/api/jobs/query',{companyIds:['test-board'],category:'data',window:'all',search:'',minYears:3,maxYears:4});if(r.body.items.length!==1)throw Error('data filter failed');
console.log('PASS: official board import, unrelated title excluded, duplicate prevention, date/category/experience query.');

const pageIds=['test-board',...Array.from({length:99},(_,i)=>'company-'+i)];
r=await call('/api/jobs/query',{companyIds:pageIds,category:'java',window:'month',search:'Software',minYears:3,maxYears:8});
if(r.status!==200||r.body.items?.length!==1)throw Error('Full 100-company page with all filters failed: '+JSON.stringify(r));
r=await call('/api/jobs/query',{companyIds:pageIds,category:'java',window:'all',search:'a'.repeat(100)});
if(r.status!==200||r.body.items?.length!==0)throw Error('Long literal search failed');
console.log('PASS: 100-company page with all filters fits the D1 parameter limit; long literal search supported.');
