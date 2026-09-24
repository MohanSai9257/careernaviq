let companies=[],filtered=[],page=0,category='client',loaded=false;
const pageSize=100,storageKey='employer-directory-my-list-v1';
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('[role="tab"]')];
let saved=new Set();
try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(value))saved=new Set(value.filter(x=>typeof x==='string'));}catch{}
const notes={client:'Companies currently categorized as direct employers. Original company order is preserved.',implementation:'Companies currently categorized as implementation and technology services firms. Original company order is preserved.',vendor:'Includes known vendors and all companies not yet classified. Placement here does not verify vendor status.',mylist:'Your saved companies, in their original order. My List is stored only in this browser, not shared with other visitors.'};
const arrow='<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 3h8v8M13 3 3 13"/></svg>';
function linkCell(url,label,name){
 const td=document.createElement('td');
 if(url){const a=document.createElement('a');a.className='external';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`${label} for ${name} (opens in a new tab)`);a.textContent=label;a.insertAdjacentHTML('beforeend',arrow);td.append(a);}
 else{const span=document.createElement('span');span.className='pending';span.textContent='Not verified yet';td.append(span);}
 return td;
}
function updateCounts(){
 for(const key of ['client','implementation','vendor'])$('count-'+key).textContent=companies.filter(r=>r[3]===key).length.toLocaleString();
 $('count-mylist').textContent=companies.filter(r=>saved.has(r[4])).length.toLocaleString();
}
function applyFilter(){
 const query=$('search').value.trim().toLocaleLowerCase();
 filtered=companies.filter(r=>(category==='mylist'?saved.has(r[4]):r[3]===category)&&r[0].toLocaleLowerCase().includes(query));
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));render();
}
function setCategory(value){
 if(!Object.hasOwn(notes,value))throw new Error('Unknown category');
 category=value;page=0;
 for(const tab of tabs){const active=tab.dataset.category===category;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 $('directory-panel').setAttribute('aria-labelledby','tab-'+category);
 $('category-note').textContent=notes[category];applyFilter();
}
function setSaved(name,shouldSave){
 if(!companies.some(r=>r[4]===name))throw new Error('Company not found');
 if(shouldSave)saved.add(name);else saved.delete(name);
 try{localStorage.setItem(storageKey,JSON.stringify([...saved]));$('save-status').hidden=true;}
 catch{$('save-status').hidden=false;$('save-status').textContent='Browser storage is unavailable. Your list will last only until this page closes.';}
 updateCounts();applyFilter();
}
function render(){
 closeMenu();const body=$('companies');body.replaceChildren();
 for(const company of filtered.slice(page*pageSize,(page+1)*pageSize)){
  const tr=document.createElement('tr'),name=document.createElement('td'),wrapper=document.createElement('div'),label=document.createElement('span'),star=document.createElement('button');
  wrapper.className='company-name';label.textContent=company[0];star.className='save-company';star.type='button';
  const isSaved=saved.has(company[4]);star.textContent=isSaved?'★':'☆';star.setAttribute('aria-pressed',String(isSaved));star.setAttribute('aria-label',`${isSaved?'Remove':'Save'} ${company[0]} ${isSaved?'from':'to'} My List`);star.title=isSaved?'Remove from My List':'Save to My List';
  star.addEventListener('click',()=>{setSaved(company[4],!saved.has(company[4]));const replacement=[...body.querySelectorAll('.save-company')].find(b=>b.getAttribute('aria-label').includes(company[0]));if(replacement)replacement.focus();else $('tab-mylist').focus();});
  wrapper.append(star,label);if(company[5]){const added=document.createElement('small');added.className='added-label';added.textContent='Added by a visitor';wrapper.append(added);}name.append(wrapper);tr.append(name,linkCell(company[1],'LinkedIn',company[0]),linkCell(company[2],'Careers',company[0]),actionsCell(company));body.append(tr);
 }
 $('empty').hidden=filtered.length>0||!loaded;
 $('empty').textContent=category==='mylist'&&!companies.some(r=>saved.has(r[4]))?'Your list is empty. Select the star beside any company to save it here.':'No companies found in this tab. Try another name or category.';
 $('results').textContent=loaded?`${filtered.length.toLocaleString()} companies`:'Loading companies…';
 $('range').textContent=filtered.length?`${(page*pageSize+1).toLocaleString()}–${Math.min((page+1)*pageSize,filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}`:'0 results';
 $('page').textContent=`Page ${page+1} of ${Math.max(1,Math.ceil(filtered.length/pageSize))}`;
 $('previous').disabled=page===0;$('next').disabled=(page+1)*pageSize>=filtered.length;
}
$('search').addEventListener('input',()=>{page=0;applyFilter();});
for(const [i,tab] of tabs.entries()){
 tab.addEventListener('click',()=>setCategory(tab.dataset.category));
 tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();tabs[next].focus();setCategory(tabs[next].dataset.category);});
}
for(const [id,change] of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{page+=change;render();document.querySelector('.category-tabs').scrollIntoView({behavior:'smooth',block:'start'});});
window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){try{const value=JSON.parse(event.newValue||'[]');saved=new Set(Array.isArray(value)?value.filter(x=>typeof x==='string'):[]);updateCounts();applyFilter();}catch{}}});
fetch('companies.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(async data=>{
 baseData=data;loaded=true;await loadChanges();updateCounts();applyFilter();

}).catch(()=>{$('results').textContent='Could not load companies';$('empty').hidden=false;$('empty').textContent='The directory could not be loaded. Please refresh the page to try again.';});

