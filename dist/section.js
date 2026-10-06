const sectionConfig={
 'recruiter-directory':{title:'Recruiter Directory',action:'Add recruiter',name:'Name',organization:'Company',url:'LinkedIn'},
 'latest-posted-jobs':{title:'Latest Posted Jobs',action:'',name:'Job title',organization:'Company',url:'Job posting link'},
 'study-materials':{title:'Study Materials',action:'Add material',name:'Name',organization:'',url:'Link'},
 'interview-prep':{title:'Interview Prep',action:'Add DOCs',name:'Name',organization:'',url:'Link'},
 'interview-support':{title:'Interview Support',action:'Add contact',name:'Contact name',organization:'',url:''}
};
const sectionKey=location.pathname.split('/').filter(Boolean)[0]||'recruiter-directory';
const config=sectionConfig[sectionKey];
const byId=id=>document.getElementById(id);
let tabs=[...document.querySelectorAll('.section-tabs [role="tab"]')];
let automaticRefreshAttempted=false;
let category='java',requestNumber=0,searchTimer,editingItem=null,deletingItem=null,actionItem=null,accessRole='user';
byId('section-title').textContent=config.title;document.title=`${config.title} — CareerNaviq`;
byId('section-add').textContent=config.action;byId('section-dialog-title').textContent=config.action;
byId('section-add').hidden=!config.action;
byId('section-title-label').textContent=config.name;byId('section-organization-label').textContent=config.organization;byId('section-url-label').textContent=config.url;
const isRecruiter=sectionKey==='recruiter-directory',isDocument=sectionKey==='study-materials'||sectionKey==='interview-prep',isContact=sectionKey==='interview-support';
for(const optionalTab of ['tab-all','tab-mylist']){if(byId(optionalTab)){byId(optionalTab).hidden=!isRecruiter;if(!isRecruiter)tabs=tabs.filter(tab=>tab.id!==optionalTab);}}
byId('section-organization-wrap').hidden=!config.organization;byId('section-organization').required=false;
byId('section-url-wrap').hidden=!config.url;
byId('section-email-wrap').hidden=!isRecruiter;
byId('section-phone-wrap').hidden=!(isRecruiter||isContact);byId('section-phone').required=false;
byId('section-ext-wrap').hidden=!isRecruiter;
byId('section-details-wrap').hidden=!isContact;byId('section-details').required=false;
byId('section-file-wrap').hidden=!isDocument;
byId('section-search').placeholder=`Search ${config.title.toLowerCase()}`;
byId('date-filter-wrap').hidden=true;
byId('job-company-filter-wrap').hidden=true;
byId('job-page-filter-wrap').hidden=true;
byId('job-min-years-wrap').hidden=true;
byId('job-max-years-wrap').hidden=true;
byId('job-generate').hidden=true;
document.querySelector('.section-toolbar').hidden=sectionKey==='latest-posted-jobs';
byId('section-posted-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('section-posted').required=false;
function status(message){byId('section-status').textContent=message;}
function sectionNotice(message){status(message);window.showAppNotice?.(message);}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});const result=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');return result;}
let sectionMenuTrigger=null;
function actionButton(item){const button=document.createElement('button');button.type='button';button.className='more-button section-more';button.textContent='⋮';button.setAttribute('aria-label',`Actions for ${item.title||'entry'}`);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>{if(sectionMenuTrigger===button&&!byId('section-actions-menu').hidden){closeActions(true);return;}openActions(item,button);});return button;}
function favoriteButton(item){const button=document.createElement('button');button.type='button';button.className='save-company section-favorite';const update=saved=>{button.textContent=saved?'★':'☆';button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',`${saved?'Remove':'Save'} ${item.title||'recruiter'} ${saved?'from':'to'} My List`);button.title=saved?'Remove from My List':'Save to My List';};update(Boolean(item.is_favorite));button.addEventListener('click',async()=>{const saved=button.getAttribute('aria-pressed')!=='true';button.disabled=true;try{const result=await api('/api/section-favorites',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,saved})});item.is_favorite=result.saved?1:0;update(result.saved);sectionNotice(result.saved?'Recruiter saved to My List.':'Recruiter removed from My List.');if(category==='mylist'&&!result.saved)loadItems();}catch(error){sectionNotice(error.message);}finally{button.disabled=false;}});return button;}
function closeActions(restore=false){byId('section-actions-menu').hidden=true;byId('section-move-targets').hidden=true;byId('section-action-move').setAttribute('aria-expanded','false');sectionMenuTrigger?.setAttribute('aria-expanded','false');if(restore&&sectionMenuTrigger?.isConnected)sectionMenuTrigger.focus();}
function positionActions(){if(!sectionMenuTrigger)return;const bounds=sectionMenuTrigger.getBoundingClientRect(),menu=byId('section-actions-menu');menu.style.left=Math.max(8,Math.min(bounds.right-menu.offsetWidth,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(bounds.bottom+5,innerHeight-menu.offsetHeight-8))+'px';}
function openActions(item,trigger){
 closeActions();actionItem=item;sectionMenuTrigger=trigger;trigger.setAttribute('aria-expanded','true');
 const targets=byId('section-move-targets');targets.replaceChildren();
 for(const target of (isRecruiter?['java','data','devops','validation','all']:['java','data','devops','validation'])){
  if(target===item.category)continue;
  const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=target==='devops'?'DevOps':target.charAt(0).toUpperCase()+target.slice(1);
  button.addEventListener('click',async()=>{button.disabled=true;try{const result=await api('/api/section-changes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,version:item.version,kind:'move',category:target})});closeActions(true);sectionNotice(result.status==='approved'?'Entry moved successfully.':'Move request sent for approval. An Admin or Coadmin will review it.');if(result.status==='approved')loadItems();}catch(error){closeActions(true);sectionNotice(error.message);button.disabled=false;}});
  targets.append(button);
 }
 byId('section-actions-menu').hidden=false;positionActions();byId('section-action-edit').focus({preventScroll:true});
}
byId('section-action-move').addEventListener('click',()=>{const open=byId('section-move-targets').hidden;byId('section-move-targets').hidden=!open;byId('section-action-move').setAttribute('aria-expanded',String(open));positionActions();if(open)byId('section-move-targets').querySelector('button')?.focus();});
document.addEventListener('click',event=>{if(!byId('section-actions-menu').contains(event.target)&&!event.target.closest('.section-more'))closeActions();});
byId('section-actions-menu').addEventListener('keydown',event=>{const items=[...byId('section-actions-menu').querySelectorAll('button')].filter(button=>!button.parentElement.hidden);const index=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();closeActions(true);}else if(event.key==='Tab')closeActions();else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}else if(event.key==='ArrowRight'&&document.activeElement===byId('section-action-move')){event.preventDefault();byId('section-action-move').click();}else if(event.key==='ArrowLeft'&&!byId('section-move-targets').hidden){event.preventDefault();byId('section-move-targets').hidden=true;byId('section-action-move').setAttribute('aria-expanded','false');byId('section-action-move').focus();}});
window.addEventListener('resize',()=>closeActions());window.addEventListener('scroll',()=>{if(!byId('section-actions-menu').hidden)positionActions();},true);
const tableColumns={
 'recruiter-directory':[['Name','title'],['Company','organization'],['LinkedIn','url'],['Mail','email'],['Number','phone'],['Ext','extension']],
 'study-materials':[['Name','title'],['Link','url'],['Upload Material','file_name']],
 'interview-prep':[['Name','title'],['Link','url'],['Upload Material','file_name']],
 'interview-support':[['Contact Name','title'],['Number','phone'],['Details','details']]
};
function renderTable(items){
 const list=byId('section-items');list.replaceChildren();list.classList.add('section-records');
 const table=document.createElement('table'),head=document.createElement('thead'),headRow=document.createElement('tr'),body=document.createElement('tbody');
 const columns=tableColumns[sectionKey];
 if(isRecruiter){const favoriteHeading=document.createElement('th');favoriteHeading.scope='col';favoriteHeading.className='section-favorite-heading';favoriteHeading.textContent='My List';headRow.append(favoriteHeading);}
 for(const [label] of columns){const cell=document.createElement('th');cell.scope='col';cell.textContent=label;headRow.append(cell);}
 const actionHeading=document.createElement('th');actionHeading.scope='col';actionHeading.className='section-action-heading';actionHeading.textContent='Actions';headRow.append(actionHeading);
 head.append(headRow);
 if(!items.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=columns.length+1+(isRecruiter?1:0);cell.className='section-table-empty';cell.textContent=category==='mylist'?'Your recruiter list is empty. Select the star beside any recruiter to save it here.':'No entries yet.';row.append(cell);body.append(row);}
 for(const item of items){
  const row=document.createElement('tr');
  if(isRecruiter){const favoriteCell=document.createElement('td');favoriteCell.className='section-favorite-cell';favoriteCell.append(favoriteButton(item));row.append(favoriteCell);}
  for(const [,field] of columns){
   const cell=document.createElement('td'),value=item[field]||'';
   if(field==='url'&&value){const link=document.createElement('a');link.href=value;link.target='_blank';link.rel='noopener noreferrer';link.textContent=sectionKey==='recruiter-directory'?'LinkedIn ↗':'Open link ↗';cell.append(link);}
   else if(field==='email'&&value){const link=document.createElement('a');link.href=`mailto:${value}`;link.textContent=value;cell.append(link);}
   else if(field==='phone'&&value){const link=document.createElement('a');link.href=`tel:${value.replace(/[^+\d]/g,'')}`;link.textContent=value;cell.append(link);}
   else if(field==='file_name'&&value){const link=document.createElement('a');link.href=`/api/section-file/${encodeURIComponent(item.id)}`;link.textContent=value;cell.append(link);}
   else cell.textContent=value||'—';
   row.append(cell);
  }
  const actionCell=document.createElement('td');actionCell.className='section-action-cell';actionCell.append(actionButton(item));row.append(actionCell);
  body.append(row);
 }
 table.append(head,body);list.append(table);
}
function render(items){
 const list=byId('section-items');list.replaceChildren();
 if(tableColumns[sectionKey]){renderTable(items);return;}
 list.classList.remove('section-records');
 if(!items.length){const empty=document.createElement('p');empty.className='section-empty';empty.textContent='No entries yet.';list.append(empty);return;}
 for(const item of items){
  const card=document.createElement('article');card.className='section-item';
  const heading=document.createElement('h2');heading.textContent=item.title;card.append(heading);
  if(item.organization){const organization=document.createElement('p');organization.className='section-organization';organization.textContent=item.organization;card.append(organization);}
  if(item.details){const details=document.createElement('p');details.textContent=item.details;card.append(details);}
  if(item.email){const email=document.createElement('a');email.href=`mailto:${item.email}`;email.textContent=item.email;card.append(email);}
  if(item.phone){const phone=document.createElement('p');phone.textContent=`${item.phone}${item.extension?` ext. ${item.extension}`:''}`;card.append(phone);}
  if(item.posted_at){const date=document.createElement('time');date.dateTime=item.posted_at;date.textContent=`Posted ${new Date(item.posted_at).toLocaleString()}`;card.append(date);}
  if(item.url){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open link ↗';card.append(link);}
  if(item.file_name){const file=document.createElement('a');file.href=`/api/section-file/${encodeURIComponent(item.id)}`;file.textContent=`Download ${item.file_name}`;card.append(file);}
  card.append(actionButton(item));
  list.append(card);
 }
}
function renderJobs(items,awaitingGeneration=false){
 const list=byId('section-items');list.replaceChildren();list.classList.add('section-records','job-records');
 const table=document.createElement('table'),head=document.createElement('thead'),row=document.createElement('tr'),body=document.createElement('tbody');
 for(const label of ['Job title','Company','Posted date','Apply']){const cell=document.createElement('th');cell.scope='col';cell.textContent=label;row.append(cell);}head.append(row);
 if(!items.length){const empty=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.className='section-table-empty';cell.textContent=awaitingGeneration?'Refreshing...':'No matching jobs found yet.';empty.append(cell);body.append(empty);}
 for(const item of items){
  const tr=document.createElement('tr'),title=document.createElement('td'),company=document.createElement('td'),date=document.createElement('td'),apply=document.createElement('td');
  title.textContent=item.title;company.textContent=item.company_name;
  if(item.posted_at){const time=document.createElement('time');time.dateTime=item.posted_at;time.textContent=new Date(item.posted_at+'T12:00:00').toLocaleDateString();date.append(time);}else date.textContent='Date unavailable';
  const link=document.createElement('a');link.href=item.apply_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Apply ↗';apply.append(link);
  tr.append(title,company,date,apply);body.append(tr);
 }
 table.append(head,body);list.append(table);
}
async function loadItems(){
 const current=++requestNumber,params=new URLSearchParams({section:sectionKey,category,search:byId('section-search').value.trim(),window:'all'});
 status('Loading…');
 try{
  if(current!==requestNumber)return;
  if(sectionKey==='latest-posted-jobs'){
   const data=await api('/api/jobs/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category,window:'all',search:'',minYears:null,maxYears:null})});
   if(current!==requestNumber)return;renderJobs(data.items);if(!automaticRefreshAttempted&&!data.source?.checked_at){automaticRefreshAttempted=true;setTimeout(()=>refreshJobs(category),0);}status(data.source?.status==='refreshing'?'Loading...':`${data.items.length} ${category==='devops'?'DevOps':category.charAt(0).toUpperCase()+category.slice(1)} jobs${data.source?.checked_at?' · Last refreshed '+new Date(data.source.checked_at).toLocaleString():''}.${data.source?.status==='error'?' Refresh failed; showing saved jobs.':''}`);return data.items.length;
  }
  const data=await api(`/api/section-items?${params}`);if(current!==requestNumber)return;
  render(data.items);status(`${data.items.length} entries`);
 }
 catch(error){if(current===requestNumber)status(error.message);}
}
function selectTab(tab){category=tab.id.slice(4);for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;item.disabled=sectionKey==='latest-posted-jobs'&&selected;}byId('section-panel').setAttribute('aria-labelledby',tab.id);byId('section-search').value='';byId('date-filter').value='all';if(sectionKey==='latest-posted-jobs')refreshJobs(category);else loadItems();}
for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;event.preventDefault();const next=tabs[(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];selectTab(next);next.focus();});}
byId('section-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadItems,250);});
byId('date-filter').addEventListener('change',loadItems);
for(const id of ['job-min-years','job-max-years'])byId(id).addEventListener('change',loadItems);
async function refreshJobs(targetCategory=category){
 const activeTab=byId(`tab-${targetCategory}`);for(const tab of tabs)tab.disabled=sectionKey==='latest-posted-jobs';
 renderJobs([],true);status('Refreshing...');
 try{const result=await api('/api/jobs/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await loadItems();window.showAppNotice?.(result.message);}
 catch(error){await loadItems();status(`Refresh failed: ${error.message} Saved jobs remain available.`);}
 finally{for(const tab of tabs)tab.disabled=false;activeTab?.setAttribute('aria-selected','true');}
}
byId('job-generate').addEventListener('click',refreshJobs);
if(sectionKey==='latest-posted-jobs')setInterval(()=>{if(!document.hidden)loadItems();},240000);
function openForm(item=null){
 editingItem=item;byId('section-form').reset();byId('section-form-error').hidden=true;
 byId('section-dialog-title').textContent=item?`Edit ${item.title||'entry'}`:config.action;
 byId('section-form-note').hidden=accessRole!=='user';
 byId('section-form-note').textContent=item?'Edits require Admin approval before they appear for everyone.':'Your submission will appear after Admin approval.';
 byId('section-existing-file').hidden=!item?.file_name;
 byId('section-existing-file').textContent=item?.file_name?`Current file: ${item.file_name}. Upload a new file to replace it after approval.`:'';
 if(item){
  byId('section-title-input').value=item.title;byId('section-organization').value=item.organization||'';
  byId('section-url').value=item.url||'';byId('section-details').value=item.details||'';
  byId('section-email').value=item.email||'';byId('section-phone').value=item.phone||'';byId('section-ext').value=item.extension||'';
  if(item.posted_at){const date=new Date(item.posted_at);byId('section-posted').value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
 }
 byId('section-dialog').showModal();byId('section-title-input').focus();
}
byId('section-add').addEventListener('click',()=>openForm());
byId('section-action-edit').addEventListener('click',()=>{const item=actionItem;closeActions();openForm(item);});
byId('section-action-delete').addEventListener('click',()=>{deletingItem=actionItem;closeActions();byId('section-delete-description').textContent=`Delete ${deletingItem.title}?`;byId('section-delete-error').hidden=true;byId('section-delete-dialog').showModal();});
byId('section-delete-cancel').addEventListener('click',()=>byId('section-delete-dialog').close());
byId('section-delete-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;byId('section-delete-error').hidden=true;
 try{const result=await api('/api/section-changes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:deletingItem.id,version:deletingItem.version,kind:'delete'})});byId('section-delete-dialog').close();sectionNotice(result.status==='approved'?'Entry deleted successfully.':'Deletion request sent for approval. An Admin or Coadmin will review it.');if(result.status==='approved')loadItems();}
 catch(error){byId('section-delete-error').textContent=error.message;byId('section-delete-error').hidden=false;}finally{button.disabled=false;}
});
byId('section-cancel').addEventListener('click',()=>byId('section-dialog').close());
byId('section-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;byId('section-form-error').hidden=true;
 const postedValue=byId('section-posted').value;
 const input={section:sectionKey,category,title:byId('section-title-input').value,organization:byId('section-organization').value,url:byId('section-url').value,details:byId('section-details').value,email:byId('section-email').value,phone:byId('section-phone').value,extension:byId('section-ext').value,postedAt:postedValue?new Date(postedValue).toISOString():''};
 const file=byId('section-file').files[0];
  if(file&&file.size>10*1024*1024){byId('section-form-error').textContent='Choose a file smaller than 10 MB.';byId('section-form-error').hidden=false;button.disabled=false;return;}
 const changing=Boolean(editingItem),url=changing?'/api/section-changes':'/api/section-items';
 if(changing)Object.assign(input,{id:editingItem.id,version:editingItem.version,kind:'edit'});
 let options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)};
 if(file){const formData=new FormData();for(const [key,value] of Object.entries(input))formData.append(key,value);formData.append('file',file);options={method:'POST',body:formData};}
 try{const result=await api(url,options);byId('section-dialog').close();sectionNotice(result.pending||result.status==='pending'?'Sent for approval. An Admin or Coadmin will review your changes.':changing?'Entry updated successfully.':'Added successfully.');if(result.status==='approved')loadItems();editingItem=null;}
 catch(error){byId('section-form-error').textContent=error.message;byId('section-form-error').hidden=false;}finally{button.disabled=false;}
});
byId('section-logout').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});location.replace('/');}catch(error){status(error.message);}});
api('/api/session').then(session=>{if(session.status!=='approved'){location.replace('/');return;}accessRole=session.role;document.body.classList.add('has-access');byId('recruiter-page').hidden=false;byId('section-role').textContent=session.role==='admin'?'Admin':session.role==='coadmin'?'Coadmin':'User';byId('section-form-note').hidden=session.role!=='user';loadItems();}).catch(()=>location.replace('/'));
