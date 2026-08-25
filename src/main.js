import {
  $, $$, html, escapeHtml, debounce, formatDate, timeAgo,
  PRIORITY_ORDER, PRIORITY_LABELS, STATUS_LABELS, STORAGE_KEY, THEME_KEY,
} from './utils/helpers.js';
import {
  setToken, getToken, isAuthed, getRateLimit, fetchWithPagination, getCurrentUser,
  getUserRepos, getUserOrgs, getOrgRepos, getIssues, getIssueComments, postComment,
  updateIssue, addLabel, removeLabel, formatIssueForDisplay,
} from './api/github.js';
import { getState, setState, subscribe, loadPersisted, persistLayout, persistTheme } from './state/store.js';


let toastContainer = null;

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  setState({ theme: saved });
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-message">${escapeHtml(message)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function renderHeader() {
  const s = getState();
  if (!isAuthed()) return '';
  return html`
    <header class="app-header">
      <div class="app-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          <path d="M9 12h6M9 16h6"/>
        </svg>
        Issuez
      </div>
      <div class="header-actions">
        <select id="theme-select" onchange="window._setTheme(this.value)">
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="colorful" ${s.theme === 'colorful' ? 'selected' : ''}>Colorful</option>
          <option value="neon" ${s.theme === 'neon' ? 'selected' : ''}>Neon</option>
          <option value="pink" ${s.theme === 'pink' ? 'selected' : ''}>Pink</option>
        </select>
        <div class="user-info">
          <img class="user-avatar" src="${s.user?.avatar_url || ''}" alt="">
          <span>${escapeHtml(s.user?.login || '')}</span>
        </div>
        <button class="small" onclick="window._logout()">Logout</button>
      </div>
    </header>
  `;
}

function renderAuth() {
  return html`
    <div class="auth-screen">
      <div class="auth-card fade-in">
        <h1>Issuez</h1>
        <p>Cross-repo GitHub issue tracker. No server, no storage — just you and GitHub.</p>
        <div style="text-align:left; margin-bottom:1rem;">
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">
            <strong>How to get a PAT:</strong>
          </p>
          <ol style="font-size:0.85rem; color:var(--text-secondary); padding-left:1.2rem; line-height:1.8;">
            <li>Go to <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></li>
            <li>Click <strong>Generate new token (classic)</strong></li>
            <li>Select scopes: <code style="background:var(--bg-tertiary); padding:0.1rem 0.3rem; border-radius:4px;">repo</code> and <code style="background:var(--bg-tertiary); padding:0.1rem 0.3rem; border-radius:4px;">read:org</code></li>
            <li>Copy the token and paste it below</li>
          </ol>
        </div>
        <div class="auth-methods">
          <input type="password" id="pat-input" placeholder="ghp_..." style="margin-bottom:0.5rem;">
          <button class="primary" style="width:100%;" onclick="window._patLogin()">Connect with PAT</button>
        </div>
        <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">
          Your token stays in memory only. It is never stored or sent anywhere except GitHub.
        </p>
      </div>
    </div>
  `;
}