let overrides={},versions={},menuCompany=null,menuTrigger=null,editingId=null,sharedReady=false,saving=false;
let baseData=[],addedData=[];
function validLink(value){if(!value)return true;try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}}
function applyOverrides(){
 for(const row of companies){const value=overrides[row[4]];if(!value||typeof value!=='object')continue;
  if(typeof value.name==='string'&&value.name.trim())row[0]=value.name.trim();
  if(typeof value.linkedin==='string'&&validLink(value.linkedin))row[1]=value.linkedin;
  if(typeof value.careers==='string'&&validLink(value.careers))row[2]=value.careers;
  if(['client','implementation','vendor'].includes(value.category))row[3]=value.category;
 }
}
async function loadChanges(){
 const additions=[];let cursor=0;
 do{const response=await fetch('/api/companies'+(cursor?'?after='+cursor:''),{cache:'no-store'});if(!response.ok)throw Error('Could not load added companies. Please refresh and try again.');const data=await response.json();additions.push(...data.items);cursor=data.next;}while(cursor);
 const next={},nextVersions={};let after='';
 do{const response=await fetch('/api/changes'+(after?'?after='+encodeURIComponent(after):''),{cache:'no-store'});if(!response.ok)throw Error('Could not load shared changes. Please refresh and try again.');const data=await response.json();for(const item of data.items){const {id,version,...fields}=item;next[id]=fields;nextVersions[id]=version;}after=data.next;}while(after);
 addedData=additions;overrides=next;versions=nextVersions;rebuildCompanies();sharedReady=true;updateCounts();applyFilter();
}
function updateCoverage(){const careerCount=companies.filter(r=>r[2]).length,linkedinCount=companies.filter(r=>r[1]).length;$('coverage').textContent=`${careerCount} careers links · ${linkedinCount} LinkedIn links. Initial links reviewed September 23, 2026; visitor-added links are not verified.`;}
function rebuildCompanies(){
 companies=[...baseData.map(r=>[...r.slice(0,4),r[0],false]),...addedData.map(r=>[r.name,r.linkedin,r.careers,r.category,r.id,true])];
 applyOverrides();$('total').textContent=companies.length.toLocaleString();updateCoverage();
}
async function persistChange(id,change){
 if(!sharedReady)throw Error('Shared data is not ready. Refresh and try again.');
 if(saving)throw Error('Please wait for the current save to finish.');saving=true;
 try{const response=await fetch('/api/company',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,version:versions[id]||0,change})});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save. Try again.');const {id:companyId,version,...fields}=result;overrides[companyId]=fields;versions[companyId]=version;applyOverrides();updateCoverage();updateCounts();applyFilter();}finally{saving=false;}
}
function notify(message){$('save-status').textContent=message;$('save-status').hidden=false;}
function closeMenu(restore=false){$('company-menu').hidden=true;$('move-menu').hidden=true;$('menu-move').setAttribute('aria-expanded','false');if(menuTrigger){menuTrigger.setAttribute('aria-expanded','false');if(restore&&menuTrigger.isConnected)menuTrigger.focus();}}
function actionsCell(company){
 const td=document.createElement('td');td.className='actions-cell';const button=document.createElement('button');button.type='button';button.className='more-button';button.textContent='⋮';button.setAttribute('aria-label',`Actions for ${company[0]}`);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
 button.addEventListener('click',()=>{if(menuTrigger===button&&!$('company-menu').hidden){closeMenu(true);return;}closeMenu();menuCompany=company;menuTrigger=button;button.setAttribute('aria-expanded','true');
  const submenu=$('move-menu');submenu.replaceChildren();for(const [key,label] of [['client','Client'],['implementation','Implementation'],['vendor','Vendor']]){if(key===company[3])continue;const option=document.createElement('button');option.type='button';option.role='menuitem';option.textContent=label;option.addEventListener('click',async()=>{option.disabled=true;
   try{await persistChange(company[4],{category:key});notify(`${company[0]} moved to ${label}. Visible to everyone.`);$('tab-'+category).focus();}catch(error){notify(error.message);option.disabled=false;closeMenu(true);}
  });submenu.append(option);}
  $('company-menu').hidden=false;positionMenu();$('menu-edit').focus({preventScroll:true});
 });td.append(button);return td;
}
function positionMenu(){if(!menuTrigger)return;const bounds=menuTrigger.getBoundingClientRect(),menu=$('company-menu');menu.style.left=Math.max(8,Math.min(bounds.right-224,window.innerWidth-232))+'px';menu.style.top=Math.max(8,Math.min(bounds.bottom+5,window.innerHeight-menu.offsetHeight-8))+'px';}
$('menu-move').addEventListener('click',()=>{const open=$('move-menu').hidden;$('move-menu').hidden=!open;$('menu-move').setAttribute('aria-expanded',String(open));positionMenu();if(open)$('move-menu').querySelector('button')?.focus({preventScroll:true});});
$('menu-edit').addEventListener('click',()=>{editingId=menuCompany[4];$('edit-name').value=menuCompany[0];$('edit-linkedin').value=menuCompany[1];$('edit-careers').value=menuCompany[2];$('edit-error').hidden=true;closeMenu();$('edit-dialog').showModal();$('edit-name').focus();});
$('edit-cancel').addEventListener('click',()=>$('edit-dialog').close());
$('edit-dialog').addEventListener('close',()=>{if(menuTrigger?.isConnected)menuTrigger.focus();});
$('edit-form').addEventListener('submit',async event=>{event.preventDefault();const name=$('edit-name').value.trim(),linkedin=$('edit-linkedin').value.trim(),careers=$('edit-careers').value.trim();
 let error='';if(!name)error='Enter a company name.';else if(!validLink(linkedin)||!validLink(careers))error='Links must be valid http:// or https:// addresses, without embedded credentials.';else if(companies.some(r=>r[4]!==editingId&&r[0].toLowerCase()===name.toLowerCase()))error='A company with this name already exists.';
 if(error){$('edit-error').textContent=error;$('edit-error').hidden=false;return;}
 const submit=$('edit-form').querySelector('[type=submit]');submit.disabled=true;
 try{await persistChange(editingId,{name,linkedin,careers});$('edit-dialog').close();notify(`${name} updated. Visible to everyone.`);$('tab-'+category).focus();}catch(error){$('edit-error').textContent=error.message;$('edit-error').hidden=false;}finally{submit.disabled=false;}
});
document.addEventListener('click',event=>{if(!$('company-menu').contains(event.target)&&!event.target.closest('.more-button'))closeMenu();});
$('company-menu').addEventListener('keydown',event=>{const items=[...$('company-menu').querySelectorAll('button')].filter(b=>!b.parentElement.hidden);const index=items.indexOf(document.activeElement);
 if(event.key==='Escape'){event.preventDefault();closeMenu(true);}else if(event.key==='Tab')closeMenu();else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}else if(event.key==='ArrowRight'&&document.activeElement===$('menu-move')){event.preventDefault();$('menu-move').click();}else if(event.key==='ArrowLeft'&&!$('move-menu').hidden){event.preventDefault();$('move-menu').hidden=true;$('menu-move').setAttribute('aria-expanded','false');$('menu-move').focus();}
});
window.addEventListener('resize',()=>closeMenu());window.addEventListener('scroll',()=>{if(!$('company-menu').hidden)positionMenu();},true);

