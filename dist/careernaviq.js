const c = (id) => document.getElementById(id);
let careerState = { email: '', name: '', role: 'user' };
async function careerApi(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const body = await response.json();
  if (!response.ok) {
    const error = Error(body.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}
function careerMessage(text) {
  c('career-message').textContent = text || '';
}
function sizeCareerChat() {
  const panel = c('career-panel-ask');
  if (panel.hidden) return;
  const shell = panel.querySelector('.career-chat-shell');
  const available =
    (window.visualViewport?.height || window.innerHeight) -
    shell.getBoundingClientRect().top -
    16;
  shell.style.setProperty('--chat-height', `${Math.max(300, available)}px`);
}
window.addEventListener('resize', sizeCareerChat);
window.visualViewport?.addEventListener('resize', sizeCareerChat);
function showCareerPanel(name) {
  document
    .querySelectorAll('.career-panel')
    .forEach((panel) => (panel.hidden = panel.id !== `career-panel-${name}`));
  document
    .querySelectorAll('.career-tabs [role=tab]')
    .forEach((tab) =>
      tab.setAttribute(
        'aria-selected',
        String(tab.dataset.careerPanel === name),
      ),
    );
  requestAnimationFrame(sizeCareerChat);
}
function renderCareerProfile() {
  const display = careerState.name || 'CarrerNaviq User';
  c('career-chip-name').textContent = display;
  c('career-chip-email').textContent = careerState.email || '';
  c('career-name').value = careerState.name || '';
  c('career-email').value = careerState.email || '';
  const greeting = document.getElementById('profile-greeting');
  if (greeting) {
    greeting.textContent = `Hello, ${display.split(/\s+/)[0]}`;
    greeting.hidden = false;
  }
}
function renderNotifications() {
  const items = [
    [
      'Welcome',
      'Your CarrerNaviq account is ready. Complete your user profile first.',
    ],
    [
      'Tip',
      'Use My List in Employer and Recruiter Directory to save records you contact often.',
    ],
    [
      'AI Auto Apply',
      'Add resumes and application details before using AI Auto Apply.',
    ],
  ];
  c('career-notifications').innerHTML = items
    .map(
      ([title, text]) =>
        `<article><strong>${title}</strong><span>${text}</span></article>`,
    )
    .join('');
}
function renderCareerChat(items = []) {
  const box = c('career-chat-messages');
  box.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'career-chat-empty';
    empty.textContent = 'No messages yet. Send your first question to Admin.';
    box.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = `career-chat-row ${item.sender === 'support' ? 'is-support' : 'is-user'}`;
    const bubble = document.createElement('div');
    bubble.className = 'career-chat-bubble';
    const label = document.createElement('strong');
    label.textContent = item.sender === 'support' ? 'ADMIN' : 'You';
    const body = document.createElement('p');
    body.textContent = item.body;
    const time = document.createElement('small');
    time.textContent = new Date(item.createdAt).toLocaleString();
    bubble.append(label, body, time);
    ChatFiles.render(body, item.attachments);
    row.append(bubble);
    box.append(row);
  }
  box.scrollTop = box.scrollHeight;
}
function compactCareerChat(items) {
  const box = c('career-chat-messages');
  let previous = '';
  for (const [index, row] of [
    ...box.querySelectorAll('.career-chat-row'),
  ].entries()) {
    const date = new Date(items[index].createdAt),
      now = new Date(),
      day = date.toLocaleDateString(),
      yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const label =
      day === now.toLocaleDateString()
        ? 'Today'
        : day === yesterday.toLocaleDateString()
          ? 'Yesterday'
          : date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
    if (day !== previous) {
      const divider = document.createElement('div');
      divider.className = 'admin-chat-day';
      divider.textContent = label;
      box.insertBefore(divider, row);
      previous = day;
    }
    row.className =
      'admin-chat-row ' +
      (items[index].sender === 'support' ? 'is-user' : 'is-admin');
    const bubble = row.firstElementChild;
    bubble.className = 'admin-chat-bubble';
    bubble.querySelector('strong')?.remove();
    bubble.querySelector('small').textContent = date.toLocaleTimeString(
      undefined,
      { hour: 'numeric', minute: '2-digit' },
    );
  }
  box.scrollTop = box.scrollHeight;
}
async function loadCareerChat() {
  try {
    const data = await careerApi('/api/ask/messages');
    renderCareerChat(data.items || []);
    compactCareerChat(data.items || []);
  } catch (error) {
    careerMessage(error.message);
  }
}
async function loadCareer() {
  try {
    const session = await careerApi('/api/session');
    if (session.status !== 'approved') {
      location.replace('/');
      return;
    }
    careerState = {
      email: session.email || '',
      name: session.name || '',
      role: session.role || 'user',
    };
    document.body.classList.add('has-access');
    c('career-page').hidden = false;
    c('career-role').textContent =
      session.role === 'admin'
        ? 'Admin'
        : session.role === 'coadmin'
          ? 'Coadmin'
          : 'User';
    renderCareerProfile();
    renderNotifications();
    loadCareerChat();
    careerMessage('');
  } catch (error) {
    if (error.status === 403) location.replace('/');
    else careerMessage(error.message);
  }
}
document.querySelectorAll('.career-tabs [role=tab]').forEach((button) =>
  button.addEventListener('click', () => {
    showCareerPanel(button.dataset.careerPanel);
    if (button.dataset.careerPanel === 'ask') loadCareerChat();
  }),
);
c('career-logout').addEventListener('click', async () => {
  await careerApi('/api/logout', { method: 'POST' });
  location.replace('/');
});
c('career-user-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type=submit]');
  button.disabled = true;
  careerMessage('Saving user profile…');
  try {
    const result = await careerApi('/api/app-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: c('career-name').value.trim() }),
    });
    careerState.name = result.name || '';
    renderCareerProfile();
    careerMessage('User profile saved.');
    window.showAppNotice?.('User profile saved.');
  } catch (error) {
    careerMessage(error.message);
  } finally {
    button.disabled = false;
  }
});
const userChatFiles = ChatFiles.bind(c('career-question-form'));
c('career-question-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = c('career-question').value.trim();
  if (!question && !userChatFiles.hasFiles()) {
    careerMessage('Enter your message first.');
    return;
  }
  const button = event.currentTarget.querySelector('[type=submit]');
  button.disabled = true;
  careerMessage('Sending message…');
  try {
    await careerApi('/api/ask/messages', {
      method: 'POST',
      body: userChatFiles.body(question),
    });
    c('career-question').value = '';
    userChatFiles.clear();
    await loadCareerChat();
    careerMessage('Message sent.');
    window.showAppNotice?.('Message sent to Admin.');
  } catch (error) {
    careerMessage(error.message);
  } finally {
    button.disabled = false;
  }
});
c('career-delete-profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = c('career-delete-email').value.trim().toLowerCase();
  if (email !== careerState.email) {
    careerMessage('Enter your own account email to delete profile details.');
    return;
  }
  const button = event.currentTarget.querySelector('[type=submit]');
  button.disabled = true;
  careerMessage('Deleting account access…');
  try {
    await careerApi('/api/app-profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    careerMessage('Account access deleted. Redirecting…');
    window.showAppNotice?.('Account access deleted.');
    setTimeout(() => location.replace('/'), 600);
  } catch (error) {
    careerMessage(error.message);
  } finally {
    button.disabled = false;
  }
});
loadCareer();
