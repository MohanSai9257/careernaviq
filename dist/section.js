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
let category='java',requestNumber=0,searchTimer;
byId('section-title').textContent=config.title;document.title=config.title;
byId('section-add').textContent=config.action;byId('section-dialog-title').textContent=config.action;
byId('section-add').hidden=!config.action;
byId('section-title-label').textContent=config.name;byId('section-organization-label').textContent=config.organization;byId('section-url-label').textContent=config.url;
const isRecruiter=sectionKey==='recruiter-directory',isDocument=sectionKey==='study-materials'||sectionKey==='interview-prep',isContact=sectionKey==='interview-support';
byId('section-organization-wrap').hidden=!config.organization;byId('section-organization').required=isRecruiter;
byId('section-url-wrap').hidden=!config.url;
byId('section-email-wrap').hidden=!isRecruiter;
byId('section-phone-wrap').hidden=!(isRecruiter||isContact);byId('section-phone').required=isContact;
byId('section-ext-wrap').hidden=!isRecruiter;
byId('section-details-wrap').hidden=!isContact;byId('section-details').required=isContact;
byId('section-file-wrap').hidden=!isDocument;
byId('section-search').placeholder=`Search ${config.title.toLowerCase()}`;
byId('date-filter-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('section-posted-wrap').hidden=sectionKey!=='latest-posted-jobs';
byId('section-posted').required=sectionKey==='latest-posted-jobs';
function status(message){byId('section-status').textContent=message;}
async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});const result=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');return result;}
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
 head.append(headRow);
 if(!items.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=columns.length;cell.className='section-table-empty';cell.textContent='No entries yet.';row.append(cell);body.append(row);}
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
  list.append(card);
 }
}
async function loadItems(){
 const current=++requestNumber,params=new URLSearchParams({section:sectionKey,category,search:byId('section-search').value.trim(),window:byId('date-filter').value});
 status('Loading…');
 try{const data=await api(`/api/section-items?${params}`);if(current!==requestNumber)return;render(data.items);status(`${data.items.length} ${data.items.length===1?'entry':'entries'}`);}
 catch(error){if(current===requestNumber)status(error.message);}
}
function selectTab(tab){category=tab.id.slice(4);for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;}byId('section-panel').setAttribute('aria-labelledby',tab.id);byId('section-search').value='';byId('date-filter').value='all';loadItems();}
for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;event.preventDefault();const next=tabs[(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];selectTab(next);next.focus();});}
byId('section-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadItems,250);});
byId('date-filter').addEventListener('change',loadItems);
byId('section-add').addEventListener('click',()=>{byId('section-form').reset();byId('section-form-error').hidden=true;byId('section-dialog').showModal();byId('section-title-input').focus();});
byId('section-cancel').addEventListener('click',()=>byId('section-dialog').close());
byId('section-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;byId('section-form-error').hidden=true;
 const postedValue=byId('section-posted').value;
 const input={section:sectionKey,category,title:byId('section-title-input').value,organization:byId('section-organization').value,url:byId('section-url').value,details:byId('section-details').value,email:byId('section-email').value,phone:byId('section-phone').value,extension:byId('section-ext').value,postedAt:postedValue?new Date(postedValue).toISOString():''};
 const file=byId('section-file').files[0];
 if(isDocument&&!input.url.trim()&&!file){byId('section-form-error').textContent='Add a link or upload a PDF or Word document.';byId('section-form-error').hidden=false;button.disabled=false;return;}
 if(file&&file.size>10*1024*1024){byId('section-form-error').textContent='Choose a file smaller than 10 MB.';byId('section-form-error').hidden=false;button.disabled=false;return;}
 let options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)};
 if(file){const formData=new FormData();for(const [key,value] of Object.entries(input))formData.append(key,value);formData.append('file',file);options={method:'POST',body:formData};}
 try{const result=await api('/api/section-items',options);byId('section-dialog').close();status(result.status==='pending'?'Submitted for Admin approval.':'Added successfully.');if(result.status==='approved')loadItems();}
 catch(error){byId('section-form-error').textContent=error.message;byId('section-form-error').hidden=false;}finally{button.disabled=false;}
});
byId('section-logout').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});location.replace('/');}catch(error){status(error.message);}});
api('/api/session').then(session=>{if(session.status!=='approved'){location.replace('/');return;}document.body.classList.add('has-access');byId('recruiter-page').hidden=false;byId('section-role').textContent=session.role==='admin'?'Admin':session.role==='coadmin'?'Coadmin':'User';byId('section-form-note').hidden=session.role!=='user';loadItems();}).catch(()=>location.replace('/'));
