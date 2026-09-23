let companies=[],filtered=[],page=0,category='client',loaded=false;
const pageSize=100,storageKey='employer-directory-my-list-v1';
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('[role="tab"]')];
let saved=new Set();
try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(value))saved=new Set(value.filter(x=>typeof x==='string'));}catch{}
const notes={client:'Direct employers identified in the existing review. Original company order is preserved.',implementation:'Identified implementation and technology services firms. Original company order is preserved.',vendor:'Includes known vendors and all companies not yet classified. Placement here does not verify vendor status.',mylist:'Your saved companies, in their original order. My List is stored only in this browser, not shared with other visitors.'};
const arrow='<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 3h8v8M13 3 3 13"/></svg>';
function linkCell(url,label,name){
 const td=document.createElement('td');
 if(url){const a=document.createElement('a');a.className='external';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`${label} for ${name} (opens in a new tab)`);a.textContent=label;a.insertAdjacentHTML('beforeend',arrow);td.append(a);}
 else{const span=document.createElement('span');span.className='pending';span.textContent='Not verified yet';td.append(span);}
 return td;
}
function updateCounts(){
 for(const key of ['client','implementation','vendor'])$('count-'+key).textContent=companies.filter(r=>r[3]===key).length.toLocaleString();
 $('count-mylist').textContent=companies.filter(r=>saved.has(r[0])).length.toLocaleString();
}
function applyFilter(){
 const query=$('search').value.trim().toLocaleLowerCase();
 filtered=companies.filter(r=>(category==='mylist'?saved.has(r[0]):r[3]===category)&&r[0].toLocaleLowerCase().includes(query));
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
 if(!companies.some(r=>r[0]===name))throw new Error('Company not found');
 if(shouldSave)saved.add(name);else saved.delete(name);
 try{localStorage.setItem(storageKey,JSON.stringify([...saved]));$('save-status').hidden=true;}
 catch{$('save-status').hidden=false;$('save-status').textContent='Browser storage is unavailable. Your list will last only until this page closes.';}
 updateCounts();applyFilter();
}
function render(){
 const body=$('companies');body.replaceChildren();
 for(const company of filtered.slice(page*pageSize,(page+1)*pageSize)){
  const tr=document.createElement('tr'),name=document.createElement('td'),wrapper=document.createElement('div'),label=document.createElement('span'),star=document.createElement('button');
  wrapper.className='company-name';label.textContent=company[0];star.className='save-company';star.type='button';
  const isSaved=saved.has(company[0]);star.textContent=isSaved?'★':'☆';star.setAttribute('aria-pressed',String(isSaved));star.setAttribute('aria-label',`${isSaved?'Remove':'Save'} ${company[0]} ${isSaved?'from':'to'} My List`);star.title=isSaved?'Remove from My List':'Save to My List';
  star.addEventListener('click',()=>{setSaved(company[0],!saved.has(company[0]));const replacement=[...body.querySelectorAll('.save-company')].find(b=>b.getAttribute('aria-label').includes(company[0]));if(replacement)replacement.focus();else $('tab-mylist').focus();});
  wrapper.append(star,label);name.append(wrapper);tr.append(name,linkCell(company[1],'LinkedIn',company[0]),linkCell(company[2],'Careers',company[0]));body.append(tr);
 }
 $('empty').hidden=filtered.length>0||!loaded;
 $('empty').textContent=category==='mylist'&&!companies.some(r=>saved.has(r[0]))?'Your list is empty. Select the star beside any company to save it here.':'No companies found in this tab. Try another name or category.';
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
fetch('companies.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(data=>{
 companies=data;loaded=true;$('total').textContent=data.length.toLocaleString();updateCounts();applyFilter();
 const careerCount=data.filter(r=>r[2]).length,linkedinCount=data.filter(r=>r[1]).length;
 $('coverage').textContent=`${careerCount} careers links · ${linkedinCount} LinkedIn links. Checked September 23, 2026. Links open in a new tab.`;
}).catch(()=>{$('results').textContent='Could not load companies';$('empty').hidden=false;$('empty').textContent='The directory could not be loaded. Please refresh the page to try again.';});