window.addEventListener('focus',()=>{if(loaded&&!saving&&!$('edit-dialog').open&&$('company-menu').hidden)loadChanges().catch(error=>notify(error.message));});

$('add-company').addEventListener('click',()=>{
 $('add-form').reset();$('add-category').value=['client','implementation','vendor'].includes(category)?category:'vendor';$('add-error').hidden=true;$('add-dialog').showModal();$('add-name').focus();
});
$('add-cancel').addEventListener('click',()=>$('add-dialog').close());
$('add-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const name=$('add-name').value.trim(),categoryValue=$('add-category').value,linkedin=$('add-linkedin').value.trim(),careers=$('add-careers').value.trim();
 let error='';if(!name)error='Enter a company name.';else if(!validLink(linkedin)||!validLink(careers))error='Links must be valid http:// or https:// addresses, without embedded credentials.';else if(companies.some(r=>r[0].trim().toLowerCase()===name.toLowerCase()))error='This company is already in the directory.';
 if(error){$('add-error').textContent=error;$('add-error').hidden=false;return;}
 const submit=$('add-form').querySelector('[type=submit]');submit.disabled=true;
 try{const response=await fetch('/api/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category:categoryValue,linkedin,careers})});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not add the company. Try again.');
  addedData.push(result);rebuildCompanies();updateCounts();$('search').value=result.name;setCategory(result.category);$('add-dialog').close();notify(`${result.name} added. Visible to everyone.`);
 }catch(error){$('add-error').textContent=error.message;$('add-error').hidden=false;}finally{submit.disabled=false;}
});