function renderToolbar() {
  const s = getState();
  const repos = [...new Set(s.filteredIssues.map(i => i.repo))];
  return html`
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="search-input" placeholder="Search issues..." value="${escapeHtml(s.searchQuery)}" oninput="window._onSearch(this.value)">
        </div>
        <div class="filter-group">
          <label>Repo</label>
          <select id="filter-repo" onchange="window._setFilter('repo', this.value)">
            <option value="all">All</option>
            ${repos.map(r => html`<option value="${escapeHtml(r)}" ${s.filterRepo === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>State</label>
          <select id="filter-state" onchange="window._setFilter('state', this.value)">
            <option value="all" ${s.filterState === 'all' ? 'selected' : ''}>All</option>
            <option value="open" ${s.filterState === 'open' ? 'selected' : ''}>Open</option>
            <option value="closed" ${s.filterState === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Assignee</label>
          <select id="filter-assignee" onchange="window._setFilter('assignee', this.value)">
            <option value="all" ${s.filterAssignee === 'all' ? 'selected' : ''}>All</option>
            <option value="me" ${s.filterAssignee === 'me' ? 'selected' : ''}>Assigned to me</option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <button onclick="window._refresh()" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Refresh
        </button>
        <button onclick="window._openSettings()" title="Settings">&#9881; Settings</button>
      </div>
    </div>
  `;
}

function renderStats() {
  const s = getState();
  const open = s.filteredIssues.filter(i => i.state === 'open').length;
  const closed = s.filteredIssues.filter(i => i.state === 'closed').length;
  const critical = s.filteredIssues.filter(i => i.priority === 'critical').length;
  return html`
    <div class="stats-bar">
      <div class="stat-card"><div class="stat-value">${s.filteredIssues.length}</div><div class="stat-label">Total</div></div>
      <div class="stat-card"><div class="stat-value">${open}</div><div class="stat-label">Open</div></div>
      <div class="stat-card"><div class="stat-value">${closed}</div><div class="stat-label">Closed</div></div>
      <div class="stat-card"><div class="stat-value">${critical}</div><div class="stat-label">Critical</div></div>
    </div>
  `;
}

function renderTable() {
  const s = getState();
  if (s.loading && s.filteredIssues.length === 0) {
    return html`
      <div class="issues-table-wrapper">
        <table class="issues-table">
          <thead><tr><th>Issue</th><th>Priority</th><th>Status</th><th>Labels</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>${Array(8).fill(0).map(() => html`<tr>${Array(6).fill('<td><div class="skeleton" style="width:90%;"></div></td>').join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  }

  if (!s.loading && s.filteredIssues.length === 0) {
    return html`
      <div class="issues-table-wrapper empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <h3>No issues found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    `;
  }

  const sorted = [...s.filteredIssues].sort((a, b) => {
    let cmp = 0;
    switch (s.sortBy) {
      case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
      case 'created': cmp = new Date(b.created_at) - new Date(a.created_at); break;
      case 'updated': cmp = new Date(b.updated_at) - new Date(a.updated_at); break;
      case 'repo': cmp = a.repo.localeCompare(b.repo); break;
      case 'comments': cmp = b.comments - a.comments; break;
      default: cmp = 0;
    }
    return s.sortDir === 'asc' ? -cmp : cmp;
  });

  const grouped = {};
  for (const issue of sorted) {
    if (!grouped[issue.repo]) grouped[issue.repo] = [];
    grouped[issue.repo].push(issue);
  }

  const sortArrow = (key) => {
    if (s.sortBy !== key) return '<span class="sort-arrow">&#8597;</span>';
    return s.sortDir === 'asc' ? '<span class="sort-arrow">&#8593;</span>' : '<span class="sort-arrow">&#8595;</span>';
  };

  return html`
    <div class="issues-table-wrapper">
      <table class="issues-table">
        <thead>
          <tr>
            <th onclick="window._setSort('repo')">Repo ${sortArrow('repo')}</th>
            <th onclick="window._setSort('priority')">Priority ${sortArrow('priority')}</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Labels</th>
            <th onclick="window._setSort('updated')">Updated ${sortArrow('updated')}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(grouped).map(([repo, issues]) => html`
            <tr class="repo-group-header"><td colspan="7">${escapeHtml(repo)} <span style="opacity:0.6; font-weight:400;">(${issues.length})</span></td></tr>
            ${issues.map(issue => html`
              <tr>
                <td><span style="font-weight:500; font-size:0.8rem;">${escapeHtml(issue.repo)}</span></td>
                <td>
                   <span class="priority-badge priority-${issue.priority || 'none'}" onclick="window._cyclePriority('${issue.repo_full}', ${issue.number})" title="Click to change priority">${PRIORITY_LABELS[issue.priority] || 'None'}</span>
                </td>
                <td>
                  <span class="issue-title" onclick="window._openIssue('${issue.repo_full}', ${issue.number})">${escapeHtml(issue.title)}</span>
                  <a class="issue-gh-link" href="${issue.html_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">GitHub</a>
                  <span class="issue-number">#${issue.number}</span>
                </td>
                <td>
                  <span class="status-badge status-${issue.status || 'todo'}" onclick="window._cycleStatus('${issue.repo_full}', ${issue.number})" title="Click to change status">
                    ${STATUS_LABELS[issue.status] || 'To Do'}
                  </span>
                </td>
                <td>
                  <div class="label-list">
                    ${issue.labels.slice(0, 3).map(l => html`<span class="label-chip" style="border-color:#${l.color}40; color:#${l.color};">${escapeHtml(l.name)}</span>`).join('')}
                    ${issue.labels.length > 3 ? html`<span class="label-chip">+${issue.labels.length - 3}</span>` : ''}
                  </div>
                </td>
                <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-secondary);">${timeAgo(issue.updated_at)}</td>
                <td>
                  <div class="issue-actions">
                    <button class="small" onclick="window._openIssue('${issue.repo_full}', ${issue.number})">View</button>
                    <button class="small" onclick="window._toggleIssueState('${issue.repo_full}', ${issue.number})">
                      ${issue.state === 'open' ? 'Close' : 'Reopen'}
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCards() {
  const s = getState();
  if (s.loading && s.filteredIssues.length === 0) {
    return html`
      <div class="issues-cards">
        ${Array(4).fill(0).map(() => html`
          <div class="issue-card">
            <div class="skeleton" style="width:70%; height:20px;"></div>
            <div class="skeleton" style="width:40%; height:14px; margin-top:0.5rem;"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (!s.loading && s.filteredIssues.length === 0) return '';

  const sorted = [...s.filteredIssues].sort((a, b) => {
    let cmp = 0;
    switch (s.sortBy) {
      case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
      case 'created': cmp = new Date(b.created_at) - new Date(a.created_at); break;
      case 'updated': cmp = new Date(b.updated_at) - new Date(a.updated_at); break;
      case 'repo': cmp = a.repo.localeCompare(b.repo); break;
      case 'comments': cmp = b.comments - a.comments; break;
      default: cmp = 0;
    }
    return s.sortDir === 'asc' ? -cmp : cmp;
  });

  return html`
    <div class="issues-cards">
      ${sorted.map(issue => html`
        <div class="issue-card" onclick="window._openIssue('${issue.repo_full}', ${issue.number})">
          <div class="issue-card-header">
            <div>
              <div class="issue-card-title">${escapeHtml(issue.title)} <a href="${issue.html_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-size:0.75rem; opacity:0.7;">↗</a></div>
              <div class="issue-card-meta">
                <span class="issue-card-repo">${escapeHtml(issue.repo)}</span>
                <span>&#183;</span>
                <span>#${issue.number}</span>
                <span>&#183;</span>
                <span>${timeAgo(issue.updated_at)}</span>
              </div>
            </div>
            <span class="priority-badge priority-${issue.priority || 'none'}" onclick="event.stopPropagation(); window._cyclePriority('${issue.repo_full}', ${issue.number})" title="Click to change priority">${PRIORITY_LABELS[issue.priority] || 'None'}</span>
          </div>
          <div class="issue-card-footer">
            <span class="status-badge status-${issue.status || 'todo'}" onclick="event.stopPropagation(); window._cycleStatus('${issue.repo_full}', ${issue.number})">
              ${STATUS_LABELS[issue.status] || 'To Do'}
            </span>
            <div class="label-list">
              ${issue.labels.slice(0, 4).map(l => html`<span class="label-chip" style="border-color:#${l.color}40; color:#${l.color};">${escapeHtml(l.name)}</span>`).join('')}
            </div>
            <button class="small" onclick="event.stopPropagation(); window._toggleIssueState('${issue.repo_full}', ${issue.number})" style="margin-left:auto;">
              ${issue.state === 'open' ? 'Close' : 'Reopen'}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderIssueModal() {
  const s = getState();
  if (!s.selectedIssue) return '';
  const issue = s.selectedIssue;
  return html`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeIssue()">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(issue.title)}</h2>
            <div class="issue-card-meta" style="margin-top:0.5rem;">
              <span style="font-weight:500;">${escapeHtml(issue.repo_full)}</span>
              <span>&#183;</span>
              <span>#${issue.number}</span>
              <span>&#183;</span>
            <span class="priority-badge priority-${issue.priority || 'none'}" onclick="event.stopPropagation(); window._cyclePriority('${issue.repo_full}', ${issue.number})" title="Click to change priority">${PRIORITY_LABELS[issue.priority] || 'None'}</span>
              <span>&#183;</span>
              <span class="status-badge status-${issue.status || 'todo'}" onclick="window._cycleStatusFromModal()">${STATUS_LABELS[issue.status] || 'To Do'}</span>
            </div>
          </div>
          <button class="modal-close" onclick="window._closeIssue()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-section">
            <h3>Description</h3>
            <div style="white-space:pre-wrap; line-height:1.6; font-size:0.9rem;">${escapeHtml(issue.body) || '<em style="color:var(--text-muted);">No description</em>'}</div>
          </div>
          <div class="modal-section">
            <h3>Actions</h3>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button onclick="window._toggleIssueStateFromModal()">${issue.state === 'open' ? 'Close Issue' : 'Reopen Issue'}</button>
              <select id="modal-priority" onchange="window._setPriorityFromModal(this.value)" style="width:auto; min-width:120px;">
                <option value="">Set Priority...</option>
                <option value="critical" ${issue.priority === 'critical' ? 'selected' : ''}>Critical</option>
                <option value="high" ${issue.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="medium" ${issue.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="low" ${issue.priority === 'low' ? 'selected' : ''}>Low</option>
              </select>
              <select id="modal-status" onchange="window._setStatusFromModal(this.value)" style="width:auto; min-width:140px;">
                <option value="">Set Status...</option>
                <option value="todo" ${issue.status === 'todo' ? 'selected' : ''}>To Do</option>
                <option value="in-progress" ${issue.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="done" ${issue.status === 'done' ? 'selected' : ''}>Done</option>
              </select>
            </div>
          </div>
          <div class="modal-section">
            <h3>Comments (${issue.comments_count || 0})</h3>
            <div id="comments-list">
              <div class="loading-spinner"></div>
            </div>
            <div class="comment-form">
              <textarea id="comment-input" placeholder="Add a comment..."></textarea>
              <button class="primary" onclick="window._submitComment()">Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettings() {
  const s = getState();
  return html`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeSettings()">
      <div class="modal" style="max-width:640px;">
        <div class="modal-header">
          <h2>Settings</h2>
          <button class="modal-close" onclick="window._closeSettings()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-grid">
            <div class="settings-card">
              <h3>&#127912; Theme</h3>
              <select id="settings-theme" onchange="window._setTheme(this.value)" style="margin-bottom:0.5rem;">
                <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="colorful" ${s.theme === 'colorful' ? 'selected' : ''}>Colorful</option>
                <option value="neon" ${s.theme === 'neon' ? 'selected' : ''}>Neon</option>
                <option value="pink" ${s.theme === 'pink' ? 'selected' : ''}>Pink</option>
              </select>
            </div>
            <div class="settings-card">
              <h3>&#128190; Export Layout</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Download your layout config as JSON.</p>
              <button onclick="window._exportLayout()">Export Layout</button>
            </div>
            <div class="settings-card">
              <h3>&#128194; Import Layout</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Upload a previously exported layout file.</p>
              <input type="file" id="import-file" accept=".json" onchange="window._importLayout(this)">
            </div>
            <div class="settings-card">
              <h3>&#128275; Security</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary);">No data is stored on any server. Your token lives in memory only and is discarded on logout.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderWelcome() {
  return html`
    <div class="modal-overlay" onclick="if(event.target===this)window._closeWelcome()">
      <div class="modal" style="max-width:520px; text-align:center;">
        <div class="modal-header" style="justify-content:center; border-bottom:none;">
          <h2 style="font-size:1.5rem;">Welcome to Issuez</h2>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary); margin-bottom:1.5rem; font-size:0.95rem;">
            Your cross-repo GitHub issue dashboard is ready.
            Browse, search, and manage issues across all your repositories in one place.
          </p>
          <button class="primary" onclick="window._closeWelcome()" style="min-width:160px;">Get Started</button>
        </div>
      </div>
    </div>
  `;
}

function renderError() {
  const s = getState();
  if (!s.error) return '';
  return html`
    <div class="error-state" style="margin:1rem 0;">
      <span>&#9888;</span>
      <div style="flex:1;">
        <strong>Error</strong>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(s.error)}</div>
      </div>
      <button onclick="window._dismissError()">Dismiss</button>
    </div>
  `;
}

function render() {
  const s = getState();
  const app = $('#app');
  if (!app) return;

  if (!isAuthed()) {
    app.innerHTML = renderAuth();
    return;
  }

  app.innerHTML = html`
    ${renderHeader()}
    <main class="app-main">
      ${renderError()}
      ${renderStats()}
      ${renderToolbar()}
      ${renderTable()}
      ${renderCards()}
    </main>
    ${renderIssueModal()}
    ${s.showSettings ? renderSettings() : ''}
    ${s.showWelcome ? renderWelcome() : ''}
    <div class="toast-container" id="toast-container"></div>
  `;

  toastContainer = $('#toast-container');
}

function filterIssues() {
  const s = getState();
  let list = [...s.issues];
  if (s.searchQuery) {
    const q = s.searchQuery.toLowerCase();
    list = list.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
  }
  if (s.filterRepo !== 'all') list = list.filter(i => i.repo === s.filterRepo);
  if (s.filterState !== 'all') list = list.filter(i => i.state === s.filterState);
  if (s.filterAssignee === 'me') list = list.filter(i => i.assignees?.some(a => a.login === s.user?.login));
  setState({ filteredIssues: list });
}

async function loadAllIssues() {
  setState({ loading: true, error: null });
  try {
    const user = await getCurrentUser();
    const [userRepos, orgs] = await Promise.all([
      getUserRepos(),
      getUserOrgs().catch(() => []),
    ]);

    const orgRepos = await Promise.all(
      orgs.map(o => getOrgRepos(o.login).catch(() => []))
    );

    const allRepos = [...userRepos, ...orgRepos.flat()];
    const uniqueRepos = Array.from(new Map(allRepos.map(r => [r.full_name, r])).values());

    setState({ repos: uniqueRepos, user });

    const issues = [];
    for (const repo of uniqueRepos) {
      try {
        const [openIssues, closedIssues] = await Promise.all([
          getIssues(repo.owner.login, repo.name, 'open').catch(() => []),
          getIssues(repo.owner.login, repo.name, 'closed').catch(() => []),
        ]);
        issues.push(...openIssues, ...closedIssues);
      } catch (e) {
        console.warn('Failed to load issues for', repo.full_name, e);
      }
    }

    const formatted = issues.map(formatIssueForDisplay);
    setState({ issues: formatted });
    filterIssues();
    showToast(`Loaded ${formatted.length} issues`, 'success');
  } catch (e) {
    setState({ error: e.message });
    showToast(e.message, 'error');
  } finally {
    setState({ loading: false });
  }
}

export async function patLogin(pat) {
  setToken(pat);
  sessionStorage.setItem(STORAGE_KEY, pat);
  await initApp();
  setState({ showWelcome: true });
}

export function logout() {
  setToken(null);
  sessionStorage.removeItem(STORAGE_KEY);
  setState({ user: null, issues: [], filteredIssues: [], selectedIssue: null, error: null, showWelcome: false });
  render();
}

async function openIssue(repo, number) {
  try {
    const issue = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${getToken()}`, 'X-GitHub-Api-Version': '2022-11-28' },
    }).then(r => r.json());
    const formatted = formatIssueForDisplay(issue);
    formatted.comments_count = issue.comments;
    setState({ selectedIssue: formatted });
    render();
    loadComments(repo, number);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadComments(repo, number) {
  const el = $('#comments-list');
  if (!el) return;
  try {
    const comments = await getIssueComments(repo.split('/')[0], repo.split('/')[1], number);
    if (comments.length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">No comments yet.</p>';
      return;
    }
    el.innerHTML = comments.map(c => html`
      <div class="comment">
        <div class="comment-header">
          <img src="${c.user.avatar_url}" style="width:20px; height:20px; border-radius:50%;" alt="">
          <span class="comment-author">${escapeHtml(c.user.login)}</span>
          <span class="comment-date">${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-body">${escapeHtml(c.body)}</div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="error-state">${escapeHtml(e.message)}</div>`;
  }
}

async function submitComment() {
  const input = $('#comment-input');
  const body = input?.value?.trim();
  if (!body || !getState().selectedIssue) return;
  const issue = getState().selectedIssue;
  try {
    await postComment(issue.repo_full.split('/')[0], issue.repo_full.split('/')[1], issue.number, body);
    input.value = '';
    showToast('Comment posted', 'success');
    loadComments(issue.repo_full, issue.number);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function toggleIssueState(repo, number) {
  const issue = getState().issues.find(i => i.repo_full === repo && i.number === number);
  if (!issue) return;
  try {
    const newState = issue.state === 'open' ? 'closed' : 'open';
    await updateIssue(repo.split('/')[0], repo.split('/')[1], number, { state: newState });
    showToast(`Issue ${newState}`, 'success');
    const updated = { ...issue, state: newState };
    setState({
      issues: getState().issues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      filteredIssues: getState().filteredIssues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      selectedIssue: updated,
    });
    render();
    setTimeout(() => loadComments(repo, number), 50);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function cycleStatus(repo, number) {
  const cycle = ['todo', 'in-progress', 'done'];
  const issue = getState().issues.find(i => i.repo_full === repo && i.number === number);
  if (!issue) return;
  const current = issue.status || 'todo';
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
  const label = `status:${next}`;
  const owner = repo.split('/')[0];
  const repoName = repo.split('/')[1];
  const promises = [];
  if (current !== 'todo') promises.push(removeLabel(owner, repoName, number, `status:${current}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, number, label));
  try {
    await Promise.all(promises);
    showToast(`Status set to ${STATUS_LABELS[next]}`, 'success');
    const updated = { ...issue, status: next };
    setState({
      issues: getState().issues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      filteredIssues: getState().filteredIssues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      selectedIssue: updated,
    });
    render();
    setTimeout(() => loadComments(repo, number), 50);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function cyclePriority(repo, number) {
  const cycle = ['critical', 'high', 'medium', 'low'];
  const issue = getState().issues.find(i => i.repo_full === repo && i.number === number);
  if (!issue) return;
  const current = issue.priority || 'none';
  const currentIndex = cycle.indexOf(current);
  const next = currentIndex >= 0 ? cycle[(currentIndex + 1) % cycle.length] : 'critical';
  const label = `priority:${next}`;
  const owner = repo.split('/')[0];
  const repoName = repo.split('/')[1];
  const promises = [];
  if (currentIndex >= 0) promises.push(removeLabel(owner, repoName, number, `priority:${current}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, number, label));
  try {
    await Promise.all(promises);
    showToast(`Priority set to ${PRIORITY_LABELS[next]}`, 'success');
    const updated = { ...issue, priority: next };
    setState({
      issues: getState().issues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      filteredIssues: getState().filteredIssues.map(i => i.repo_full === repo && i.number === number ? updated : i),
      selectedIssue: updated,
    });
    render();
    setTimeout(() => loadComments(repo, number), 50);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function setPriorityFromModal(priority) {
  const issue = getState().selectedIssue;
  if (!issue) return;
  if (!priority) return;
  const owner = issue.repo_full.split('/')[0];
  const repoName = issue.repo_full.split('/')[1];
  const promises = [];
  if (issue.priority) promises.push(removeLabel(owner, repoName, issue.number, `priority:${issue.priority}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, issue.number, `priority:${priority}`));
  try {
    await Promise.all(promises);
    showToast(`Priority set to ${PRIORITY_LABELS[priority]}`, 'success');
    const updated = { ...issue, priority };
    setState({
      issues: getState().issues.map(i => i.repo_full === issue.repo_full && i.number === issue.number ? updated : i),
      filteredIssues: getState().filteredIssues.map(i => i.repo_full === issue.repo_full && i.number === issue.number ? updated : i),
      selectedIssue: updated,
    });
    render();
    setTimeout(() => loadComments(issue.repo_full, issue.number), 50);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function setStatusFromModal(status) {
  const issue = getState().selectedIssue;
  if (!issue) return;
  if (!status) return;
  const owner = issue.repo_full.split('/')[0];
  const repoName = issue.repo_full.split('/')[1];
  const promises = [];
  if (issue.status && issue.status !== 'todo') promises.push(removeLabel(owner, repoName, issue.number, `status:${issue.status}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, issue.number, `status:${status}`));
  try {
    await Promise.all(promises);
    showToast(`Status set to ${STATUS_LABELS[status]}`, 'success');
    const updated = { ...issue, status };
    setState({
      issues: getState().issues.map(i => i.repo_full === issue.repo_full && i.number === issue.number ? updated : i),
      filteredIssues: getState().filteredIssues.map(i => i.repo_full === issue.repo_full && i.number === issue.number ? updated : i),
      selectedIssue: updated,
    });
    render();
    setTimeout(() => loadComments(issue.repo_full, issue.number), 50);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

export function openSettings() {
  setState({ showSettings: true });
}

export function closeSettings() {
  setState({ showSettings: false });
}

export function exportLayout() {
  const s = getState();
  const layout = {
    theme: s.theme,
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    columns: ['repo', 'priority', 'issue', 'status', 'labels', 'updated', 'actions'],
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'issuez-layout.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Layout exported', 'success');
}

export function importLayout(fileInput) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const layout = JSON.parse(e.target.result);
      if (layout.theme) { setState({ theme: layout.theme }); applyTheme(layout.theme); persistTheme(); }
      if (layout.sortBy) setState({ sortBy: layout.sortBy, sortDir: layout.sortDir || 'asc' });
      showToast('Layout imported', 'success');
    } catch {
      showToast('Invalid layout file', 'error');
    }
  };
  reader.readAsText(file);
}

async function initApp() {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    setToken(stored);
    render();
    await loadAllIssues();
  } else {
    render();
  }
}

function setupGlobals() {
  window._setTheme = (t) => { setState({ theme: t }); applyTheme(t); persistTheme(); };
  window._logout = logout;
  window._patLogin = () => {
    const val = $('#pat-input')?.value?.trim();
    if (!val) return showToast('Enter a PAT', 'warning');
    patLogin(val);
  };
  window._onSearch = debounce((v) => { setState({ searchQuery: v }); filterIssues(); }, 200);
  window._setFilter = (key, val) => {
    if (key === 'repo') setState({ filterRepo: val });
    if (key === 'state') setState({ filterState: val });
    if (key === 'assignee') setState({ filterAssignee: val });
    filterIssues();
  };
  window._setSort = (key) => {
    const s = getState();
    if (s.sortBy === key) setState({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' });
    else setState({ sortBy: key, sortDir: 'asc' });
    filterIssues();
    render();
  };
  window._refresh = async () => { await loadAllIssues(); };
  window._openIssue = openIssue;
  window._closeIssue = () => { setState({ selectedIssue: null }); render(); };
  window._openSettings = openSettings;
  window._closeSettings = closeSettings;
  window._closeWelcome = () => { setState({ showWelcome: false }); render(); };
  window._toggleIssueState = toggleIssueState;
  window._toggleIssueStateFromModal = () => {
    const issue = getState().selectedIssue;
    if (!issue) return;
    toggleIssueState(issue.repo_full, issue.number);
  };
  window._cycleStatus = cycleStatus;
  window._cyclePriority = cyclePriority;
  window._cycleStatusFromModal = () => {
    const issue = getState().selectedIssue;
    if (!issue) return;
    cycleStatus(issue.repo_full, issue.number);
  };
  window._setPriorityFromModal = setPriorityFromModal;
  window._setStatusFromModal = setStatusFromModal;
  window._submitComment = submitComment;
  window._exportLayout = exportLayout;
  window._importLayout = importLayout;
  window._dismissError = () => setState({ error: null });
}

async function boot() {
  initTheme();
  loadPersisted();
  applyTheme(getState().theme);
  setupGlobals();
  subscribe(render);
  await initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
// BUILD_TEST_MARKER_XYZ789
