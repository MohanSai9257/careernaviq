const accessEl=id=>document.getElementById(id);
let accessSession={role:'guest',status:'none'},accessUsers=[],appLoaded=false,checking=false;
let changeRequests=[],coadmins=[];
let sectionSubmissions=[];
let sectionChanges=[];
let tabAccessItems=[];
let accessSettings={autoApprove:false};
let adminAccessRequests=[];
let analyticsData=null;
let deletingUserEmail='';
window.directoryRole='guest';
const managesAccess=()=>['admin','coadmin'].includes(accessSession.role)&&accessSession.status==='approved';
const adminPage=location.pathname==='/admin'||location.pathname==='/admin/';
async function accessJson(url,options){
 const response=await fetch(url,{cache:'no-store',...options});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Please try again.');
 return result;
}
function accessError(id,message){const el=accessEl(id);el.textContent=message;el.hidden=!message;}
function showAccessState(){
 const active=accessSession.status==='approved';
 if(adminPage&&active&&!managesAccess()){location.replace('/');return;}
 if(!active){const greeting=accessEl('profile-greeting');if(greeting)greeting.hidden=true;}
 document.body.classList.toggle('has-access',active);
 window.directoryRole=active?accessSession.role:'guest';
 window.setAdminNavigation?.(accessSession.role,accessSession.status);
 accessEl('access-gate').hidden=active;
 accessEl('directory-app').hidden=!active;
 accessEl('employer-content').hidden=adminPage;
 accessEl('analytics-dashboard').hidden=!adminPage||!managesAccess();
 accessEl('admin-dashboard').hidden=!adminPage||!managesAccess();
 accessEl('data-dashboard').hidden=!adminPage||!managesAccess();
 if(!adminPage||!managesAccess()){accessEl('analytics-dashboard').open=false;accessEl('admin-dashboard').open=false;accessEl('data-dashboard').open=false;}
 accessEl('coadmin-section').hidden=accessSession.role!=='admin';
 accessEl('role-label').textContent=accessSession.role==='admin'?'Admin':accessSession.role==='coadmin'?'Coadmin':'User';
 accessEl('admin-open').textContent=managesAccess()?'Logout':'Admin';
 accessEl('admin-open').classList.toggle('is-admin',managesAccess());
 accessEl('user-logout').hidden=!(active&&accessSession.role==='user');
 if(active){
  document.dispatchEvent(new Event('directory-access-ready'));
  if(!adminPage){
   if(!appLoaded){appLoaded=true;const script=document.createElement('script');script.src='app.js';script.onerror=()=>accessError('admin-access-error','Could not load the directory. Refresh the page.');document.body.append(script);}
   else window.updateDirectoryRole?.();
  }
  if(adminPage&&managesAccess())loadAdminData();
  return;
 }
 const pending=accessSession.status==='pending',blocked=accessSession.status==='blocked';
 accessEl('access-form').hidden=pending||blocked;
 accessEl('access-change').hidden=!pending&&!blocked;
 accessEl('access-message').textContent=pending?`Awaiting access from Admin for ${accessSession.email}. This page will open after approval.`:blocked?`Access has been denied for ${accessSession.email}. Contact the Admin if you think this is a mistake.`:'Enter your name and Gmail to request access. If already approved, use Gmail and click Login.';
}
async function checkAccess(){
 if(checking)return;checking=true;
 try{const next=await accessJson('/api/session');if(next.role!==accessSession.role||next.status!==accessSession.status||next.email!==accessSession.email){accessSession=next;showAccessState();}}
 catch{if(accessSession.role==='guest')accessError('access-error','Could not check access. Refresh the page.');}
 finally{checking=false;}
}

function formatAnalyticsNumber(value){return new Intl.NumberFormat().format(Number(value||0));}
function analyticsCard(label,value,hint){const card=document.createElement('article');card.className='analytics-card';const strong=document.createElement('strong');strong.textContent=formatAnalyticsNumber(value);const span=document.createElement('span');span.textContent=label;card.append(strong,span);if(hint){const small=document.createElement('small');small.textContent=hint;card.append(small);}return card;}
function renderAnalytics(){
 const summary=accessEl('analytics-summary');summary.replaceChildren();
 if(!analyticsData){summary.append(analyticsCard('Loading analytics',0,''));return;}
 const totals=analyticsData.totals||{},users=analyticsData.users||{},pending=analyticsData.pending||{},jobs=analyticsData.jobs||{};
 summary.append(
  analyticsCard('Total companies',totals.companies,'Employer Directory'),
  analyticsCard('Approved users',users.approved,'User access'),
  analyticsCard('Open jobs',jobs.open,'Latest Posted Jobs'),
  analyticsCard('Pending approvals',pending.total,'Needs Admin review'),
  analyticsCard('Recruiters',totals.recruiters,'Approved records'),
  analyticsCard('Study materials',totals.studyMaterials,'Approved records')
 );

}
async function loadAnalytics(){
 try{analyticsData=await accessJson('/api/admin/analytics');accessError('analytics-error','');renderAnalytics();}
 catch(error){accessError('analytics-error',error.message);}
}

