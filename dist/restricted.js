const restrictedNames={'/':'Employer Directory','/index.html':'Employer Directory','/recruiter-directory':'Recruiter Directory','/latest-posted-jobs':'Latest Posted Jobs','/study-materials':'Study Materials','/interview-prep':'Interview Prep','/interview-support':'Interview Support'};
const restrictedPath=location.pathname.replace(/\/$/,'')||'/';
const restrictedName=restrictedNames[restrictedPath]||'This tab';
document.title=`${restrictedName} — Access restricted — CareerNaviq`;
document.getElementById('restricted-section').textContent=restrictedName;
fetch('/api/session',{cache:'no-store'}).then(response=>response.json()).then(session=>{
 if(session.status!=='approved'){location.replace('/');return;}
 if(session.role==='admin'||session.role==='coadmin'){location.reload();return;}
 document.body.classList.add('has-access');
 document.getElementById('restricted-page').hidden=false;
}).catch(()=>location.replace('/'));
document.getElementById('restricted-logout').addEventListener('click',async()=>{await fetch('/api/logout',{method:'POST'});location.replace('/');});
