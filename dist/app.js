let companies=[],filtered=[],page=0;
const pageSize=100;
const $=id=>document.getElementById(id);
const arrow='<svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 3h8v8M13 3 3 13"/></svg>';
function linkCell(url,label,name){
 const td=document.createElement('td');
 if(url){const a=document.createElement('a');a.className='external';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`${label} for ${name} (opens in a new tab)`);a.textContent=label;a.insertAdjacentHTML('beforeend',arrow);td.append(a);}
 else{const span=document.createElement('span');span.className='pending';span.textContent='Not verified yet';td.append(span);}
 return td;
}
function render(){
 const body=$('companies');body.replaceChildren();
 for(const company of filtered.slice(page*pageSize,(page+1)*pageSize)){
  const tr=document.createElement('tr'),name=document.createElement('td');name.textContent=company[0];tr.append(name,linkCell(company[1],'LinkedIn',company[0]),linkCell(company[2],'Careers',company[0]));body.append(tr);
 }
 $('empty').hidden=filtered.length>0;
 $('results').textContent=`${filtered.length.toLocaleString()} companies`;
 $('range').textContent=filtered.length?`${(page*pageSize+1).toLocaleString()}–${Math.min((page+1)*pageSize,filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}`:'0 results';
 $('page').textContent=`Page ${page+1} of ${Math.max(1,Math.ceil(filtered.length/pageSize))}`;
 $('previous').disabled=page===0;$('next').disabled=(page+1)*pageSize>=filtered.length;
}
$('search').addEventListener('input',()=>{const query=$('search').value.trim().toLocaleLowerCase();filtered=companies.filter(r=>r[0].toLocaleLowerCase().includes(query));page=0;render();});
for(const [id,change] of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{page+=change;render();document.querySelector('section').scrollIntoView({behavior:'smooth',block:'start'});});
fetch('companies.json').then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json();}).then(data=>{
 companies=data;filtered=data;$('total').textContent=data.length.toLocaleString();
 const careerCount=data.filter(r=>r[2]).length,linkedinCount=data.filter(r=>r[1]).length;
 $('coverage').textContent=`${careerCount} careers links · ${linkedinCount} LinkedIn links. Checked September 23, 2026. Links open in a new tab.`;render();
}).catch(()=>{$('results').textContent='Could not load companies';$('empty').hidden=false;$('empty').textContent='The directory could not be loaded. Please refresh the page to try again.';});
