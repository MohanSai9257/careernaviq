const directorySections=[
  {name:'CareerNaviq',path:'/careernaviq',icon:'<path d="M5 19V5l14 14V5"/><path d="M17 4h3v3"/>'},
  {name:'Employer Directory',path:'/employer-directory',icon:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M11 21v-3h2v3"/>'},
  {name:'Recruiter Directory',path:'/recruiter-directory',icon:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v1"/>'},
  {name:'Latest Posted Jobs',path:'/latest-posted-jobs',icon:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/>'},
  {name:'AI Auto Apply',path:'/ai-auto-apply',icon:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/><path d="m16 8 3-3M8 8 5 5m11 11 3 3M8 16l-3 3"/>'},
  {name:'Study Materials',path:'/study-materials',icon:'<path d="M12 6c-2-2-5-2-9-1v15c4-1 7-1 9 1 2-2 5-2 9-1V5c-4-1-7-1-9 1Zm0 0v15"/>'},
  {name:'Interview Prep',path:'/interview-prep',icon:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'},
  {name:'Interview Support',path:'/interview-support',icon:'<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H3v5h4v-5H4Zm16 0h1v5h-4v-5h3Zm0 5a4 4 0 0 1-4 4h-3"/>'}
];
const currentPath=location.pathname==='/'?'/careernaviq':location.pathname.replace(/\/$/,'');
const currentSection=directorySections.find(section=>section.path===currentPath)||(['/profile','/admin','/admin/'].includes(location.pathname)?null:directorySections[0]);
const sidebar=document.createElement('aside');sidebar.className='side-nav';sidebar.setAttribute('aria-label','Main navigation');
const sideHead=document.createElement('div');sideHead.className='side-head';
const homeBrand=document.createElement('a');homeBrand.href='/careernaviq';homeBrand.className='side-brand';homeBrand.title='CareerNaviq home';
const homeLogo=document.createElement('img');homeLogo.src='/logo.svg';homeLogo.alt='';homeLogo.className='side-brand-logo';
const homeName=document.createElement('span');homeName.className='side-label';homeName.textContent='CareerNaviq';homeBrand.append(homeLogo,homeName);sideHead.append(homeBrand);
const toggle=document.createElement('button');toggle.type='button';toggle.className='side-toggle';toggle.setAttribute('aria-label','Toggle navigation');toggle.setAttribute('aria-expanded','true');toggle.textContent='‹';
sideHead.append(toggle);sidebar.append(sideHead);
const links=document.createElement('nav');
for(const section of directorySections){
 const link=document.createElement('a');link.href=section.path;link.title=section.name;
 if(section===currentSection)link.setAttribute('aria-current','page');
 const icon=document.createElement('span');icon.className='side-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${section.icon}</svg>`;
 const label=document.createElement('span');label.className='side-label';label.textContent=section.name;
 link.append(icon,label);links.append(link);
}
sidebar.append(links);
const adminLink=document.createElement('a');adminLink.href='/admin';adminLink.title='ADMIN';adminLink.className='side-admin';adminLink.hidden=true;
if(location.pathname==='/admin'||location.pathname==='/admin/')adminLink.setAttribute('aria-current','page');
const adminIcon=document.createElement('span');adminIcon.className='side-icon';adminIcon.setAttribute('aria-hidden','true');adminIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 20 5v6c0 5-3.3 8.5-8 11-4.7-2.5-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>';
const adminLabel=document.createElement('span');adminLabel.className='side-label';adminLabel.textContent='ADMIN';adminLink.append(adminIcon,adminLabel);
window.setAdminNavigation=(role,status)=>{adminLink.hidden=status!=='approved';adminLink.dataset.role=role||'guest';};
function ensureAdminRequestDialog(){
 let dialog=document.getElementById('admin-request-dialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='admin-request-dialog';dialog.setAttribute('aria-labelledby','admin-request-title');
 dialog.innerHTML='<form id="admin-request-form"><h2 id="admin-request-title">Admin access required</h2><p class="edit-scope">You need Admin or Coadmin access to open this section.</p><p id="admin-request-message" role="alert" hidden></p><div class="dialog-actions"><button id="admin-request-cancel" type="button">Cancel</button><button type="submit" class="primary">Request Access</button></div></form>';
 document.body.append(dialog);
 document.getElementById('admin-request-cancel').addEventListener('click',()=>dialog.close());
 document.getElementById('admin-request-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]'),message=document.getElementById('admin-request-message');button.disabled=true;message.hidden=true;
  try{const response=await fetch('/api/admin-access-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const result=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');message.textContent='Admin access request sent. An Admin or Coadmin can approve it from Access management.';message.hidden=false;window.showAppNotice?.('Admin access request sent.');}
  catch(error){message.textContent=error.message;message.hidden=false;}
  finally{button.disabled=false;}
 });
 return dialog;
}
adminLink.addEventListener('click',event=>{
 if(adminLink.dataset.role==='admin'||adminLink.dataset.role==='coadmin')return;
 event.preventDefault();const dialog=ensureAdminRequestDialog();document.getElementById('admin-request-message').hidden=true;dialog.showModal();
});
fetch('/api/session',{cache:'no-store'}).then(response=>response.json()).then(session=>window.setAdminNavigation(session.role,session.status)).catch(()=>{});
const navFooter=document.createElement('div');navFooter.className='side-footer';
const profileLink=document.createElement('a');profileLink.href='/profile';profileLink.title='Profile';profileLink.className='side-profile';
if(location.pathname==='/profile')profileLink.setAttribute('aria-current','page');
const profileIcon=document.createElement('span');profileIcon.className='side-icon';profileIcon.setAttribute('aria-hidden','true');profileIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
const profileLabel=document.createElement('span');profileLabel.className='side-label';profileLabel.textContent='AI Apply Profile';profileLink.append(profileIcon,profileLabel);
navFooter.append(adminLink,profileLink);sidebar.append(navFooter);document.body.prepend(sidebar);
function setSidebarCollapsed(collapsed){document.body.classList.toggle('sidebar-collapsed',collapsed);toggle.textContent=collapsed?'›':'‹';toggle.setAttribute('aria-expanded',String(!collapsed));}
setSidebarCollapsed(localStorage.getItem('directory-sidebar-collapsed')==='true');
toggle.addEventListener('click',()=>{const collapsed=!document.body.classList.contains('sidebar-collapsed');setSidebarCollapsed(collapsed);localStorage.setItem('directory-sidebar-collapsed',String(collapsed));});
const sectionTitle=document.getElementById('section-title');if(sectionTitle&&currentSection){sectionTitle.textContent=currentSection.name;document.title=`${currentSection.name} — CareerNaviq`;}

const appNotice=document.createElement('div');appNotice.className='app-notice';appNotice.hidden=true;
const appNoticeText=document.createElement('span');appNoticeText.setAttribute('role','status');appNoticeText.setAttribute('aria-live','polite');appNoticeText.setAttribute('aria-atomic','true');
const appNoticeClose=document.createElement('button');appNoticeClose.type='button';appNoticeClose.textContent='×';appNoticeClose.setAttribute('aria-label','Dismiss notification');appNoticeClose.addEventListener('click',()=>{appNotice.hidden=true;});
appNotice.append(appNoticeText,appNoticeClose);document.body.append(appNotice);
window.showAppNotice=message=>{appNotice.hidden=false;appNoticeText.textContent=message;};
