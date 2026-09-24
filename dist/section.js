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
const tabs=[...document.querySelectorAll('.section-tabs [role="tab"]')];
let category='java',requestNumber=0,searchTimer,editingItem=null,deletingItem=null,actionItem=null,accessRole='user';
byId('section-title').textContent=config.title;document.title=`${config.title} — CareerNaviq`;
byId('section-add').textContent=config.action;byId('section-dialog-title').textContent=config.action;
byId('section-add').hidden=!config.action;
byId('section-title-label').textContent=config.name;byId('section-organization-label').textContent=config.organization;byId('section-url-label').textContent=config.url;
const isRecruiter=sectionKey==='recruiter-directory',isDocument=sectionKey==='study-materials'||sectionKey==='interview-prep',isContact=sectionKey==='interview-support';
byId('section-organization-wrap').hidden=!config.organization;byId('section-organization').required=false;
byId('section-url-wrap').hidden=!config.url;
byId('section-email-wrap').hidden=!isRecruiter;
byId('section-phone-wrap').hidden=!(isRecruiter||isContact);byId('section-phone').required=false;
byId('section-ext-wrap').hidden=!isRecruiter;
byId('section-details-wrap').hidden=!isContact;byId('section-details').required=false;
byId('section-file-wrap').hidden=!isDocument;
byId('section-search').placeholder=`Search ${config.title.toLowerCase()}`;
byId('date-filter-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('job-company-filter-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('job-page-filter-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('job-generate').hidden=sectionKey!=='latest-posted-jobs';
byId('section-posted-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('section-posted').required=false;
function status(message){byId('section-status').textContent=message;}
function sectionNotice(message){status(message);window.showAppNotice?.(message);}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});const result=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');return result;}
const jobPageSize=100,jobSavedKey='employer-directory-my-list-v1';
let jobCompanies=null;
function savedCompanyIds(){try{const value=JSON.parse(localStorage.getItem(jobSavedKey)||'[]');return new Set(Array.isArray(value)?value:[]);}catch{return new Set();}}
function jobGroupCompanies(){
 const group=byId('job-company-filter').value,saved=savedCompanyIds();
 return (jobCompanies||[]).filter(company=>group==='mylist'?saved.has(company.id):company.category===group);
}
function updateJobPages(){
 const select=byId('job-page-filter'),previous=select.value,companies=jobGroupCompanies();
 select.replaceChildren();
 for(let page=0;page<Math.max(1,Math.ceil(companies.length/jobPageSize));page++){
  const option=document.createElement('option');option.value=String(page);
  const start=page*jobPageSize+1,end=Math.min((page+1)*jobPageSize,companies.length);
  option.textContent=`Page ${page+1}${companies.length?` (${start}–${end})`:''}`;select.append(option);
 }
 select.value=[...select.options].some(option=>option.value===previous)?previous:'0';
 select.disabled=!companies.length;
}
async function loadJobCompanies(){
 const response=await fetch('/companies.json',{cache:'no-store'});if(!response.ok)throw Error('Could not load Employer Directory companies.');
 const base=await response.json(),added=[];let cursor=0;
 do{const data=await api('/api/companies'+(cursor?'?after='+cursor:''));added.push(...data.items);cursor=data.next;}while(cursor);
 const overrides=new Map();let after='';
 do{const data=await api('/api/changes'+(after?'?after='+encodeURIComponent(after):''));for(const item of data.items)overrides.set(item.id,item);after=data.next;}while(after);
 jobCompanies=[...base.map(row=>({id:row[0],name:row[0],category:row[3]})),...added.map(item=>({id:item.id,name:item.name,category:item.category}))]
  .filter(company=>!overrides.get(company.id)?.deleted)
  .map(company=>{const edit=overrides.get(company.id);return {...company,name:edit?.name||company.name,category:edit?.category||company.category};});
 updateJobPages();
}
function selectedJobCompanies(){const page=Number(byId('job-page-filter').value)||0;return jobGroupCompanies().slice(page*jobPageSize,(page+1)*jobPageSize);}
function jobCompanyKey(name){return String(name||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
let sectionMenuTrigger=null;
function actionButton(item){const button=document.createElement('button');button.type='button';button.className='more-button section-more';button.textContent='⋮';button.setAttribute('aria-label',`Actions for ${item.title||'entry'}`);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>{if(sectionMenuTrigger===button&&!byId('section-actions-menu').hidden){closeActions(true);return;}openActions(item,button);});return button;}
function closeActions(restore=false){byId('section-actions-menu').hidden=true;byId('section-move-targets').hidden=true;byId('section-action-move').setAttribute('aria-expanded','false');sectionMenuTrigger?.setAttribute('aria-expanded','false');if(restore&&sectionMenuTrigger?.isConnected)sectionMenuTrigger.focus();}
function positionActions(){if(!sectionMenuTrigger)return;const bounds=sectionMenuTrigger.getBoundingClientRect(),menu=byId('section-actions-menu');menu.style.left=Math.max(8,Math.min(bounds.right-menu.offsetWidth,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(bounds.bottom+5,innerHeight-menu.offsetHeight-8))+'px';}
function openActions(item,trigger){
 closeActions();actionItem=item;sectionMenuTrigger=trigger;trigger.setAttribute('aria-expanded','true');
 const targets=byId('section-move-targets');targets.replaceChildren();
 for(const target of ['java','data','devops','validation']){
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
 for(const [label] of columns){const cell=document.createElement('th');cell.scope='col';cell.textContent=label;headRow.append(cell);}
 const actionHeading=document.createElement('th');actionHeading.scope='col';actionHeading.className='section-action-heading';actionHeading.textContent='Actions';headRow.append(actionHeading);
 head.append(headRow);
 if(!items.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=columns.length+1;cell.className='section-table-empty';cell.textContent='No entries yet.';row.append(cell);body.append(row);}
 for(const item of items){
  const row=document.createElement('tr');
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
async function loadItems(){
 const current=++requestNumber,params=new URLSearchParams({section:sectionKey,category,search:byId('section-search').value.trim(),window:byId('date-filter').value});
 status('Loading…');
 try{
  if(sectionKey==='latest-posted-jobs'&&!jobCompanies)await loadJobCompanies();
  if(current!==requestNumber)return;
  const data=await api(`/api/section-items?${params}`);if(current!==requestNumber)return;
  const companies=sectionKey==='latest-posted-jobs'?selectedJobCompanies():null;
  const names=companies?new Set(companies.map(company=>jobCompanyKey(company.name))):null;
  const items=names?data.items.filter(item=>names.has(jobCompanyKey(item.organization))):data.items;
  render(items);
  status(`${items.length} ${items.length===1?'entry':'entries'}${companies?` from ${companies.length} companies on this Employer Directory page`:''}`);
 }
 catch(error){if(current===requestNumber)status(error.message);}
}
function selectTab(tab){category=tab.id.slice(4);for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;}byId('section-panel').setAttribute('aria-labelledby',tab.id);byId('section-search').value='';byId('date-filter').value='all';loadItems();}
for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;event.preventDefault();const next=tabs[(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];selectTab(next);next.focus();});}
byId('section-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadItems,250);});
byId('date-filter').addEventListener('change',loadItems);
byId('job-company-filter').addEventListener('change',()=>{byId('job-page-filter').value='0';updateJobPages();loadItems();});
byId('job-page-filter').addEventListener('change',loadItems);
byId('job-generate').addEventListener('click',()=>{
 const count=selectedJobCompanies().length;
 if(!jobCompanies){status('Company list is still loading. Please try again in a moment.');return;}
 status(count?`Selected ${count} companies. Automatic job collection is not connected yet; the results below show jobs already saved in the directory.`:'No companies are on this page. Choose another group or page.');
});
window.addEventListener('storage',event=>{if(sectionKey==='latest-posted-jobs'&&(event.key===jobSavedKey||event.key===null)){updateJobPages();loadItems();}});
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