function renderAccessUsers(){
 for(const status of ['pending','approved','blocked']){
 const people=accessUsers.filter(u=>u.status===status),list=accessEl('access-users-'+status);
 accessEl('access-count-'+status).textContent=people.length;list.replaceChildren();
 if(!people.length){const empty=document.createElement('p');empty.className='management-empty';empty.textContent=status==='pending'?'No access requests.':status==='approved'?'No approved users yet.':'No blocked users.';list.append(empty);continue;}
 for(const user of people){
  const row=document.createElement('div'),identity=document.createElement('div'),email=document.createElement('strong'),actions=document.createElement('div');
  row.className='access-user';identity.className='access-user-identity';email.textContent=user.name?`${user.name} · ${user.email}`:user.email;identity.append(email);actions.className='access-user-actions';
  const choices=status==='pending'?[['approve','Approve'],['deny','Deny']]:status==='approved'?[['block','Block'],...(accessSession.role==='admin'?[['delete','Delete']]:[])]:[['unblock','Unblock']];
  for(const [action,label] of choices){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.addEventListener('click',async()=>{
   if(action==='delete'){deletingUserEmail=user.email;accessEl('user-delete-description').textContent=`Delete ${user.email} permanently?`;accessError('user-delete-error','');accessEl('user-delete-dialog').showModal();return;}
   button.disabled=true;accessError('admin-access-error','');
   try{const updated=await accessJson('/api/access/users',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,action})});user.status=updated.status;renderAccessUsers();}
   catch(error){accessError('admin-access-error',error.message);button.disabled=false;}
  });actions.append(button);}
  row.append(identity,actions);list.append(row);
 }
 }
}
accessEl('user-delete-cancel').addEventListener('click',()=>accessEl('user-delete-dialog').close());
accessEl('user-delete-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;accessError('user-delete-error','');
 try{await accessJson('/api/access/users',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:deletingUserEmail})});accessUsers=accessUsers.filter(user=>user.email!==deletingUserEmail);coadmins=coadmins.filter(user=>user.email!==deletingUserEmail);accessEl('user-delete-dialog').close();renderAccessUsers();renderCoadmins();}
 catch(error){accessError('user-delete-error',error.message);}finally{button.disabled=false;}
});
async function loadAccessUsers(){
 try{const data=await accessJson('/api/access/users');accessUsers=data.items;accessError('admin-access-error','');renderAccessUsers();}
 catch(error){accessError('admin-access-error',error.message);}
}
function renderAccessSettings(){
 const enabled=Boolean(accessSettings.autoApprove);
 accessEl('auto-approve-state').textContent=enabled?'On':'Off';
 accessEl('auto-approve-label').textContent=enabled?'On':'Off';
 accessEl('auto-approve-label').className=`tab-access-state ${enabled?'is-open':'is-restricted'}`;
 accessEl('auto-approve-toggle').textContent=enabled?'Turn off':'Turn on';
 accessEl('auto-approve-toggle').className=enabled?'tab-restrict':'primary';
}
async function loadAccessSettings(){
 try{const data=await accessJson('/api/access/settings');accessSettings=data;accessError('access-settings-error','');renderAccessSettings();}
 catch(error){accessError('access-settings-error',error.message);}
}
function renderAdminAccessRequests(){
 accessEl('admin-request-count').textContent=adminAccessRequests.length;
 const list=accessEl('admin-request-list');list.replaceChildren();
 if(!adminAccessRequests.length){const empty=document.createElement('p');empty.className='management-empty';empty.textContent='No Admin access requests.';list.append(empty);return;}
 for(const request of adminAccessRequests){
  const row=document.createElement('div'),email=document.createElement('strong'),actions=document.createElement('div');
  row.className='access-user';email.textContent=request.email;actions.className='access-user-actions';
  for(const [action,label] of [['approve','Approve'],['deny','Deny']]){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.addEventListener('click',async()=>{
   for(const control of actions.querySelectorAll('button'))control.disabled=true;accessError('admin-request-error','');
   try{await accessJson('/api/admin-access-requests',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:request.email,action})});adminAccessRequests=adminAccessRequests.filter(item=>item.email!==request.email);renderAdminAccessRequests();if(action==='approve')loadCoadmins();}
   catch(error){accessError('admin-request-error',error.message);for(const control of actions.querySelectorAll('button'))control.disabled=false;}
  });actions.append(button);}
  row.append(identity,actions);list.append(row);
 }
}
async function loadAdminAccessRequests(){
 try{const data=await accessJson('/api/admin-access-requests');adminAccessRequests=data.items;accessError('admin-request-error','');renderAdminAccessRequests();}
 catch(error){accessError('admin-request-error',error.message);}
}
function renderChangeRequests(){
 accessEl('change-count').textContent=changeRequests.length;
 const list=accessEl('change-requests');list.replaceChildren();
 if(!changeRequests.length){const empty=document.createElement('p');empty.textContent='No company changes awaiting review.';list.append(empty);return;}
 const names={name:'Company name',linkedin:'LinkedIn',careers:'Careers portal',category:'Category'};
 for(const item of changeRequests){
  const row=document.createElement('div'),title=document.createElement('div'),meta=document.createElement('div'),actions=document.createElement('div');
  row.className='change-request';title.className='change-request-title';meta.className='change-request-meta';actions.className='change-actions';
  title.textContent=item.company_name;meta.textContent=`${item.actor_email} · ${item.kind==='move'?'Move':item.kind==='add'?'Add company':'Edit'}`;row.append(title,meta);
  for(const [field,to] of Object.entries(item.after)){
   const line=document.createElement('p');line.className='change-diff';const from=item.before[field]||'Empty';
   line.textContent=item.kind==='move'?`Moving: ${from} → ${to}`:item.kind==='add'?`${names[field]||field}: ${to||'Empty'}`:`${names[field]||field}: ${from} → ${to||'Empty'}`;row.append(line);
  }
  for(const [action,label] of [['approve','Approve'],['deny','Deny']]){
   const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;
   button.addEventListener('click',async()=>{
    for(const control of actions.querySelectorAll('button'))control.disabled=true;accessError('change-error','');
    try{await accessJson('/api/review/changes',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action})});changeRequests=changeRequests.filter(r=>r.id!==item.id);renderChangeRequests();if(action==='approve')window.refreshDirectory?.();}
    catch(error){accessError('change-error',error.message);for(const control of actions.querySelectorAll('button'))control.disabled=false;}
   });actions.append(button);
  }
  row.append(actions);list.append(row);
 }
}
async function loadChangeRequests(){
 try{const data=await accessJson('/api/review/changes');changeRequests=data.items;accessError('change-error','');renderChangeRequests();}
 catch(error){accessError('change-error',error.message);}
}
function renderCoadmins(){
 const list=accessEl('coadmin-list');list.replaceChildren();
 accessEl('coadmin-count').textContent=coadmins.length;
 if(!coadmins.length){const empty=document.createElement('p');empty.textContent='No Coadmins yet.';list.append(empty);return;}
 for(const user of coadmins){
  const row=document.createElement('div'),email=document.createElement('strong'),actions=document.createElement('div'),button=document.createElement('button');
  row.className='access-user';email.textContent=user.email;actions.className='access-user-actions';button.textContent='Remove Coadmin';button.type='button';
  button.addEventListener('click',async()=>{button.disabled=true;accessError('coadmin-error','');
   try{await accessJson('/api/coadmins',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email})});coadmins=coadmins.filter(u=>u.email!==user.email);renderCoadmins();}
   catch(error){accessError('coadmin-error',error.message);button.disabled=false;}
  });actions.append(button);row.append(identity,actions);list.append(row);
 }
}
async function loadCoadmins(){
 if(accessSession.role!=='admin')return;
 try{const data=await accessJson('/api/coadmins');coadmins=data.items;accessError('coadmin-error','');renderCoadmins();}
 catch(error){accessError('coadmin-error',error.message);}
}
function renderSectionSubmissions(){
 accessEl('section-review-count').textContent=sectionSubmissions.length;
 const list=accessEl('section-review-list');list.replaceChildren();
 if(!sectionSubmissions.length){const empty=document.createElement('p');empty.textContent='No submissions awaiting review.';list.append(empty);return;}
 for(const item of sectionSubmissions){
  const row=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('p'),actions=document.createElement('div');
  row.className='change-request';title.textContent=item.title||'Entry without a name';meta.className='change-request-meta';meta.textContent=`${item.actor_email} · ${item.section.replaceAll('-',' ')} · ${item.category}`;actions.className='change-actions';row.append(title,meta);
  for(const value of [item.organization,item.email,item.phone&&`${item.phone}${item.extension?` ext. ${item.extension}`:''}`,item.details,item.posted_at])if(value){const p=document.createElement('p');p.className='change-diff';p.textContent=value;row.append(p);}
  if(item.url){const a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.url;row.append(a);}
  if(item.file_name){const a=document.createElement('a');a.href=`/api/section-file/${encodeURIComponent(item.id)}`;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`Download ${item.file_name}`;row.append(a);}
  for(const [action,label] of [['approve','Approve'],['deny','Deny']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{
   for(const control of actions.querySelectorAll('button'))control.disabled=true;accessError('section-review-error','');
   try{await accessJson('/api/review/section-items',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action})});sectionSubmissions=sectionSubmissions.filter(entry=>entry.id!==item.id);renderSectionSubmissions();}
   catch(error){accessError('section-review-error',error.message);for(const control of actions.querySelectorAll('button'))control.disabled=false;}
  });actions.append(button);}row.append(actions);list.append(row);
 }
}
async function loadSectionSubmissions(){try{const data=await accessJson('/api/review/section-items');sectionSubmissions=data.items;accessError('section-review-error','');renderSectionSubmissions();}catch(error){accessError('section-review-error',error.message);}}
function renderSectionChanges(){
 accessEl('section-change-count').textContent=sectionChanges.length;
 const list=accessEl('section-change-list');list.replaceChildren();
 if(!sectionChanges.length){const empty=document.createElement('p');empty.className='management-empty';empty.textContent='No section changes awaiting review.';list.append(empty);return;}
 const labels={title:'Name',organization:'Company or source',url:'Link',details:'Details',email:'Email',phone:'Number',extension:'Ext',posted_at:'Posted date',file_name:'Uploaded file',category:'Category'};
 for(const item of sectionChanges){
  const row=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('p'),actions=document.createElement('div');
  row.className='change-request';title.textContent=item.before.title||'Entry without a name';meta.className='change-request-meta';meta.textContent=`${item.actor_email} · ${item.before.section.replaceAll('-',' ')} · ${item.kind}`;actions.className='change-actions';row.append(title,meta);
  if(item.kind==='delete'){const line=document.createElement('p');line.className='change-diff';line.textContent=`Delete from ${item.before.category}`;row.append(line);}
  else for(const [field,value] of Object.entries(item.after)){
   if(!Object.hasOwn(labels,field)||value===item.before[field])continue;
   const line=document.createElement('p');line.className='change-diff';line.textContent=`${labels[field]}: ${item.before[field]||'Empty'} → ${value||'Empty'}`;row.append(line);
  }
  if(item.pending_file_key){const link=document.createElement('a');link.href=`/api/section-change-file/${encodeURIComponent(item.id)}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`Download proposed ${item.after.file_name}`;row.append(link);}
  for(const [action,label] of [['approve','Approve'],['deny','Deny']]){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.addEventListener('click',async()=>{
   for(const control of actions.querySelectorAll('button'))control.disabled=true;accessError('section-change-error','');
   try{await accessJson('/api/review/section-changes',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action})});sectionChanges=sectionChanges.filter(entry=>entry.id!==item.id);renderSectionChanges();}
   catch(error){accessError('section-change-error',error.message);for(const control of actions.querySelectorAll('button'))control.disabled=false;}
  });actions.append(button);}row.append(actions);list.append(row);
 }
}
async function loadSectionChanges(){try{const data=await accessJson('/api/review/section-changes');sectionChanges=data.items;accessError('section-change-error','');renderSectionChanges();}catch(error){accessError('section-change-error',error.message);}}
function renderTabAccess(){
 const list=accessEl('tab-access-list');list.replaceChildren();
 accessEl('tab-access-count').textContent=`${tabAccessItems.filter(item=>item.allowed).length} open`;
 for(const item of tabAccessItems){
  const row=document.createElement('div');row.className='tab-access-row';
  const info=document.createElement('div'),name=document.createElement('strong'),state=document.createElement('span');
  name.textContent=item.name;state.className=`tab-access-state ${item.allowed?'is-open':'is-restricted'}`;state.textContent=item.allowed?'Open':'Restricted';info.append(name,state);
  const button=document.createElement('button');button.type='button';button.className=item.allowed?'tab-restrict':'primary';button.textContent=item.allowed?'Restrict access':'Allow access';
  button.setAttribute('aria-label',`${item.allowed?'Restrict':'Allow'} ${item.name}`);
  button.addEventListener('click',async()=>{
   button.disabled=true;accessError('tab-access-error','');
   try{const updated=await accessJson('/api/tab-access',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({tab:item.tab,allowed:!item.allowed})});Object.assign(item,updated);renderTabAccess();window.showAppNotice?.(`${item.name} is now ${item.allowed?'open':'restricted'} for users.`);}
   catch(error){accessError('tab-access-error',error.message);button.disabled=false;}
  });
  row.append(info,button);list.append(row);
 }
}
async function loadTabAccess(){
 try{const data=await accessJson('/api/tab-access');tabAccessItems=data.items;accessError('tab-access-error','');renderTabAccess();}
 catch(error){accessError('tab-access-error',error.message);}
}
function loadAdminData(){loadAnalytics();loadAccessUsers();loadAccessSettings();loadAdminAccessRequests();loadChangeRequests();loadSectionSubmissions();loadSectionChanges();loadCoadmins();loadTabAccess();}
accessEl('auto-approve-toggle').addEventListener('click',async()=>{
 const button=accessEl('auto-approve-toggle');button.disabled=true;accessError('access-settings-error','');
 try{accessSettings=await accessJson('/api/access/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({autoApprove:!accessSettings.autoApprove})});renderAccessSettings();window.showAppNotice?.(`Auto approve new users is now ${accessSettings.autoApprove?'on':'off'}.`);}
 catch(error){accessError('access-settings-error',error.message);}
 finally{button.disabled=false;}
});
accessEl('coadmin-form').addEventListener('submit',async event=>{
 event.preventDefault();const submit=accessEl('coadmin-form').querySelector('[type=submit]');submit.disabled=true;accessError('coadmin-error','');
 try{const result=await accessJson('/api/coadmins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:accessEl('coadmin-email').value.trim()})});coadmins.unshift(result);accessEl('coadmin-email').value='';renderCoadmins();loadAccessUsers();}
 catch(error){accessError('coadmin-error',error.message);}finally{submit.disabled=false;}
});
accessEl('access-form').addEventListener('submit',async event=>{
 event.preventDefault();const submit=accessEl('access-form').querySelector('[type=submit]');submit.disabled=true;accessEl('access-login').disabled=true;accessError('access-error','');
 try{const name=accessEl('access-name').value.trim().replace(/\s+/g,' ');if(!name){accessEl('access-name').focus();throw Error('Enter your name to request access.');}accessSession=await accessJson('/api/access/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email:accessEl('access-email').value.trim()})});showAccessState();}
 catch(error){accessError('access-error',error.message);}finally{submit.disabled=false;accessEl('access-login').disabled=false;}
});
accessEl('access-login').addEventListener('click',async()=>{
 const email=accessEl('access-email');if(!email.reportValidity())return;
 const button=accessEl('access-login');button.disabled=true;accessEl('access-form').querySelector('[type=submit]').disabled=true;accessError('access-error','');
 try{accessSession=await accessJson('/api/access/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim()})});showAccessState();}
 catch(error){accessError('access-error',error.message);}finally{button.disabled=false;accessEl('access-form').querySelector('[type=submit]').disabled=false;}
});
accessEl('access-change').addEventListener('click',async()=>{
 try{await accessJson('/api/logout',{method:'POST'});accessSession={role:'guest',status:'none'};accessEl('access-email').value='';accessEl('access-name').value='';showAccessState();accessEl('access-name').focus();}
 catch(error){accessError('access-error',error.message);}
});
accessEl('user-logout').addEventListener('click',async()=>{
 const button=accessEl('user-logout');button.disabled=true;
 try{await accessJson('/api/logout',{method:'POST'});location.reload();}
 catch(error){const status=accessEl('save-status');status.textContent=error.message;status.hidden=false;button.disabled=false;}
});
accessEl('admin-open').addEventListener('click',async()=>{
 if(managesAccess()){
  try{await accessJson('/api/logout',{method:'POST'});location.reload();}catch(error){accessError('admin-access-error',error.message);}
  return;
 }
 accessEl('admin-email').value='';accessError('admin-error','');accessEl('admin-dialog').showModal();accessEl('admin-email').focus();
});
accessEl('admin-cancel').addEventListener('click',()=>accessEl('admin-dialog').close());
accessEl('admin-form').addEventListener('submit',async event=>{
 event.preventDefault();const submit=accessEl('admin-form').querySelector('[type=submit]');submit.disabled=true;accessError('admin-error','');
 try{accessSession=await accessJson('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:accessEl('admin-email').value.trim()})});accessEl('admin-dialog').close();showAccessState();}
 catch(error){accessError('admin-error',error.message);}finally{submit.disabled=false;}
});
showAccessState();checkAccess();setInterval(()=>{checkAccess();if(adminPage&&managesAccess())loadAdminData();},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAccess();});
