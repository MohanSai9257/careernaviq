const directorySections=[
  {name:'Employer Directory',path:'/',icon:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M11 21v-3h2v3"/>'},
  {name:'Recruiter Directory',path:'/recruiter-directory',icon:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v1"/>'},
  {name:'Latest Posted Jobs',path:'/latest-posted-jobs',icon:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/>'},
  {name:'Study Materials',path:'/study-materials',icon:'<path d="M12 6c-2-2-5-2-9-1v15c4-1 7-1 9 1 2-2 5-2 9-1V5c-4-1-7-1-9 1Zm0 0v15"/>'},
  {name:'Interview Prep',path:'/interview-prep',icon:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'},
  {name:'Interview Support',path:'/interview-support',icon:'<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13H3v5h4v-5H4Zm16 0h1v5h-4v-5h3Zm0 5a4 4 0 0 1-4 4h-3"/>'}
];
const currentSection=directorySections.find(section=>section.path===location.pathname.replace(/\/$/,'')||section.path==='/'&&location.pathname==='/')||directorySections[0];
const sidebar=document.createElement('aside');sidebar.className='side-nav';sidebar.setAttribute('aria-label','Main navigation');
const toggle=document.createElement('button');toggle.type='button';toggle.className='side-toggle';toggle.setAttribute('aria-label','Toggle navigation');toggle.setAttribute('aria-expanded','true');toggle.textContent='‹';sidebar.append(toggle);
const links=document.createElement('nav');
for(const section of directorySections){
 const link=document.createElement('a');link.href=section.path;link.title=section.name;
 if(section===currentSection)link.setAttribute('aria-current','page');
 const icon=document.createElement('span');icon.className='side-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${section.icon}</svg>`;
 const label=document.createElement('span');label.className='side-label';label.textContent=section.name;
 link.append(icon,label);links.append(link);
}
sidebar.append(links);document.body.prepend(sidebar);
function setSidebarCollapsed(collapsed){document.body.classList.toggle('sidebar-collapsed',collapsed);toggle.textContent=collapsed?'›':'‹';toggle.setAttribute('aria-expanded',String(!collapsed));}
setSidebarCollapsed(localStorage.getItem('directory-sidebar-collapsed')==='true');
toggle.addEventListener('click',()=>{const collapsed=!document.body.classList.contains('sidebar-collapsed');setSidebarCollapsed(collapsed);localStorage.setItem('directory-sidebar-collapsed',String(collapsed));});
const sectionTitle=document.getElementById('section-title');if(sectionTitle){sectionTitle.textContent=currentSection.name;document.title=currentSection.name;}
