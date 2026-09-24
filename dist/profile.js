const profileElement=id=>document.getElementById(id);
const onProfilePage=Boolean(profileElement('profile-page'));
let profileRequest=0;
async function profileApi(url,options){const response=await fetch(url,{cache:'no-store',...options});const body=await response.json();if(!response.ok){const error=Error(body.error||'Could not load your profile.');error.status=response.status;throw error;}return body;}
function showGreeting(firstName){const greeting=profileElement('profile-greeting');if(!greeting)return;greeting.textContent=firstName?`Hello, ${firstName}`:'';greeting.hidden=!firstName;}
async function loadProfile(){
 const current=++profileRequest;
 try{
  const data=await profileApi('/api/profile');if(current!==profileRequest)return;
  showGreeting(data.profile?.first_name||'');
  if(!onProfilePage)return;
  document.body.classList.add('has-access');
  profileElement('profile-email').value=data.email;
  profileElement('profile-first').value=data.profile?.first_name||'';
  profileElement('profile-last').value=data.profile?.last_name||'';
  profileElement('profile-mobile').value=data.profile?.mobile||'';
  profileElement('profile-status').value=data.profile?.visa_status||'';
  profileElement('profile-page').hidden=false;
  const session=await profileApi('/api/session');
  profileElement('profile-role').textContent=session.role==='admin'?'Admin':session.role==='coadmin'?'Coadmin':'User';
 }catch(error){if(onProfilePage&&current===profileRequest){if(error.status===403)location.replace('/');else{document.body.classList.add('has-access');profileElement('profile-page').hidden=false;profileElement('profile-message').textContent=error.message;}}else showGreeting('');}
}
window.refreshHeaderProfile=loadProfile;
document.addEventListener('directory-access-ready',loadProfile);
if(!onProfilePage||document.readyState!=='loading')loadProfile();else document.addEventListener('DOMContentLoaded',loadProfile,{once:true});
if(onProfilePage){
 profileElement('profile-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('[type="submit"]'),message=profileElement('profile-message');button.disabled=true;message.textContent='Saving…';
  const input={firstName:profileElement('profile-first').value,lastName:profileElement('profile-last').value,mobile:profileElement('profile-mobile').value,visaStatus:profileElement('profile-status').value};
  try{const data=await profileApi('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});showGreeting(data.profile.first_name);message.textContent='Profile saved.';}
  catch(error){message.textContent=error.message;}finally{button.disabled=false;}
 });
 profileElement('profile-logout').addEventListener('click',async()=>{try{await profileApi('/api/logout',{method:'POST'});location.replace('/');}catch(error){profileElement('profile-message').textContent=error.message;}});
}
