const accessEl=id=>document.getElementById(id);
let accessSession={role:'guest',status:'none'},accessUsers=[],accessTab='pending',appLoaded=false,checking=false;
window.directoryRole='guest';
async function accessJson(url,options){
 const response=await fetch(url,{cache:'no-store',...options});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Please try again.');
 return result;
}
function accessError(id,message){const el=accessEl(id);el.textContent=message;el.hidden=!message;}
function showAccessState(){
 const active=accessSession.status==='approved';
 window.directoryRole=active?accessSession.role:'guest';
 accessEl('access-gate').hidden=active;
 accessEl('directory-app').hidden=!active;
 accessEl('admin-dashboard').hidden=!active||accessSession.role!=='admin';
 accessEl('role-label').textContent=accessSession.role==='admin'?'Admin':'User';
 accessEl('admin-open').textContent=accessSession.role==='admin'?'Logout':'Admin';
 accessEl('admin-open').classList.toggle('is-admin',accessSession.role==='admin');
 accessEl('user-logout').hidden=!(active&&accessSession.role==='user');
 if(active){
  if(!appLoaded){appLoaded=true;const script=document.createElement('script');script.src='app.js';script.onerror=()=>accessError('admin-access-error','Could not load the directory. Refresh the page.');document.body.append(script);}
  else window.updateDirectoryRole?.();
  if(accessSession.role==='admin')loadAccessUsers();
  return;
 }
 const pending=accessSession.status==='pending',blocked=accessSession.status==='blocked';
 accessEl('access-form').hidden=pending||blocked;
 accessEl('access-change').hidden=!pending&&!blocked;
 accessEl('access-message').textContent=pending?`Awaiting access from Admin for ${accessSession.email}. This page will open after approval.`:blocked?`Access has been denied for ${accessSession.email}. Contact the Admin if you think this is a mistake.`:'Enter your Gmail to request access or log in if approved.';
}
async function checkAccess(){
 if(checking)return;checking=true;
 try{const next=await accessJson('/api/session');if(next.role!==accessSession.role||next.status!==accessSession.status||next.email!==accessSession.email){accessSession=next;showAccessState();}}
 catch{if(accessSession.role==='guest')accessError('access-error','Could not check access. Refresh the page.');}
 finally{checking=false;}
}
function renderAccessUsers(){
 for(const status of ['pending','approved','blocked'])accessEl('access-count-'+status).textContent=accessUsers.filter(u=>u.status===status).length;
 for(const button of document.querySelectorAll('[data-access-tab]'))button.classList.toggle('active',button.dataset.accessTab===accessTab);
 const list=accessEl('access-users');list.replaceChildren();
 const people=accessUsers.filter(u=>u.status===accessTab);
 if(!people.length){const empty=document.createElement('p');empty.textContent=accessTab==='pending'?'No access requests.':accessTab==='approved'?'No approved users yet.':'No blocked users.';list.append(empty);return;}
 for(const user of people){
  const row=document.createElement('div'),email=document.createElement('strong'),actions=document.createElement('div');
  row.className='access-user';email.textContent=user.email;actions.className='access-user-actions';
  const choices=accessTab==='pending'?[['approve','Approve'],['deny','Deny']]:accessTab==='approved'?[['block','Block']]:[['unblock','Unblock']];
  for(const [action,label] of choices){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.addEventListener('click',async()=>{
   button.disabled=true;accessError('admin-access-error','');
   try{const updated=await accessJson('/api/access/users',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,action})});user.status=updated.status;renderAccessUsers();}
   catch(error){accessError('admin-access-error',error.message);button.disabled=false;}
  });actions.append(button);}
  row.append(email,actions);list.append(row);
 }
}
async function loadAccessUsers(){
 try{const data=await accessJson('/api/access/users');accessUsers=data.items;accessError('admin-access-error','');renderAccessUsers();}
 catch(error){accessError('admin-access-error',error.message);}
}
for(const button of document.querySelectorAll('[data-access-tab]'))button.addEventListener('click',()=>{accessTab=button.dataset.accessTab;renderAccessUsers();});
accessEl('access-form').addEventListener('submit',async event=>{
 event.preventDefault();const submit=accessEl('access-form').querySelector('[type=submit]');submit.disabled=true;accessEl('access-login').disabled=true;accessError('access-error','');
 try{accessSession=await accessJson('/api/access/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:accessEl('access-email').value.trim()})});showAccessState();}
 catch(error){accessError('access-error',error.message);}finally{submit.disabled=false;accessEl('access-login').disabled=false;}
});
accessEl('access-login').addEventListener('click',async()=>{
 const email=accessEl('access-email');if(!email.reportValidity())return;
 const button=accessEl('access-login');button.disabled=true;accessEl('access-form').querySelector('[type=submit]').disabled=true;accessError('access-error','');
 try{accessSession=await accessJson('/api/access/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim()})});showAccessState();}
 catch(error){accessError('access-error',error.message);}finally{button.disabled=false;accessEl('access-form').querySelector('[type=submit]').disabled=false;}
});
accessEl('access-change').addEventListener('click',async()=>{
 try{await accessJson('/api/logout',{method:'POST'});accessSession={role:'guest',status:'none'};accessEl('access-email').value='';showAccessState();accessEl('access-email').focus();}
 catch(error){accessError('access-error',error.message);}
});
accessEl('user-logout').addEventListener('click',async()=>{
 const button=accessEl('user-logout');button.disabled=true;
 try{await accessJson('/api/logout',{method:'POST'});location.reload();}
 catch(error){const status=accessEl('save-status');status.textContent=error.message;status.hidden=false;button.disabled=false;}
});
accessEl('admin-open').addEventListener('click',async()=>{
 if(accessSession.role==='admin'){
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
showAccessState();checkAccess();setInterval(()=>{checkAccess();if(accessSession.role==='admin')loadAccessUsers();},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAccess();});
