const baseRows=JSON.parse(ASSETS['/companies.json']);
const known=new Map(baseRows.map(r=>[r[0],r]));
const baseNames=new Set(baseRows.map(r=>r[0].trim().replace(/\s+/g,' ').toLocaleLowerCase()));
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function db(env){if(!env.DB)throw Error('Database unavailable');return env.DB;}
function bucket(env){if(!env.BUCKET)throw Error('Document storage unavailable');return env.BUCKET;}
function link(value){if(typeof value!=='string'||value.length>2048)return false;if(!value)return true;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
function normalizedName(value){return value.trim().replace(/\s+/g,' ').toLocaleLowerCase();}
const sectionNames=new Set(['recruiter-directory','latest-posted-jobs','study-materials','interview-prep','interview-support']);
const sectionCategories=new Set(['java','data','devops','validation']);
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
   if(await database.prepare('SELECT email FROM deleted_users WHERE email = ?').bind(email).first())return json({error:'Access for this Gmail has been permanently removed.'},403);
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
  if(url.pathname==='/api/access/users'&&request.method==='DELETE'){
   if(session?.role!=='admin')return json({error:'Only the Admin can permanently delete users.'},403);
   if(!sameOrigin(request,url))return json({error:'Use Access Management to delete users.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid request.'},400);}
   const email=String(input?.email||'').trim().toLowerCase();
   if(!emailPattern.test(email)||email===adminEmail)return json({error:'The Admin account cannot be deleted.'},400);
   const database=db(env),existing=await database.prepare('SELECT email FROM access_users WHERE email = ?').bind(email).first();
   if(!existing)return json({error:'User not found. Refresh the list.'},404);
   await database.batch([
    database.prepare('INSERT INTO deleted_users (email,deleted_at,deleted_by) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING').bind(email,new Date().toISOString(),session.email),
    database.prepare('DELETE FROM access_sessions WHERE email = ?').bind(email),
    database.prepare('DELETE FROM user_profiles WHERE email = ?').bind(email),
    database.prepare('DELETE FROM coadmins WHERE email = ?').bind(email),
    database.prepare('DELETE FROM access_users WHERE email = ?').bind(email),
   ]);
   return json({email,deleted:true});
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
   if(await database.prepare('SELECT email FROM deleted_users WHERE email = ?').bind(email).first())return json({error:'This Gmail was permanently removed.'},403);
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
  if(url.pathname==='/api/review/section-items'&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const {results}=await db(env).prepare("SELECT id,section,category,title,organization,url,details,email,phone,extension,file_name,posted_at,actor_email,created_at FROM section_items WHERE status = 'pending' ORDER BY created_at LIMIT 500").all();
   return json({items:results});
  }
  if(url.pathname==='/api/review/section-items'&&request.method==='PUT'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   if(!sameOrigin(request,url))return json({error:'Use the directory to review submissions.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid request.'},400);}
   if(typeof input?.id!=='string'||!['approve','deny'].includes(input?.action))return json({error:'Invalid review action.'},400);
   const result=await db(env).prepare("UPDATE section_items SET status = ?,reviewed_at = ?,reviewed_by = ? WHERE id = ? AND status = 'pending' RETURNING id,status").bind(input.action==='approve'?'approved':'denied',new Date().toISOString(),session.email,input.id).first();
   return result?json(result):json({error:'This submission was already reviewed.'},409);
  }
  if(url.pathname==='/api/review/section-changes'&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const {results}=await db(env).prepare("SELECT id,item_id,actor_email,kind,before_payload,after_payload,base_version,pending_file_key,created_at FROM section_change_requests WHERE status = 'pending' ORDER BY created_at LIMIT 500").all();
   return json({items:results.map(row=>({...row,before:JSON.parse(row.before_payload),after:JSON.parse(row.after_payload)}))});
  }
  if(url.pathname==='/api/review/section-changes'&&request.method==='PUT'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   if(!sameOrigin(request,url))return json({error:'Use Access Management to review changes.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid review action.'},400);}
   if(typeof input?.id!=='string'||!['approve','deny'].includes(input?.action))return json({error:'Invalid review action.'},400);
   const database=db(env),requestRow=await database.prepare("SELECT item_id,kind,after_payload,base_version,pending_file_key FROM section_change_requests WHERE id = ? AND status = 'pending'").bind(input.id).first();
   if(!requestRow)return json({error:'This change was already reviewed.'},409);
   const proposed=JSON.parse(requestRow.after_payload);
   let oldFileKey='';
   if(input.action==='approve'){
    const current=await database.prepare('SELECT version,status,file_key FROM section_items WHERE id = ?').bind(requestRow.item_id).first();
    if(!current||current.status!=='approved'||current.version!==requestRow.base_version)return json({error:'This entry changed. Deny this request and ask for a new one.'},409);
    oldFileKey=current.file_key;
    let result;
    if(requestRow.kind==='move')result=await database.prepare("UPDATE section_items SET category = ?,version = version + 1 WHERE id = ? AND version = ? AND status = 'approved' RETURNING id").bind(proposed.category,requestRow.item_id,requestRow.base_version).first();
    else if(requestRow.kind==='delete')result=await database.prepare("DELETE FROM section_items WHERE id = ? AND version = ? AND status = 'approved' RETURNING id").bind(requestRow.item_id,requestRow.base_version).first();
    else result=await database.prepare("UPDATE section_items SET title = ?,organization = ?,url = ?,details = ?,email = ?,phone = ?,extension = ?,posted_at = ?,file_key = ?,file_name = ?,file_type = ?,version = version + 1 WHERE id = ? AND version = ? AND status = 'approved' RETURNING id").bind(proposed.title,proposed.organization,proposed.url,proposed.details,proposed.email,proposed.phone,proposed.extension,proposed.posted_at,proposed.file_key,proposed.file_name,proposed.file_type,requestRow.item_id,requestRow.base_version).first();
    if(!result)return json({error:'This entry changed. Refresh and try again.'},409);
   }
   const reviewed=await database.prepare("UPDATE section_change_requests SET status = ?,reviewed_at = ?,reviewed_by = ? WHERE id = ? AND status = 'pending' RETURNING id,status").bind(input.action==='approve'?'approved':'denied',new Date().toISOString(),session.email,input.id).first();
   if(!reviewed)return json({error:'This request was already reviewed.'},409);
   const discardedKey=input.action==='deny'?requestRow.pending_file_key:requestRow.kind==='delete'||requestRow.pending_file_key?oldFileKey:'';
   if(discardedKey)try{await bucket(env).delete(discardedKey);}catch(error){console.error('Could not remove replaced document',error);}
   return json(reviewed);
  }
  if((url.pathname==='/companies.json'||url.pathname.startsWith('/api/'))&&session?.status!=='approved')return json({error:'Access approval required.'},403);
  if(url.pathname==='/api/profile'&&request.method==='GET'){
   const profile=await db(env).prepare('SELECT first_name,last_name,mobile,visa_status FROM user_profiles WHERE email = ?').bind(session.email).first();
   return json({email:session.email,profile:profile||null});
  }
  if(url.pathname==='/api/profile'&&request.method==='PUT'){
   if(!sameOrigin(request,url))return json({error:'Use the profile page to save changes.'},403);
   let input;try{input=await jsonInput(request);}catch{return json({error:'Invalid profile details.'},400);}
   const firstName=String(input?.firstName||'').trim(),lastName=String(input?.lastName||'').trim(),mobile=String(input?.mobile||'').trim(),visaStatus=String(input?.visaStatus||'').trim();
   if(firstName.length>80||lastName.length>80||mobile.length>40||(mobile&&!/^[+()\d.\s-]+$/.test(mobile))||!['','OPT','STEMOPT','CPT','H1B','H4'].includes(visaStatus))return json({error:'Check the details you entered. You can leave any profile field blank.'},400);
   const result=await db(env).prepare('INSERT INTO user_profiles (email,first_name,last_name,mobile,visa_status,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET first_name = excluded.first_name,last_name = excluded.last_name,mobile = excluded.mobile,visa_status = excluded.visa_status,updated_at = excluded.updated_at RETURNING first_name,last_name,mobile,visa_status').bind(session.email,firstName,lastName,mobile,visaStatus,new Date().toISOString()).first();
   return json({email:session.email,profile:result});
  }
  if(url.pathname==='/api/section-items'&&request.method==='GET'){
   const section=url.searchParams.get('section'),category=url.searchParams.get('category');
   if(!sectionNames.has(section)||!sectionCategories.has(category))return json({error:'Invalid section or category.'},400);
   const search=(url.searchParams.get('search')||'').trim().slice(0,100).replace(/[\\%_]/g,'\\$&');
   const windowName=url.searchParams.get('window')||'all';
   if(!['all','day','week','month'].includes(windowName))return json({error:'Invalid date filter.'},400);
   const durations={day:86400000,week:604800000,month:2592000000};
   const cutoff=windowName==='all'?'':new Date(Date.now()-durations[windowName]).toISOString();
   const {results}=await db(env).prepare("SELECT id,version,category,title,organization,url,details,email,phone,extension,file_name,posted_at,created_at FROM section_items WHERE section = ? AND category = ? AND status = 'approved' AND (? = '' OR title LIKE ? ESCAPE '\\' OR organization LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\') AND (? = '' OR posted_at >= ?) ORDER BY created_at DESC LIMIT 500").bind(section,category,search,`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`,cutoff,cutoff).all();
   return json({items:results});
  }
  if(url.pathname.startsWith('/api/section-file/')&&request.method==='GET'){
   const id=url.pathname.slice('/api/section-file/'.length);
   const item=await db(env).prepare('SELECT file_key,file_name,file_type,status,actor_email FROM section_items WHERE id = ?').bind(id).first();
   if(!item?.file_key)return json({error:'Document not found.'},404);
   if(item.status!=='approved'&&!canManage(session)&&item.actor_email!==session.email)return json({error:'Document is awaiting approval.'},403);
   const file=await bucket(env).get(item.file_key);if(!file)return json({error:'Document unavailable.'},404);
   return new Response(file.body,{headers:{'Content-Type':item.file_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(item.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname.startsWith('/api/section-change-file/')&&request.method==='GET'){
   if(!canManage(session))return json({error:'Admin access required.'},403);
   const id=url.pathname.slice('/api/section-change-file/'.length);
   const item=await db(env).prepare("SELECT pending_file_key,after_payload FROM section_change_requests WHERE id = ? AND status = 'pending'").bind(id).first();
   if(!item?.pending_file_key)return json({error:'Document not found.'},404);
   const proposed=JSON.parse(item.after_payload),file=await bucket(env).get(item.pending_file_key);
   if(!file)return json({error:'Document unavailable.'},404);
   return new Response(file.body,{headers:{'Content-Type':proposed.file_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(proposed.file_name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname==='/api/section-changes'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to request changes.'},403);
   let input,file=null;
   try{if(request.headers.get('Content-Type')?.includes('multipart/form-data')){const data=await request.formData();input=Object.fromEntries([...data.entries()].filter(([key])=>key!=='file'));file=data.get('file');}else input=await jsonInput(request);}
   catch{return json({error:'Invalid change request.'},400);}
   const id=String(input?.id||''),version=Number(input?.version),kind=String(input?.kind||'');
   if(!id||!Number.isSafeInteger(version)||version<1||!['edit','move','delete'].includes(kind))return json({error:'Invalid change request.'},400);
   const database=db(env),current=await database.prepare("SELECT id,version,section,category,title,organization,url,details,email,phone,extension,posted_at,file_key,file_name,file_type FROM section_items WHERE id = ? AND status = 'approved'").bind(id).first();
   if(!current)return json({error:'Entry not found.'},404);
   if(current.version!==version)return json({error:'This entry changed. Refresh and try again.'},409);
   if(!canManage(session)&&await database.prepare("SELECT id FROM section_change_requests WHERE item_id = ? AND status = 'pending' LIMIT 1").bind(id).first())return json({error:'A change for this entry is already awaiting approval.'},409);
   const before={section:current.section,category:current.category,title:current.title,organization:current.organization,url:current.url,details:current.details,email:current.email,phone:current.phone,extension:current.extension,posted_at:current.posted_at,file_name:current.file_name};
   let after={},pendingFileKey='',fileBytes=null;
   if(kind==='move'){
    const target=String(input?.category||'');if(!sectionCategories.has(target)||target===current.category)return json({error:'Choose a different category.'},400);
    after={category:target};
   }else if(kind==='edit'){
    const title=String(input?.title||'').trim(),organization=String(input?.organization||'').trim(),itemUrl=String(input?.url||'').trim(),details=String(input?.details||'').trim();
    const email=String(input?.email||'').trim(),phone=String(input?.phone||'').trim(),extension=String(input?.extension||'').trim();
    if(title.length>200||organization.length>200||details.length>2000||email.length>254||email&&!emailPattern.test(email)||phone.length>40||extension.length>20||!link(itemUrl))return json({error:'Check the edited fields and link.'},400);
    const isDocument=current.section==='study-materials'||current.section==='interview-prep';
    if(file&&!isDocument)return json({error:'Only materials and interview prep accept uploads.'},400);
    let postedAt=current.posted_at;
    if(current.section==='latest-posted-jobs'){postedAt='';if(input?.postedAt){const date=new Date(input.postedAt);if(!Number.isFinite(date.getTime()))return json({error:'Enter a valid posting date or leave it blank.'},400);postedAt=date.toISOString();}}
    after={title,organization,url:itemUrl,details,email,phone,extension,posted_at:postedAt,file_key:current.file_key,file_name:current.file_name,file_type:current.file_type};
    if(file){
     if(typeof file.arrayBuffer!=='function'||file.size===0||file.size>10*1024*1024)return json({error:'Choose a PDF or Word file smaller than 10 MB.'},400);
     const fileName=String(file.name||'').split(/[\\/]/).pop().slice(0,200),ext=fileName.toLowerCase().split('.').pop();
     const fileType={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext];
     if(!fileType)return json({error:'Only PDF, DOC, and DOCX files are allowed.'},400);
     fileBytes=await file.arrayBuffer();const magic=new Uint8Array(fileBytes.slice(0,8));
     const pdf=ext==='pdf'&&[37,80,68,70,45].every((n,i)=>magic[i]===n),doc=ext==='doc'&&[208,207,17,224,161,177,26,225].every((n,i)=>magic[i]===n),docx=ext==='docx'&&magic[0]===80&&magic[1]===75&&magic[2]===3&&magic[3]===4;
     if(!pdf&&!doc&&!docx)return json({error:'The selected file does not match its PDF or Word extension.'},400);
     after.file_name=fileName;after.file_type=fileType;
    }
    if(!file&&Object.entries(after).every(([key,value])=>value===current[key]))return json({error:'No changes to submit.'},400);
   }else if(file)return json({error:'This action does not accept a file.'},400);
   if(canManage(session)){
    let newFileKey='';
    if(fileBytes){newFileKey=`section-items/${id}/${crypto.randomUUID()}`;after.file_key=newFileKey;await bucket(env).put(newFileKey,fileBytes,{httpMetadata:{contentType:after.file_type}});}
    let result;
    try{
     if(kind==='move')result=await database.prepare("UPDATE section_items SET category = ?,version = version + 1 WHERE id = ? AND version = ? AND status = 'approved' RETURNING id,version").bind(after.category,id,version).first();
     else if(kind==='delete')result=await database.prepare("DELETE FROM section_items WHERE id = ? AND version = ? AND status = 'approved' RETURNING id").bind(id,version).first();
     else result=await database.prepare("UPDATE section_items SET title = ?,organization = ?,url = ?,details = ?,email = ?,phone = ?,extension = ?,posted_at = ?,file_key = ?,file_name = ?,file_type = ?,version = version + 1 WHERE id = ? AND version = ? AND status = 'approved' RETURNING id,version").bind(after.title,after.organization,after.url,after.details,after.email,after.phone,after.extension,after.posted_at,after.file_key,after.file_name,after.file_type,id,version).first();
    }catch(error){if(newFileKey)await bucket(env).delete(newFileKey);throw error;}
    if(!result){if(newFileKey)await bucket(env).delete(newFileKey);return json({error:'This entry changed. Refresh and try again.'},409);}
    if((kind==='delete'||newFileKey)&&current.file_key)try{await bucket(env).delete(current.file_key);}catch(error){console.error('Could not remove replaced document',error);}
    return json({status:'approved',id,version:result.version||null,kind});
   }
   const requestId=crypto.randomUUID();
   if(fileBytes){pendingFileKey=`section-changes/${requestId}`;after.file_key=pendingFileKey;await bucket(env).put(pendingFileKey,fileBytes,{httpMetadata:{contentType:after.file_type}});}
   try{await database.prepare("INSERT INTO section_change_requests (id,item_id,actor_email,kind,before_payload,after_payload,base_version,pending_file_key,status,created_at) VALUES (?,?,?,?,?,?,?,?,'pending',?)").bind(requestId,id,session.email,kind,JSON.stringify(before),JSON.stringify(after),version,pendingFileKey,new Date().toISOString()).run();}
   catch(error){if(pendingFileKey)await bucket(env).delete(pendingFileKey);throw error;}
   return json({pending:true,id:requestId},202);
  }
  if(url.pathname==='/api/section-items'&&request.method==='POST'){
   if(!sameOrigin(request,url))return json({error:'Use the directory to add items.'},403);
   let input,file=null;
   try{
    if(request.headers.get('Content-Type')?.includes('multipart/form-data')){
     const data=await request.formData();input=Object.fromEntries([...data.entries()].filter(([key])=>key!=='file'));file=data.get('file');
    }else input=await jsonInput(request);
   }catch{return json({error:'Invalid submission.'},400);}
   const section=String(input?.section||''),category=String(input?.category||'');
   const title=String(input?.title||'').trim(),organization=String(input?.organization||'').trim(),itemUrl=String(input?.url||'').trim(),details=String(input?.details||'').trim();
   const email=String(input?.email||'').trim(),phone=String(input?.phone||'').trim(),extension=String(input?.extension||'').trim();
   if(!sectionNames.has(section)||!sectionCategories.has(category)||title.length>200||organization.length>200||details.length>2000||email.length>254||email&&!emailPattern.test(email)||phone.length>40||extension.length>20||!link(itemUrl))return json({error:'Check the required fields and link.'},400);
   if(![title,organization,itemUrl,details,email,phone,extension,input?.postedAt].some(Boolean)&&!file)return json({error:'Add at least one detail or a file to create an entry.'},400);
   const documentSection=section==='study-materials'||section==='interview-prep';
   if(file&&!documentSection)return json({error:'Uploads are available only for materials and interview prep.'},400);
   let fileKey='',fileName='',fileType='',fileBytes=null;
   if(file){
    if(typeof file.arrayBuffer!=='function'||file.size===0||file.size>10*1024*1024)return json({error:'Choose a PDF or Word file smaller than 10 MB.'},400);
    fileName=String(file.name||'').split(/[\\/]/).pop().slice(0,200);
    const ext=fileName.toLowerCase().split('.').pop();
    fileType={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext];
    if(!fileType)return json({error:'Only PDF, DOC, and DOCX files are allowed.'},400);
    fileBytes=await file.arrayBuffer();const magic=new Uint8Array(fileBytes.slice(0,8));
    const pdf=ext==='pdf'&&[37,80,68,70,45].every((n,i)=>magic[i]===n);
    const doc=ext==='doc'&&[208,207,17,224,161,177,26,225].every((n,i)=>magic[i]===n);
    const docx=ext==='docx'&&magic[0]===80&&magic[1]===75&&magic[2]===3&&magic[3]===4;
    if(!pdf&&!doc&&!docx)return json({error:'The selected file does not match its PDF or Word extension.'},400);
   }
   let postedAt='';
   if(section==='latest-posted-jobs'&&input?.postedAt){
    const date=new Date(input.postedAt);if(!Number.isFinite(date.getTime()))return json({error:'Enter the posting date and time.'},400);postedAt=date.toISOString();
   }
   const status=canManage(session)?'approved':'pending';
   const item={id:crypto.randomUUID(),section,category,title,organization,url:itemUrl,details,email,phone,extension,postedAt,status,createdAt:new Date().toISOString()};
   if(fileBytes){fileKey=`section-items/${item.id}`;await bucket(env).put(fileKey,fileBytes,{httpMetadata:{contentType:fileType}});}
   try{await db(env).prepare('INSERT INTO section_items (id,section,category,title,organization,url,details,email,phone,extension,file_key,file_name,file_type,posted_at,actor_email,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(item.id,section,category,title,organization,itemUrl,details,email,phone,extension,fileKey,fileName,fileType,postedAt,session.email,status,item.createdAt).run();}
   catch(error){if(fileKey)await bucket(env).delete(fileKey);throw error;}
   return json({item,status},201);
  }
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
  const path=url.pathname==='/'?'/index.html':section?'/recruiter-directory.html':url.pathname==='/profile'||url.pathname==='/profile/'?'/profile.html':url.pathname;
  if(!Object.hasOwn(ASSETS,path))return new Response('Not found',{status:404});
  const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'application/json';
  return new Response(request.method==='HEAD'?null:ASSETS[path],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('Directory request failed',error);return json({error:'Shared storage is unavailable. Please try again. Your changes were not saved.'},503);}
}};
