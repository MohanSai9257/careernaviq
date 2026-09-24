const baseRows=JSON.parse(ASSETS['/companies.json']);
const known=new Map(baseRows.map(r=>[r[0],r]));
const baseNames=new Set(baseRows.map(r=>r[0].trim().replace(/\s+/g,' ').toLocaleLowerCase()));
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function db(env){if(!env.DB)throw Error('Database unavailable');return env.DB;}
function link(value){if(typeof value!=='string'||value.length>2048)return false;if(!value)return true;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
function normalizedName(value){return value.trim().replace(/\s+/g,' ').toLocaleLowerCase();}
const adminEmail='chatgpt3577@gmail.com';
const cookieName='directory_session';
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function sessionCookie(token){return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;}
function clearSessionCookie(){return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}
function requestToken(request){return (request.headers.get('Cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
async function sessionFor(request,env){
 const token=requestToken(request);if(!token)return null;
 const session=await db(env).prepare('SELECT email,role FROM access_sessions WHERE token = ?').bind(token).first();
 if(!session)return null;
 if(session.role==='admin'&&session.email===adminEmail)return {...session,status:'approved'};
 const user=await db(env).prepare('SELECT status FROM access_users WHERE email = ?').bind(session.email).first();
 const status=user?.status||'pending';
 const coadmin=status==='approved'?await db(env).prepare('SELECT email FROM coadmins WHERE email = ?').bind(session.email).first():null;
 return {...session,role:coadmin?'coadmin':'user',status};
}
function canManage(session){return session?.status==='approved'&&['admin','coadmin'].includes(session.role);}
async function currentCompany(database,id,old){
 const base=known.get(id);
 const row=base?{name:base[0],linkedin:base[1],careers:base[2],category:base[3]}:await database.prepare('SELECT name,linkedin,careers,category FROM added_companies WHERE id = ?').bind(id).first();
 return row?{...row,...(old?JSON.parse(old.payload):{})}:null;
}
function sameOrigin(request,url){return !request.headers.get('Origin')||request.headers.get('Origin')===url.origin;}
async function jsonInput(request){if(!request.headers.get('Content-Type')?.includes('application/json'))throw Error('JSON required.');const body=await request.text();if(body.length>10000)throw Error('Request too large.');return JSON.parse(body);}
export default {async fetch(request,env){
 const url=new URL(request.url);
 try{
  if(url.pathname==='/api/session'&&request.method==='GET'){
   const session=await sessionFor(request,env);return json(session?{email:session.email,role:session.role,status:session.status}:{role:'guest',status:'none'});
  }
  if(url.pathname==='/api/access/request'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to request access.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Enter a valid Gmail address.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   if(email.length>254||!email.endsWith('@gmail.com')||!emailPattern.test(email)||email===adminEmail)return json({error:'Enter a valid Gmail address.'},400);
   const database=db(env),now=new Date().toISOString();
   await database.prepare("INSERT INTO access_users (email,status,requested_at,updated_at) VALUES (?,'pending',?,?) ON CONFLICT(email) DO NOTHING").bind(email,now,now).run();
   const user=await database.prepare('SELECT status FROM access_users WHERE email = ?').bind(email).first();
   if(user.status==='approved')return json({error:'Access is already approved. Use Login.'},409);
   const token=crypto.randomUUID()+crypto.randomUUID();
   await database.prepare('INSERT INTO access_sessions (token,email,role,created_at) VALUES (?,?,?,?)').bind(token,email,'user',now).run();
   return Response.json({email,role:'user',status:user.status},{headers:{'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/api/access/login'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to log in.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Enter a valid Gmail address.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   if(email.length>254||!email.endsWith('@gmail.com')||!emailPattern.test(email))return json({error:'Enter a valid Gmail address.'},400);
   const user=await db(env).prepare('SELECT status FROM access_users WHERE email = ?').bind(email).first();
   if(!user)return json({error:'No access request found. Use Request access first.'},404);
   if(user.status==='pending')return json({error:'Your request is awaiting Admin approval.'},403);
   if(user.status==='blocked')return json({error:'This Gmail is blocked. Contact the Admin.'},403);
   const token=crypto.randomUUID()+crypto.randomUUID();
   await db(env).prepare('INSERT INTO access_sessions (token,email,role,created_at) VALUES (?,?,?,?)').bind(token,email,'user',new Date().toISOString()).run();
   const coadmin=await db(env).prepare('SELECT email FROM coadmins WHERE email = ?').bind(email).first();
   return Response.json({email,role:coadmin?'coadmin':'user',status:'approved'},{headers:{'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to open Admin mode.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Enter the admin Gmail.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   let role='admin';
   if(email!==adminEmail){
    const member=await db(env).prepare('SELECT email FROM coadmins WHERE email = ?').bind(email).first();
    const user=await db(env).prepare('SELECT status FROM access_users WHERE email = ?').bind(email).first();
    if(!member||user?.status!=='approved')return json({error:'This Gmail is not registered as Admin or Coadmin.'},403);
    role='coadmin';
   }
   const token=crypto.randomUUID()+crypto.randomUUID();
   await db(env).prepare('INSERT INTO access_sessions (token,email,role,created_at) VALUES (?,?,?,?)').bind(token,email,role,new Date().toISOString()).run();
   return Response.json({email,role,status:'approved'},{headers:{'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/api/logout'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to sign out.'},403);
   const token=requestToken(request);if(token)await db(env).prepare('DELETE FROM access_sessions WHERE token = ?').bind(token).run();
   return Response.json({ok:true},{headers:{'Set-Cookie':clearSessionCookie(),'Cache-Control':'no-store'}});
  }
  const session=await sessionFor(request,env);
  if(url.pathname==='/api/access/users'&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const {results}=await db(env).prepare('SELECT email,status,requested_at,updated_at FROM access_users ORDER BY requested_at DESC').all();
   return json({items:results});
  }
  if(url.pathname==='/api/access/users'&&request.method==='PUT'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   if(!sameOrigin(request,url))return json({error:'Use the directory to manage access.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid request.'},400);}
   const email=String(input?.email||'').trim().toLowerCase(),action=input?.action;
   const transitions={approve:['pending','approved'],deny:['pending','blocked'],block:['approved','blocked'],unblock:['blocked','approved']};
   if(!emailPattern.test(email)||email===adminEmail||!Object.hasOwn(transitions,action))return json({error:'Invalid user or action.'},400);
   const [from,to]=transitions[action];
   const result=await db(env).prepare('UPDATE access_users SET status = ?, updated_at = ? WHERE email = ? AND status = ? RETURNING email,status').bind(to,new Date().toISOString(),email,from).first();
   if(!result)return json({error:'This request changed. Refresh the list and try again.'},409);
   return json(result);
  }
  if(url.pathname==='/api/coadmins'&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const {results}=await db(env).prepare('SELECT email,granted_at FROM coadmins ORDER BY granted_at DESC').all();
   return json({items:results});
  }
  if(url.pathname==='/api/coadmins'&&request.method==='POST'){
   if(session?.role!=='admin')return json({error:'Only the Admin can grant Coadmin access.'},403);
   if(!sameOrigin(request,url))return json({error:'Use the directory to manage Coadmins.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Enter a valid Gmail address.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   if(email.length>254||!email.endsWith('@gmail.com')||!emailPattern.test(email)||email===adminEmail)return json({error:'Enter a valid Gmail address other than the Admin Gmail.'},400);
   const database=db(env),now=new Date().toISOString();
   await database.prepare("INSERT INTO access_users (email,status,requested_at,updated_at) VALUES (?,'approved',?,?) ON CONFLICT(email) DO UPDATE SET status = 'approved', updated_at = excluded.updated_at").bind(email,now,now).run();
   const result=await database.prepare('INSERT INTO coadmins (email,granted_at) VALUES (?,?) ON CONFLICT(email) DO NOTHING RETURNING email,granted_at').bind(email,now).first();
   if(!result)return json({error:'This Gmail already has Coadmin access.'},409);
   return json(result,201);
  }
  if(url.pathname==='/api/coadmins'&&request.method==='DELETE'){
   if(session?.role!=='admin')return json({error:'Only the Admin can remove Coadmin access.'},403);
   if(!sameOrigin(request,url))return json({error:'Use the directory to manage Coadmins.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid request.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   if(!emailPattern.test(email)||email===adminEmail)return json({error:'The Admin cannot be removed.'},400);
   const result=await db(env).prepare('DELETE FROM coadmins WHERE email = ? RETURNING email').bind(email).first();
   if(!result)return json({error:'Coadmin not found.'},404);
   return json(result);
  }
  if(url.pathname==='/api/review/changes'&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const {results}=await db(env).prepare("SELECT id,actor_email,company_id,company_name,kind,before_payload,after_payload,base_version,created_at FROM change_requests WHERE status = 'pending' ORDER BY created_at LIMIT 500").all();
   return json({items:results.map(r=>({...r,before:JSON.parse(r.before_payload),after:JSON.parse(r.after_payload)}))});
  }
  if(url.pathname==='/api/review/changes'&&request.method==='PUT'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   if(!sameOrigin(request,url))return json({error:'Use the directory to review changes.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid request.'},400);}
   const id=String(input?.id||''),action=input?.action;
   if(!id||!['approve','deny'].includes(action))return json({error:'Invalid review action.'},400);
   const database=db(env),item=await database.prepare("SELECT company_id,kind,after_payload,base_version FROM change_requests WHERE id = ? AND status = 'pending'").bind(id).first();
   if(!item)return json({error:'This request was already reviewed. Refresh the list.'},409);
   if(action==='approve'){
    if(item.kind==='add'){
     const proposed=JSON.parse(item.after_payload),normalized=normalizedName(proposed.name);
     if(baseNames.has(normalized))return json({error:'This company is already in the directory. Deny the request.'},409);
     const inserted=await database.prepare('INSERT INTO added_companies (id,normalized_name,name,linkedin,careers,category) VALUES (?,?,?,?,?,?) ON CONFLICT(normalized_name) DO NOTHING RETURNING id').bind(item.company_id,normalized,proposed.name,proposed.linkedin,proposed.careers,proposed.category).first();
     if(!inserted)return json({error:'This company was added already. Deny the duplicate request.'},409);
    }else{
    const old=await database.prepare('SELECT payload,version FROM company_edits WHERE id = ?').bind(item.company_id).first();
    if((old?.version||0)!==item.base_version||old&&JSON.parse(old.payload).deleted)return json({error:'The company changed since this request. Deny it and ask the user to submit a new edit.'},409);
    const payload={...(old?JSON.parse(old.payload):{}),...JSON.parse(item.after_payload)};
    const result=old?await database.prepare('UPDATE company_edits SET payload = ?,version = version + 1 WHERE id = ? AND version = ? RETURNING version').bind(JSON.stringify(payload),item.company_id,item.base_version).first():await database.prepare('INSERT INTO company_edits (id,payload,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING RETURNING version').bind(item.company_id,JSON.stringify(payload)).first();
    if(!result)return json({error:'The company changed since this request. Refresh and try again.'},409);
    }
   }
   const reviewed=await database.prepare('UPDATE change_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = ? RETURNING id,status').bind(action==='approve'?'approved':'denied',new Date().toISOString(),session.email,id,'pending').first();
   if(!reviewed)return json({error:'This request was already reviewed. Refresh the list.'},409);
   return json(reviewed);
  }
  if((url.pathname==='/companies.json'||url.pathname.startsWith('/api/'))&&session?.status!=='approved')return json({error:'Access approval required.'},403);
  if(url.pathname==='/api/changes'&&request.method==='GET'){
   const after=url.searchParams.get('after')||'';
   const {results}=await db(env).prepare('SELECT id,payload,version FROM company_edits WHERE id > ? ORDER BY id LIMIT 500').bind(after).all();
   return json({items:results.map(r=>({id:r.id,...JSON.parse(r.payload),version:r.version})),next:results.length===500?results[results.length-1].id:null});
  }
  if(url.pathname==='/api/companies'&&request.method==='GET'){
   const after=Number(url.searchParams.get('after')||0);
   if(!Number.isSafeInteger(after)||after<0)return json({error:'Invalid cursor.'},400);
   const {results}=await db(env).prepare('SELECT sequence,id,name,linkedin,careers,category FROM added_companies WHERE sequence > ? ORDER BY sequence LIMIT 500').bind(after).all();
   return json({items:results.map(r=>({id:r.id,name:r.name,linkedin:r.linkedin,careers:r.careers,category:r.category})),next:results.length===500?results[results.length-1].sequence:null});
  }
  if(url.pathname==='/api/companies'&&request.method==='POST'){
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Use the directory to add companies.'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required.'},415);
   const body=await request.text();if(body.length>10000)return json({error:'Request too large.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['name','linkedin','careers','category'].includes(k))||typeof input.name!=='string'||!input.name.trim()||input.name.length>250||typeof input.linkedin!=='string'||!link(input.linkedin)||typeof input.careers!=='string'||!link(input.careers)||!['client','implementation','vendor'].includes(input.category))return json({error:'Check the name, links and category.'},400);
   const name=input.name.trim().replace(/\s+/g,' '),normalized=normalizedName(name);
   if(baseNames.has(normalized))return json({error:'This company is already in the directory.'},409);
   const database=db(env),existing=await database.prepare('SELECT id FROM added_companies WHERE normalized_name = ?').bind(normalized).first();
   if(existing)return json({error:'This company is already in the directory.'},409);
   const id='added:'+crypto.randomUUID();
   if(!canManage(session)){
    const pending=await database.prepare("SELECT id FROM change_requests WHERE kind = 'add' AND status = 'pending' AND lower(company_name) = ? LIMIT 1").bind(normalized).first();
    if(pending)return json({error:'An add request for this company is already awaiting approval.'},409);
    const requestId=crypto.randomUUID(),proposed={name,linkedin:input.linkedin,careers:input.careers,category:input.category};
    await database.prepare("INSERT INTO change_requests (id,actor_email,company_id,company_name,kind,before_payload,after_payload,base_version,status,created_at) VALUES (?,?,?,?,?,?,?,?,'pending',?)").bind(requestId,session.email,id,name,'add','{}',JSON.stringify(proposed),0,new Date().toISOString()).run();
    return json({pending:true,requestId,name},202);
   }
   const inserted=await database.prepare('INSERT INTO added_companies (id,normalized_name,name,linkedin,careers,category) VALUES (?,?,?,?,?,?) ON CONFLICT(normalized_name) DO NOTHING RETURNING id').bind(id,normalized,name,input.linkedin,input.careers,input.category).first();
   if(!inserted)return json({error:'Another visitor just added this company. Refresh the page.'},409);
   return json({id,name,linkedin:input.linkedin,careers:input.careers,category:input.category},201);
  }
  if(url.pathname==='/api/company'&&request.method==='PUT'){
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Use the directory to make changes.'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required.'},415);
   const body=await request.text();if(body.length>10000)return json({error:'Request too large.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
   const {id,version,change}=input;
   if((!known.has(id)&&!await db(env).prepare('SELECT id FROM added_companies WHERE id = ?').bind(id).first())||!Number.isInteger(version)||version<0||!change||typeof change!=='object'||Array.isArray(change))return json({error:'Invalid company or version.'},400);
   const allowed=['name','linkedin','careers','category'];if(Object.keys(change).some(k=>!allowed.includes(k))||!Object.keys(change).length)return json({error:'Invalid fields.'},400);
   if(('name'in change&&(typeof change.name!=='string'||!change.name.trim()||change.name.length>250))||('linkedin'in change&&!link(change.linkedin))||('careers'in change&&!link(change.careers))||('category'in change&&!['client','implementation','vendor'].includes(change.category)))return json({error:'Check the name, links and category.'},400);
   const database=db(env),old=await database.prepare('SELECT payload,version FROM company_edits WHERE id = ?').bind(id).first();
   if(old&&JSON.parse(old.payload).deleted)return json({error:'This company has been deleted. Refresh the page.'},409);
   if((old?.version||0)!==version)return json({error:'This company changed since you loaded it. Refresh and try again.'},409);
   if(typeof change.name==='string')change.name=change.name.trim();
   if(!canManage(session)){
    const current=await currentCompany(database,id,old),before={};
    for(const key of Object.keys(change))before[key]=current[key];
    if(Object.keys(change).every(key=>before[key]===change[key]))return json({error:'No changes to submit.'},400);
    const requestId=crypto.randomUUID(),kind=Object.keys(change).length===1&&'category'in change?'move':'edit';
    await database.prepare("INSERT INTO change_requests (id,actor_email,company_id,company_name,kind,before_payload,after_payload,base_version,status,created_at) VALUES (?,?,?,?,?,?,?,?,'pending',?)").bind(requestId,session.email,id,current.name,kind,JSON.stringify(before),JSON.stringify(change),version,new Date().toISOString()).run();
    return json({pending:true,requestId},202);
   }
   const payload={...(old?JSON.parse(old.payload):{}),...change};if(payload.name)payload.name=payload.name.trim();
   const result=old?await database.prepare('UPDATE company_edits SET payload = ?, version = version + 1 WHERE id = ? AND version = ? RETURNING version').bind(JSON.stringify(payload),id,version).first():await database.prepare('INSERT INTO company_edits (id,payload,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING RETURNING version').bind(id,JSON.stringify(payload)).first();
   if(!result)return json({error:'Another visitor just updated this company. Refresh and try again.'},409);
   return json({id,...payload,version:result.version});
  }
  if(url.pathname==='/api/company'&&request.method==='DELETE'){
   if(!canManage(session))return json({error:'Open Admin mode to delete companies.'},403);
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Use the directory to delete companies.'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required.'},415);
   const body=await request.text();if(body.length>10000)return json({error:'Request too large.'},413);
   let input;try{input=JSON.parse(body);}catch{return json({error:'Invalid request.'},400);}
   const {id,version}=input||{};
   if(typeof id!=='string'||!Number.isInteger(version)||version<0||(!known.has(id)&&!await db(env).prepare('SELECT id FROM added_companies WHERE id = ?').bind(id).first()))return json({error:'Invalid company or version.'},400);
   const database=db(env),old=await database.prepare('SELECT payload,version FROM company_edits WHERE id = ?').bind(id).first();
   if(old&&JSON.parse(old.payload).deleted)return json({error:'This company has already been deleted.'},409);
   if((old?.version||0)!==version)return json({error:'This company changed since you loaded it. Refresh and try again.'},409);
   const payload={...(old?JSON.parse(old.payload):{}),deleted:true};
   const result=old?await database.prepare('UPDATE company_edits SET payload = ?, version = version + 1 WHERE id = ? AND version = ? RETURNING version').bind(JSON.stringify(payload),id,version).first():await database.prepare('INSERT INTO company_edits (id,payload,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING RETURNING version').bind(id,JSON.stringify(payload)).first();
   if(!result)return json({error:'Another visitor just updated this company. Refresh and try again.'},409);
   return json({id,deleted:true,version:result.version});
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const sections=['recruiter-directory','latest-posted-jobs','study-materials','interview-prep','interview-support'];
  const section=sections.find(name=>url.pathname===`/${name}`||url.pathname===`/${name}/`);
  const path=url.pathname==='/'?'/index.html':section?'/recruiter-directory.html':url.pathname;
  if(!Object.hasOwn(ASSETS,path))return new Response('Not found',{status:404});
  const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'application/json';
  return new Response(request.method==='HEAD'?null:ASSETS[path],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('Directory request failed',error);return json({error:'Shared storage is unavailable. Please try again. Your changes were not saved.'},503);}
}};
