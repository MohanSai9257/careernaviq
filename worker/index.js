const baseRows=JSON.parse(ASSETS['/companies.json']);
const known=new Map(baseRows.map(r=>[r[0],r]));
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function db(env){if(!env.DB)throw Error('Database unavailable');return env.DB;}
function link(value){if(typeof value!=='string'||value.length>2048)return false;if(!value)return true;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export default {async fetch(request,env){
 const url=new URL(request.url);
 try{
  if(url.pathname==='/api/changes'&&request.method==='GET'){
   const after=url.searchParams.get('after')||'';
   const {results}=await db(env).prepare('SELECT id,payload,version FROM company_edits WHERE id > ? ORDER BY id LIMIT 500').bind(after).all();
   return json({items:results.map(r=>({id:r.id,...JSON.parse(r.payload),version:r.version})),next:results.length===500?results[results.length-1].id:null});
  }
  if(url.pathname==='/api/company'&&request.method==='PUT'){
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Use the directory to make changes.'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required.'},415);
   const body=await request.text();if(body.length>10000)return json({error:'Request too large.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
   const {id,version,change}=input;
   if(!known.has(id)||!Number.isInteger(version)||version<0||!change||typeof change!=='object'||Array.isArray(change))return json({error:'Invalid company or version.'},400);
   const allowed=['name','linkedin','careers','category'];if(Object.keys(change).some(k=>!allowed.includes(k))||!Object.keys(change).length)return json({error:'Invalid fields.'},400);
   if(('name'in change&&(typeof change.name!=='string'||!change.name.trim()||change.name.length>250))||('linkedin'in change&&!link(change.linkedin))||('careers'in change&&!link(change.careers))||('category'in change&&!['client','implementation','vendor'].includes(change.category)))return json({error:'Check the name, links and category.'},400);
   const database=db(env),old=await database.prepare('SELECT payload,version FROM company_edits WHERE id = ?').bind(id).first();
   if((old?.version||0)!==version)return json({error:'This company changed since you loaded it. Refresh and try again.'},409);
   const payload={...(old?JSON.parse(old.payload):{}),...change};if(payload.name)payload.name=payload.name.trim();
   const result=old?await database.prepare('UPDATE company_edits SET payload = ?, version = version + 1 WHERE id = ? AND version = ? RETURNING version').bind(JSON.stringify(payload),id,version).first():await database.prepare('INSERT INTO company_edits (id,payload,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING RETURNING version').bind(id,JSON.stringify(payload)).first();
   if(!result)return json({error:'Another visitor just updated this company. Refresh and try again.'},409);
   return json({id,...payload,version:result.version});
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname;
  if(!Object.hasOwn(ASSETS,path))return new Response('Not found',{status:404});
  const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'application/json';
  return new Response(request.method==='HEAD'?null:ASSETS[path],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('Directory request failed',error);return json({error:'Shared storage is unavailable. Please try again. Your changes were not saved.'},503);}
}};
