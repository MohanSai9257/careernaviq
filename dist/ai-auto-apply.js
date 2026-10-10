const $ = (id) => document.getElementById(id);
let state = {
  summary: null,
  resumes: [],
  accounts: [],
  applications: [],
  blockers: [],
  answers: [],
  settings: null,
  profile: null,
};
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || 'Request failed.' };
  }
  if (!response.ok) {
    const error = Error(body.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}
function message(text) {
  $('auto-message').textContent = text || '';
}
function panel(name) {
  document
    .querySelectorAll('.auto-panel')
    .forEach((p) => (p.hidden = p.id !== `panel-${name}`));
  document
    .querySelectorAll('.auto-tabs [role=tab]')
    .forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.panel === name)),
    );
}
function card(label, value, hint = '') {
  return `<div class="analytics-card"><span>${label}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div>`;
}
function empty(text) {
  return `<p class="management-empty">${text}</p>`;
}
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}
function renderDashboard() {
  const s = state.summary || {};
  $('worker-status').textContent = s.worker?.configured
    ? `Worker configured · ${s.worker.model || 'model not reported'}`
    : 'External Skyvern/Ollama worker not configured';
  $('dashboard-cards').innerHTML = [
    card('Applied', s.counts?.submitted || 0),
    card('Awaiting review', s.counts?.readyForReview || 0),
    card('Blocked', s.counts?.blockers || 0),
    card('Failures', s.counts?.failed || 0),
  ].join('');
  $('activity-list').innerHTML =
    (s.activity || [])
      .map(
        (a) =>
          `<article class="auto-row"><strong>${esc(a.event_type)}</strong><span>${esc(a.message)}</span><small>${new Date(a.created_at).toLocaleString()}</small></article>`,
      )
      .join('') || empty('No activity yet.');
}
function renderApplications() {
  const applications = state.applications || [];
  const groups = [
    [
      'SUBMITTED',
      'applied-list',
      'applied-count',
      'submitted',
      'No applications yet.',
    ],
    [
      'READY_FOR_REVIEW',
      'review-list',
      'review-count',
      'readyForReview',
      'Nothing awaiting review.',
    ],
    ['FAILED', 'failure-list', 'failure-count', 'failed', 'No failures.'],
  ];
  for (const [status, listId, countId, countKey, emptyText] of groups) {
    const items = applications.filter((a) => a.status === status);
    $(countId).textContent = String(state.summary?.counts?.[countKey] || 0);
    $(listId).innerHTML =
      items
        .map((a) => {
          const activity = (state.summary?.activity || []).find(
            (event) => event.application_id === a.id,
          );
          const date = a.last_activity_at || a.updated_at || a.created_at;
          return `<article class="auto-row"><strong>${esc(a.company_name)} — ${esc(a.job_title)}</strong><a href="${esc(a.job_url)}" target="_blank" rel="noopener noreferrer">Job link ↗</a><small>${status === 'SUBMITTED' ? 'Applied' : 'Last activity'} ${date ? new Date(date).toLocaleString() : '—'}</small>${status === 'FAILED' && activity ? `<span>${esc(activity.message)}</span>` : ''}</article>`;
        })
        .join('') || empty(emptyText);
  }
  const choices = applications.filter((a) =>
    ['MATCHED', 'QUEUED'].includes(a.status),
  );
  const select = $('agent-application-id');
  const selected = select.value;
  select.innerHTML =
    '<option value="">Select a matched job</option>' +
    choices
      .map(
        (a) =>
          `<option value="${esc(a.id)}">${esc(a.company_name)} — ${esc(a.job_title)}</option>`,
      )
      .join('');
  if (choices.some((a) => a.id === selected)) select.value = selected;
}
function renderBlockers() {
  $('blocker-count').textContent = String(state.summary?.counts?.blockers || 0);
  $('blocker-list').innerHTML =
    state.blockers
      .map(
        (b) =>
          `<article class="auto-row"><strong>${esc(b.company_name)} — ${esc(b.job_title)}</strong><span>${esc(b.reason)} · ${esc(b.status)}</span><p>${esc(b.question || 'No question captured.')}</p><form data-blocker="${b.id}" class="inline"><input name="answer" placeholder="Answer this blocker"><label class="check-row"><input name="save" type="checkbox" checked> Save answer</label><button class="primary">Resolve</button></form></article>`,
      )
      .join('') || empty('No blockers.');
}
function renderSettings() {
  if (!state.settings) return;
  $('daily-limit').value = state.settings.daily_limit;
  $('minimum-score').value = state.settings.minimum_score;
  $('require-review').checked = Boolean(state.settings.require_review);
}
function renderAll() {
  renderDashboard();
  renderApplications();
  renderBlockers();
  renderSettings();
}
async function load() {
  try {
    const session = await api('/api/session');
    if (session.status !== 'approved') {
      location.replace('/');
      return;
    }
    document.body.classList.add('has-access');
    $('auto-apply-page').hidden = false;
    $('section-role').textContent =
      session.role === 'admin'
        ? 'Admin'
        : session.role === 'coadmin'
          ? 'Coadmin'
          : 'User';
    message('Loading AI Auto Apply…');
    const data = await api('/api/auto-apply/bootstrap');
    state = { ...state, ...data };
    renderAll();
    message('');
  } catch (error) {
    if (error.status === 403) location.replace('/');
    else {
      document.body.classList.add('has-access');
      $('auto-apply-page').hidden = false;
      message(error.message);
    }
  }
}
async function refresh() {
  const data = await api('/api/auto-apply/bootstrap');
  state = { ...state, ...data };
  renderAll();
}
document
  .querySelectorAll('.auto-tabs [role=tab]')
  .forEach((button) =>
    button.addEventListener('click', () => panel(button.dataset.panel)),
  );
$('section-logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.replace('/');
});
$('refresh-auto').addEventListener('click', refresh);
$('agent-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const result = await api('/api/auto-apply/agent/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: $('agent-application-id').value,
        instructions: $('agent-instructions').value,
      }),
    });
    await refresh();
    message(result.message);
  } catch (error) {
    message(error.message);
  }
});
for (const [id, action] of [['stop-agent', 'stop']])
  $(id).addEventListener('click', async () => {
    try {
      const result = await api('/api/auto-apply/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await refresh();
      message(result.message);
    } catch (error) {
      message(error.message);
    }
  });
$('start-agent').addEventListener('click', () =>
  $('agent-form').requestSubmit(),
);
$('blocker-list').addEventListener('submit', async (e) => {
  if (!e.target.dataset.blocker) return;
  e.preventDefault();
  try {
    await api('/api/auto-apply/blockers/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockerId: e.target.dataset.blocker,
        answer: e.target.answer.value,
        saveAnswer: e.target.save.checked,
      }),
    });
    await refresh();
    message('Blocker resolved.');
  } catch (error) {
    message(error.message);
  }
});
$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/auto-apply/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dailyLimit: Number($('daily-limit').value),
        minimumScore: Number($('minimum-score').value),
        requireReview: $('require-review').checked,
      }),
    });
    await refresh();
    message('Settings saved.');
  } catch (error) {
    message(error.message);
  }
});
if (location.hash === '#apply-profile') panel('apply-profile');
load();
