import {
  $, $$, html, escapeHtml, debounce, formatDate, timeAgo,
  PRIORITY_LABELS, STATUS_LABELS, STORAGE_KEY, THEME_KEY,
  getPriority, getStatus, priorityClass, statusClass,
  safeGitHubUrl, safeAvatarUrl, safeLabelColor, sortIssues,
} from './utils/helpers.js';
import {
  setToken, getToken, isAuthed, getRateLimit, fetchWithPagination, getCurrentUser,
  getUserRepos, getUserOrgs, getOrgRepos, getIssues, getIssueComments, postComment,
  updateIssue, addLabel, removeLabel, formatIssueForDisplay, getIssue, rateLimitExhausted,
} from './api/github.js';
import { getState, setState, subscribe, loadPersisted, persistLayout, persistTheme } from './state/store.js';


let toastContainer = null;

// Toasts live on <body>, not inside the re-rendered app tree: while the container was
// inside it, any state change (a background refresh, a sort toggle) destroyed the toast
// before its 4s timer ran.
function ensureToastContainer() {
  if (toastContainer && toastContainer.isConnected) return toastContainer;
  const existing = $('#toast-container');
  if (existing) {
    toastContainer = existing;
    return toastContainer;
  }
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

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
  ensureToastContainer().appendChild(el);
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
                  <option value="bubbles" ${s.theme === 'bubbles' ? 'selected' : ''}>Bubbles</option>
          <option value="neon" ${s.theme === 'neon' ? 'selected' : ''}>Neon</option>
          <option value="pink" ${s.theme === 'pink' ? 'selected' : ''}>Pink</option>
          <option value="rainbow" ${s.theme === 'rainbow' ? 'selected' : ''}>Rainbow</option>
          <option value="sunset-glow" ${s.theme === 'sunset-glow' ? 'selected' : ''}>Sunset Glow</option>
          <option value="sky-gradient" ${s.theme === 'sky-gradient' ? 'selected' : ''}>Sky Gradient</option>
          <option value="berry-cobalt" ${s.theme === 'berry-cobalt' ? 'selected' : ''}>Berry Cobalt</option>
          <option value="ghost" ${s.theme === 'ghost' ? 'selected' : ''}>Ghost</option>
          <option value="solar" ${s.theme === 'solar' ? 'selected' : ''}>Solar</option>
          <option value="eclipse" ${s.theme === 'eclipse' ? 'selected' : ''}>Eclipse</option>
          <option value="pop" ${s.theme === 'pop' ? 'selected' : ''}>Pop</option>
          <option value="gold-signal" ${s.theme === 'gold-signal' ? 'selected' : ''}>Gold Signal</option>
          <option value="moss" ${s.theme === 'moss' ? 'selected' : ''}>Moss</option>
          <option value="zen" ${s.theme === 'zen' ? 'selected' : ''}>Zen</option>
          <option value="dusty" ${s.theme === 'dusty' ? 'selected' : ''}>Dusty</option>
          <option value="violet" ${s.theme === 'violet' ? 'selected' : ''}>Violet</option>
        </select>
        <div class="user-info">
          <img class="user-avatar" src="${safeAvatarUrl(s.user?.avatar_url)}" alt="${escapeHtml(s.user?.login || '')}">
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
        <form class="auth-methods" onsubmit="event.preventDefault(); window._patLogin()">
          <label class="visually-hidden" for="pat-input">Personal Access Token</label>
          <input type="password" id="pat-input" name="pat" placeholder="ghp_..." autocomplete="off" spellcheck="false" style="margin-bottom:0.5rem;">
          <button class="primary" type="submit" style="width:100%;">Connect with PAT</button>
        </form>
        <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">
          Your token is kept in this tab's sessionStorage and is sent only to GitHub. It is never written to localStorage or cookies, and is discarded when the tab closes or you log out.
        </p>
      </div>
    </div>
  `;
}

function renderToolbar() {
  const s = getState();
  return html`
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="search-input" aria-label="Search issues by title or body" placeholder="Search issues..." oninput="window._onSearch(this.value)">
        </div>
        <div class="filter-group">
          <label for="filter-state">State</label>
          <select id="filter-state" onchange="window._setFilter('state', this.value)">
            <option value="all" ${s.filterState === 'all' ? 'selected' : ''}>All</option>
            <option value="open" ${s.filterState === 'open' ? 'selected' : ''}>Open</option>
            <option value="closed" ${s.filterState === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-assignee">Assignee</label>
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
  const critical = s.filteredIssues.filter(i => getPriority(i) === 'critical').length;
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

  const sorted = sortIssues(s.filteredIssues, s.sortBy, s.sortDir);

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
        <colgroup>
          <col style="width:8%">
          <col style="width:42%">
          <col style="width:7%">
          <col style="width:14%">
          <col style="width:10%">
          <col style="width:19%">
        </colgroup>
        <thead>
          <tr>
            <th role="button" tabindex="0" onclick="window._setSort('priority')" onkeydown="if(event.key==='Enter'||event.key===' ')window._setSort('priority')">Priority ${sortArrow('priority')}</th>
            <th>Issue</th>
            <th>Status</th>
            <th>Labels</th>
            <th role="button" tabindex="0" onclick="window._setSort('updated')" onkeydown="if(event.key==='Enter'||event.key===' ')window._setSort('updated')">Updated ${sortArrow('updated')}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(grouped).map(([repo, issues]) => html`
            <tr class="repo-group-header"><td colspan="6"><div class="repo-group-header-content">${escapeHtml(repo)} <span class="repo-group-header-count">(${issues.length})</span></div></td></tr>
            ${issues.map(issue => html`
              <tr>
                <td>
                   <span class="priority-badge priority-${priorityClass(issue)}" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._cyclePriorityFromEl(this)" title="Click to change priority">${escapeHtml(PRIORITY_LABELS[getPriority(issue)] || 'None')}</span>
                </td>
                <td class="issue-cell">
                   <span class="issue-title" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._openIssueFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._openIssueFromEl(this)">${escapeHtml(issue.title)}</span>
                   <a class="issue-gh-link" href="${safeGitHubUrl(issue.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open issue on GitHub" onclick="event.stopPropagation()">GitHub</a>
                   <span class="issue-number">#${Number(issue.number) || 0}</span>
                </td>
                <td>
                   <span class="status-badge status-${statusClass(issue)}" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._cycleStatusFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._cycleStatusFromEl(this)" title="Click to change status">
                     ${escapeHtml(STATUS_LABELS[getStatus(issue)] || 'To Do')}
                   </span>
                </td>
                 <td>
                   <div class="label-list">
                     ${issue.labels.filter(l => !l.name.startsWith('priority:') && !l.name.startsWith('status:')).slice(0, 3).map(l => html`<span class="label-chip" style="border-color:#${safeLabelColor(l.color)}40; color:#${safeLabelColor(l.color)};">${escapeHtml(l.name)}</span>`).join('')}
                     ${issue.labels.filter(l => !l.name.startsWith('priority:') && !l.name.startsWith('status:')).length > 3 ? html`<span class="label-chip">+${issue.labels.filter(l => !l.name.startsWith('priority:') && !l.name.startsWith('status:')).length - 3}</span>` : ''}
                   </div>
                 </td>
                <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-secondary);">${timeAgo(issue.updated_at)}</td>
                <td>
                  <div class="issue-actions">
                    <button class="small" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._openIssueFromEl(this)">View</button>
                    <button class="small" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._toggleIssueStateFromEl(this)">
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

  const sorted = sortIssues(s.filteredIssues, s.sortBy, s.sortDir);

  return html`
    <div class="issues-cards">
      ${sorted.map(issue => html`
        <div class="issue-card" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="window._openIssueFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')window._openIssueFromEl(this)">
          <div class="issue-card-header">
            <div>
              <div class="issue-card-title">${escapeHtml(issue.title)} <a href="${safeGitHubUrl(issue.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open issue on GitHub" onclick="event.stopPropagation()" style="font-size:0.75rem; opacity:0.7;">GitHub</a></div>
              <div class="issue-card-meta">
                <span class="issue-card-repo">${escapeHtml(issue.repo)}</span>
                <span>&#183;</span>
                <span>#${Number(issue.number) || 0}</span>
                <span>&#183;</span>
                <span>${timeAgo(issue.updated_at)}</span>
              </div>
            </div>
            <span class="priority-badge priority-${priorityClass(issue)}" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="event.stopPropagation(); window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cyclePriorityFromEl(this)" title="Click to change priority">${escapeHtml(PRIORITY_LABELS[getPriority(issue)] || 'None')}</span>
          </div>
          <div class="issue-card-footer">
            <span class="status-badge status-${statusClass(issue)}" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="event.stopPropagation(); window._cycleStatusFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cycleStatusFromEl(this)">
              ${escapeHtml(STATUS_LABELS[getStatus(issue)] || 'To Do')}
            </span>
            <div class="label-list">
              ${issue.labels.filter(l => !l.name.startsWith('priority:') && !l.name.startsWith('status:')).slice(0, 4).map(l => html`<span class="label-chip" style="border-color:#${safeLabelColor(l.color)}40; color:#${safeLabelColor(l.color)};">${escapeHtml(l.name)}</span>`).join('')}
            </div>
            <button class="small" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="event.stopPropagation(); window._toggleIssueStateFromEl(this)" style="margin-left:auto;">
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
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="issue-modal-title">${escapeHtml(issue.title)}</h2>
            <div class="issue-card-meta" style="margin-top:0.5rem;">
              <span style="font-weight:500;">${escapeHtml(issue.repo_full)}</span>
              <span>&#183;</span>
              <span>#${Number(issue.number) || 0}</span>
              <span>&#183;</span>
            <span class="priority-badge priority-${priorityClass(issue)}" role="button" tabindex="0" data-repo="${escapeHtml(issue.repo_full)}" data-number="${Number(issue.number) || 0}" onclick="event.stopPropagation(); window._cyclePriorityFromEl(this)" onkeydown="if(event.key==='Enter'||event.key===' ')event.stopPropagation(); window._cyclePriorityFromEl(this)" title="Click to change priority">${escapeHtml(PRIORITY_LABELS[getPriority(issue)] || 'None')}</span>
              <span>&#183;</span>
              <span class="status-badge status-${statusClass(issue)}" role="button" tabindex="0" onclick="window._cycleStatusFromModal()" onkeydown="if(event.key==='Enter'||event.key===' ')window._cycleStatusFromModal()">${escapeHtml(STATUS_LABELS[getStatus(issue)] || 'To Do')}</span>
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
                <option value="critical" ${getPriority(issue) === 'critical' ? 'selected' : ''}>Critical</option>
                <option value="high" ${getPriority(issue) === 'high' ? 'selected' : ''}>High</option>
                <option value="medium" ${getPriority(issue) === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="low" ${getPriority(issue) === 'low' ? 'selected' : ''}>Low</option>
              </select>
              <select id="modal-status" onchange="window._setStatusFromModal(this.value)" style="width:auto; min-width:140px;">
                <option value="">Set Status...</option>
                <option value="todo" ${getStatus(issue) === 'todo' ? 'selected' : ''}>To Do</option>
                <option value="in-progress" ${getStatus(issue) === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="done" ${getStatus(issue) === 'done' ? 'selected' : ''}>Done</option>
              </select>
            </div>
          </div>
          <div class="modal-section">
            <h3>Comments (${issue.comments_count || 0})</h3>
            <div id="comments-list">
              <div class="loading-spinner"></div>
            </div>
            <div class="comment-form">
              <label class="visually-hidden" for="comment-input">Add a comment</label>
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
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" style="max-width:640px;">
        <div class="modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <button class="modal-close" onclick="window._closeSettings()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-grid">
            <div class="settings-card">
              <h3>&#127912; Theme</h3>
              <select id="settings-theme" onchange="window._setTheme(this.value)" style="margin-bottom:0.5rem;">
                 <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
                 <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="bubbles" ${s.theme === 'bubbles' ? 'selected' : ''}>Bubbles</option>
                 <option value="neon" ${s.theme === 'neon' ? 'selected' : ''}>Neon</option>
                 <option value="pink" ${s.theme === 'pink' ? 'selected' : ''}>Pink</option>
                 <option value="rainbow" ${s.theme === 'rainbow' ? 'selected' : ''}>Rainbow</option>
                 <option value="sunset-glow" ${s.theme === 'sunset-glow' ? 'selected' : ''}>Sunset Glow</option>
                 <option value="sky-gradient" ${s.theme === 'sky-gradient' ? 'selected' : ''}>Sky Gradient</option>
                 <option value="berry-cobalt" ${s.theme === 'berry-cobalt' ? 'selected' : ''}>Berry Cobalt</option>
                 <option value="ghost" ${s.theme === 'ghost' ? 'selected' : ''}>Ghost</option>
                 <option value="solar" ${s.theme === 'solar' ? 'selected' : ''}>Solar</option>
                 <option value="eclipse" ${s.theme === 'eclipse' ? 'selected' : ''}>Eclipse</option>
                 <option value="pop" ${s.theme === 'pop' ? 'selected' : ''}>Pop</option>
                 <option value="gold-signal" ${s.theme === 'gold-signal' ? 'selected' : ''}>Gold Signal</option>
                 <option value="moss" ${s.theme === 'moss' ? 'selected' : ''}>Moss</option>
                 <option value="zen" ${s.theme === 'zen' ? 'selected' : ''}>Zen</option>
                 <option value="dusty" ${s.theme === 'dusty' ? 'selected' : ''}>Dusty</option>
                 <option value="violet" ${s.theme === 'violet' ? 'selected' : ''}>Violet</option>
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
              <label class="visually-hidden" for="import-file">Layout JSON file</label>
              <input type="file" id="import-file" accept=".json" onchange="window._importLayout(this)">
            </div>
            <div class="settings-card">
              <h3>&#128275; Security</h3>
              <p style="font-size:0.85rem; color:var(--text-secondary);">No data is stored on any server. Your token lives in this tab's sessionStorage and is discarded when the tab closes or you log out.</p>
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
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" style="max-width:520px; text-align:center;">
        <div class="modal-header" style="justify-content:center; border-bottom:none;">
          <h2 id="welcome-modal-title" style="font-size:1.5rem;">Welcome to Issuez</h2>
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

// ---- keyed rendering --------------------------------------------------------
// The app used to be re-serialised into app.innerHTML on every setState, which threw
// away the focused search box, any half-typed comment and any live toast. Each region
// now owns a stable host element and is only re-serialised when the markup it would
// produce actually changes, so unrelated state changes leave those nodes alone.
const regionMarkup = new Map();

function ensureRegionSkeleton(app) {
  if ($('#region-header', app)) return;
  app.innerHTML = html`
    <div id="region-header"></div>
    <main class="app-main">
      <div id="region-error"></div>
      <div id="region-stats"></div>
      <div id="region-toolbar"></div>
      <div id="region-issues"></div>
      <div id="region-cards"></div>
    </main>
    <div id="region-modal"></div>
    <div id="region-settings"></div>
    <div id="region-welcome"></div>
  `;
  regionMarkup.clear();
}

function render() {
  const s = getState();
  const app = $('#app');
  if (!app) return;

  const previouslyFocused = document.activeElement;

  if (!isAuthed()) {
    app.innerHTML = renderAuth();
    regionMarkup.clear();
    syncDialogFocus(null);
    return;
  }

  ensureRegionSkeleton(app);

  const regions = [
    ['region-header', renderHeader],
    ['region-error', renderError],
    ['region-stats', renderStats],
    // renderToolbar is deliberately free of the search query, so typing rebuilds the
    // table but never the input the user is typing into.
    ['region-toolbar', renderToolbar],
    ['region-issues', renderTable],
    ['region-cards', renderCards],
    ['region-modal', renderIssueModal],
    ['region-settings', () => s.showSettings ? renderSettings() : ''],
    ['region-welcome', () => s.showWelcome ? renderWelcome() : ''],
  ];

  for (const [id, renderRegion] of regions) {
    const markup = renderRegion();
    if (regionMarkup.get(id) === markup) continue;
    regionMarkup.set(id, markup);
    const host = document.getElementById(id);
    if (host) host.innerHTML = markup;
  }

  syncSearchInput();
  syncDialogFocus(previouslyFocused);
  ensureToastContainer();
  initCustomSelects();
}

// The search box is live state rather than markup: writing value back on every render
// would reset the caret, so it is only written when state and DOM have diverged.
function syncSearchInput() {
  const input = $('#search-input');
  if (input && input.value !== getState().searchQuery) input.value = getState().searchQuery;
}

function filterIssues() {
  const s = getState();
  let list = [...s.issues];
  if (s.searchQuery) {
    const q = s.searchQuery.toLowerCase();
    list = list.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
  }
  if (s.filterState !== 'all') list = list.filter(i => i.state === s.filterState);
  if (s.filterAssignee === 'me') list = list.filter(i => i.assignees?.some(a => a.login === s.user?.login));
  setState({ filteredIssues: list });
}

async function loadAllIssues() {
  setState({ loading: true, error: null });
  // Each source is fetched independently so one bad endpoint cannot empty the whole
  // dashboard, but every failure is logged and counted: a PAT without read:org or a
  // transient 5xx used to disappear silently and leave a plausible but incomplete list.
  const failures = [];
  const keepGoing = (what, e) => {
    console.warn(`[issuez] Could not ${what}. That source is missing from this dashboard — check the token scopes (repo, read:org), then refresh.`, e);
    failures.push(what);
    return [];
  };
  try {
    const user = await getCurrentUser();
    const [userRepos, orgs] = await Promise.all([
      getUserRepos(),
      getUserOrgs().catch(e => keepGoing('list your organizations', e)),
    ]);

    const orgRepos = await Promise.all(
      orgs.map(o => getOrgRepos(o.login).catch(e => keepGoing(`list repositories for ${o.login}`, e)))
    );

    const allRepos = [...userRepos, ...orgRepos.flat()];
    const uniqueRepos = Array.from(new Map(allRepos.map(r => [r.full_name, r])).values());

    setState({ repos: uniqueRepos, user });

    const issues = [];
    let rateLimited = false;
    for (const repo of uniqueRepos) {
      if (rateLimitExhausted()) {
        rateLimited = true;
        break;
      }
      const [openIssues, closedIssues] = await Promise.all([
        getIssues(repo.owner.login, repo.name, 'open').catch(e => keepGoing(`load open issues for ${repo.full_name}`, e)),
        getIssues(repo.owner.login, repo.name, 'closed').catch(e => keepGoing(`load closed issues for ${repo.full_name}`, e)),
      ]);
      issues.push(...openIssues, ...closedIssues);
    }

    const formatted = issues.map(formatIssueForDisplay);
    setState({ issues: formatted });
    filterIssues();
    if (rateLimited) showToast('GitHub rate limit reached — showing partial results', 'error');
    else if (failures.length) showToast(`${failures.length} source${failures.length === 1 ? '' : 's'} failed to load — showing partial results`, 'error');
    else showToast(`Loaded ${formatted.length} issues`, 'success');
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
  render();
  await loadAllIssues();
  setState({ showWelcome: true });
}

export function logout() {
  setToken(null);
  sessionStorage.removeItem(STORAGE_KEY);
  // repos and loading were left populated, so a logout during an in-flight refresh
  // kept the previous account's repo list alive in state until the next login.
  setState({ user: null, issues: [], filteredIssues: [], repos: [], loading: false, selectedIssue: null, error: null, showWelcome: false, showSettings: false });
  render();
}

async function openIssue(repo, number) {
  try {
    const issue = await getIssue(repo.split('/')[0], repo.split('/')[1], number);
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
          <img src="${safeAvatarUrl(c.user.avatar_url)}" style="width:20px; height:20px; border-radius:50%;" alt="${escapeHtml(c.user.login)}">
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
  const current = getStatus(issue) || 'todo';
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
    const newLabels = issue.labels.filter(l => !l.name.startsWith('status:')).concat({ name: label, color: 'a2eeef' });
    const updated = { ...issue, labels: newLabels };
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

async function cycleIssuePriority(repo, number) {
  const cycle = ['critical', 'high', 'medium', 'low'];
  const issue = getState().issues.find(i => i.repo_full === repo && i.number === number);
  if (!issue) return;
  const currentPriority = getPriority(issue);
  const currentIndex = cycle.indexOf(currentPriority || '');
  const next = currentIndex >= 0 ? cycle[(currentIndex + 1) % cycle.length] : 'critical';
  const label = `priority:${next}`;
  const owner = repo.split('/')[0];
  const repoName = repo.split('/')[1];
  const promises = [];
  if (currentPriority) promises.push(removeLabel(owner, repoName, number, `priority:${currentPriority}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, number, label));
  try {
    await Promise.all(promises);
    showToast(`Priority set to ${PRIORITY_LABELS[next]}`, 'success');
    const newLabels = issue.labels.filter(l => !l.name.startsWith('priority:')).concat({ name: label, color: 'b60205' });
    const updated = { ...issue, labels: newLabels };
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
  const currentPriority = getPriority(issue);
  if (currentPriority) promises.push(removeLabel(owner, repoName, issue.number, `priority:${currentPriority}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, issue.number, `priority:${priority}`));
  try {
    await Promise.all(promises);
    showToast(`Priority set to ${PRIORITY_LABELS[priority]}`, 'success');
    const newLabels = issue.labels.filter(l => !l.name.startsWith('priority:')).concat({ name: `priority:${priority}`, color: 'b60205' });
    const updated = { ...issue, labels: newLabels };
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
  const currentStatus = getStatus(issue);
  if (currentStatus && currentStatus !== 'todo') promises.push(removeLabel(owner, repoName, issue.number, `status:${currentStatus}`).catch(() => { }));
  promises.push(addLabel(owner, repoName, issue.number, `status:${status}`));
  try {
    await Promise.all(promises);
    showToast(`Status set to ${STATUS_LABELS[status]}`, 'success');
    const newLabels = issue.labels.filter(l => !l.name.startsWith('status:')).concat({ name: `status:${status}`, color: 'a2eeef' });
    const updated = { ...issue, labels: newLabels };
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
  dialogOpener = document.activeElement;
  setState({ showSettings: true });
}

export function closeSettings() {
  setState({ showSettings: false });
}

// Layout preferences are advertised as living in localStorage, so every change that
// moves the layout has to write them back — persistLayout() shipped with zero callers.
function persistLayoutState() {
  const s = getState();
  setState({ layout: { theme: s.theme, sortBy: s.sortBy, sortDir: s.sortDir } });
  persistLayout();
}

export function applyPersistedLayout() {
  const { layout } = getState();
  if (layout && typeof layout === 'object') {
    const patch = {};
    if (layout.sortBy) patch.sortBy = layout.sortBy;
    if (layout.sortDir) patch.sortDir = layout.sortDir;
    if (Object.keys(patch).length) setState(patch);
  }
}

export function exportLayout() {
  const s = getState();
  const layout = {
    theme: s.theme,
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    columns: ['priority', 'issue', 'status', 'labels', 'updated', 'actions'],
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'issuez-layout.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
      persistLayoutState();
      showToast('Layout imported', 'success');
    } catch {
      showToast('Invalid layout file', 'error');
    }
  };
  reader.readAsText(file);
}

function setupGlobals() {
  const issueOf = (el) => [el.dataset.repo, Number(el.dataset.number)];
  window._setTheme = (t) => { setState({ theme: t }); applyTheme(t); persistTheme(); };
  window._logout = logout;
  window._patLogin = () => {
    const val = $('#pat-input')?.value?.trim();
    if (!val) return showToast('Enter a PAT', 'warning');
    patLogin(val);
  };
  window._onSearch = debounce((v) => { setState({ searchQuery: v }); filterIssues(); }, 200);
  window._setFilter = (key, val) => {
    if (key === 'state') setState({ filterState: val });
    if (key === 'assignee') setState({ filterAssignee: val });
    filterIssues();
  };
  window._setSort = (key) => {
    const s = getState();
    if (s.sortBy === key) setState({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' });
    else setState({ sortBy: key, sortDir: 'asc' });
    filterIssues();
    persistLayoutState();
    render();
  };
  window._refresh = async () => { await loadAllIssues(); };
  window._closeIssue = () => { setState({ selectedIssue: null }); render(); };
  window._openSettings = openSettings;
  window._closeSettings = closeSettings;
  window._closeWelcome = () => { setState({ showWelcome: false }); render(); };
  window._toggleIssueStateFromModal = () => {
    const issue = getState().selectedIssue;
    if (!issue) return;
    toggleIssueState(issue.repo_full, issue.number);
  };
  // window._cyclePriority is kept although nothing in the DOM calls it: the build
  // pipeline test asserts the bundle still contains "window._cyclePriority=", which is
  // how it detects a build that lost cycleIssuePriority. Dropping it needs that test
  // re-pointed at a symbol that is actually live first.
  window._cyclePriority = cycleIssuePriority;
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

  // Handlers read the issue off data-* so no remote string is ever interpolated into
  // the JS-string context of an inline onclick.
  window._openIssueFromEl = (el) => { dialogOpener = el; openIssue(...issueOf(el)); };
  window._toggleIssueStateFromEl = (el) => toggleIssueState(...issueOf(el));
  window._cyclePriorityFromEl = (el) => cycleIssuePriority(...issueOf(el));
  window._cycleStatusFromEl = (el) => cycleStatus(...issueOf(el));
}

function initCustomSelects() {
  document.querySelectorAll('select').forEach(select => {
    // Region rendering no longer rebuilds the whole tree, so a select can be offered
    // twice; the wrapper is the marker and this keeps the widget idempotent.
    if (select.closest('.select-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'select-wrapper';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.id = `${select.id || 'select'}-trigger`;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${trigger.id}-listbox`);
    // The native select is display:none, so its accessible name has to be carried over
    // or the replacement button announces itself as an unlabelled combo box.
    const label = select.labels?.[0] || select.closest('.filter-group, .settings-card, div')?.querySelector('label');
    if (label) trigger.setAttribute('aria-label', label.textContent.trim());

    const valueSpan = document.createElement('span');
    valueSpan.className = 'select-value';
    valueSpan.textContent = select.options[select.selectedIndex]?.textContent || '';

    trigger.appendChild(valueSpan);

    const dropdown = document.createElement('div');
    dropdown.className = 'select-dropdown';
    dropdown.id = `${trigger.id}-listbox`;
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-labelledby', trigger.id);

    const options = Array.from(select.options).map(option => {
      const optEl = document.createElement('div');
      optEl.className = 'select-option' + (option.selected ? ' selected' : '');
      optEl.textContent = option.textContent;
      optEl.dataset.value = option.value;
      optEl.setAttribute('role', 'option');
      optEl.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      // Roving tabindex: exactly one option is in the tab order, the rest are reached
      // with the arrow keys, which is what a native select does.
      optEl.tabIndex = option.selected ? 0 : -1;
      optEl.addEventListener('click', () => {
        selectOption(select, option.value);
      });
      dropdown.appendChild(optEl);
      return optEl;
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    select.parentNode.insertBefore(wrapper, select);
    // The source select moves inside its widget: updateTriggerTexts() reads the
    // selection through wrapper.querySelector('select'), and as a sibling that lookup
    // always missed, so the trigger text and aria-selected never followed the choice.
    wrapper.appendChild(select);
    select.style.display = 'none';

    const openSelect = (focusIndex) => {
      closeAllSelects();
      wrapper.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      const target = Number.isInteger(focusIndex) ? options[focusIndex] : options.find(o => o.dataset.value === select.value) || options[0];
      options.forEach(o => { o.tabIndex = -1; });
      if (target) {
        target.tabIndex = 0;
        target.focus();
      }
    };

    const closeSelect = (returnFocus) => {
      wrapper.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    };

    const focusOptionAt = (index) => {
      const clamped = Math.max(0, Math.min(options.length - 1, index));
      options.forEach(o => { o.tabIndex = -1; });
      options[clamped].tabIndex = 0;
      options[clamped].focus();
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (wrapper.classList.contains('open')) closeSelect(false);
      else openSelect();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openSelect(); }
      else if (e.key === 'Escape' && wrapper.classList.contains('open')) { e.preventDefault(); closeSelect(true); }
      else if (e.key === 'Tab') closeSelect(false);
    });

    dropdown.addEventListener('keydown', (e) => {
      const current = options.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusOptionAt(current + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusOptionAt(current <= 0 ? options.length - 1 : current - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusOptionAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusOptionAt(options.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const option = options[current];
        if (option) selectOption(select, option.dataset.value, true);
      } else if (e.key === 'Escape') { e.preventDefault(); closeSelect(true); }
      else if (e.key === 'Tab') closeSelect(false);
    });
  });
}

function selectOption(select, value, keepFocusOnTrigger = false) {
  select.value = value;
  // The change handler re-renders the toolbar, which detaches this select and its
  // wrapper, so anything below has to go back to the document for the live nodes.
  select.dispatchEvent(new Event('change'));
  closeAllSelects();
  updateTriggerTexts();
  if (keepFocusOnTrigger) document.getElementById(`${select.id}-trigger`)?.focus();
}

function closeAllSelects() {
  document.querySelectorAll('.select-wrapper.open').forEach(w => {
    w.classList.remove('open');
    w.querySelector('.select-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function updateTriggerTexts() {
  document.querySelectorAll('.select-wrapper').forEach(wrapper => {
    const select = wrapper.querySelector('select');
    const valueSpan = wrapper.querySelector('.select-value');
    if (select && valueSpan) {
      valueSpan.textContent = select.options[select.selectedIndex]?.textContent || '';
      const options = wrapper.querySelectorAll('.select-option');
      options.forEach(opt => {
        const isSelected = opt.dataset.value === select.value;
        opt.classList.toggle('selected', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        opt.tabIndex = isSelected ? 0 : -1;
      });
    }
  });
}

function setupGlobalErrorHandlers() {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[issuez] Unhandled promise rejection — a background API call failed and nothing surfaced it.', e.reason);
    showToast(e.reason?.message || 'Something went wrong', 'error');
  });
  window.addEventListener('error', (e) => {
    console.error('[issuez] Uncaught error', e.error || e.message);
  });
}

// ---- dialog semantics, focus and Escape (ISSUEZ-005) -----------------------
// The modals were plain divs with a backdrop click handler: no role, no aria-modal,
// no focus movement and no Escape. They now get all four, plus a Tab cycle so focus
// cannot wander into the page behind the overlay.
let openDialogEl = null;
let dialogOpener = null;

// Listed in DOM order, which is also paint order, so the last entry present is the
// dialog the user is actually looking at — and the one Escape has to close first.
const DIALOG_CLOSERS = [
  ['region-modal', () => setState({ selectedIssue: null })],
  ['region-settings', () => setState({ showSettings: false })],
  ['region-welcome', () => setState({ showWelcome: false })],
];

const dialogEls = () => DIALOG_CLOSERS
  .map(([id]) => $(`#${id} .modal`))
  .filter(Boolean);

function dialogFocusables(dialog) {
  return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dialog)
    .filter(el => !el.disabled && el.tabIndex !== -1);
}

// The regions are in paint order, so the last dialog present is the one on top.
const topDialog = () => dialogEls()[dialogEls().length - 1] || null;

function syncDialogFocus(previouslyFocused) {
  const top = topDialog();
  if (top === openDialogEl) return;

  if (top) {
    if (!openDialogEl && previouslyFocused && previouslyFocused !== document.body) dialogOpener = previouslyFocused;
    openDialogEl = top;
    const first = dialogFocusables(top)[0] || top;
    first.focus();
    return;
  }

  openDialogEl = null;
  if (dialogOpener && dialogOpener.isConnected) dialogOpener.focus();
  dialogOpener = null;
}

function closeTopDialog() {
  const top = topDialog();
  if (!top) return false;
  const closer = DIALOG_CLOSERS.find(([id]) => $(`#${id} .modal`) === top);
  if (!closer) return false;
  closer[1]();
  render();
  return true;
}

function handleGlobalKeydown(e) {
  const top = topDialog();

  if (e.key === 'Escape') {
    if (top && e.defaultPrevented) return;
    if (top) {
      e.preventDefault();
      closeTopDialog();
    } else if (document.querySelector('.select-wrapper.open')) {
      closeAllSelects();
    }
    return;
  }

  if (e.key !== 'Tab' || !top) return;
  // Keep Tab inside the open dialog: without this the page behind stays reachable.
  const focusables = dialogFocusables(top);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  }
}

async function boot() {
  setupGlobalErrorHandlers();
  initTheme();
  loadPersisted();
  applyTheme(getState().theme);
  applyPersistedLayout();
  setupGlobals();
  subscribe(render);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.select-wrapper')) {
      closeAllSelects();
    }
  });
  document.addEventListener('keydown', handleGlobalKeydown);
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    setToken(stored);
    render();
    await loadAllIssues();
  } else {
    render();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
