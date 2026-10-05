const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const html = (strings, ...values) => strings.reduce((r, s, i) => r + s + (values[i] ?? ''), '');
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
// GitHub's clock and the client's can disagree, so a future updated_at would render
// as "-42s ago"; clamp the elapsed seconds at zero rather than showing a negative age.
const timeAgo = (d) => { const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime())/1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABELS = { 'todo': 'To Do', 'in-progress': 'In Progress', 'done': 'Done' };
const PRIORITY_VALUES = ['critical', 'high', 'medium', 'low'];
const STATUS_VALUES = ['todo', 'in-progress', 'done'];
const STORAGE_KEY = 'issuez_token';
const LAYOUT_KEY = 'issuez_layout';
const THEME_KEY = 'issuez_theme';

const getPriority = (issue) => issue.labels.find(l => l.name.startsWith('priority:'))?.name.replace('priority:', '') || null;
const getStatus = (issue) => issue.labels.find(l => l.name.startsWith('status:'))?.name.replace('status:', '') || null;
const getPrioritySortValue = (issue) => PRIORITY_ORDER[getPriority(issue)] ?? 99;

// Label names are attacker-controlled on any repo the user can read, and they land in
// class attributes, so they are constrained to the enum instead of escaped.
const priorityClass = (issue) => PRIORITY_VALUES.includes(getPriority(issue)) ? getPriority(issue) : 'none';
const statusClass = (issue) => STATUS_VALUES.includes(getStatus(issue)) ? getStatus(issue) : 'todo';

const safeGitHubUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' ? u.href : '';
  } catch {
    return '';
  }
};

// Must stay in sync with the img-src directive in index.html: a host permitted here
// but missing from the CSP is an avatar that passes the guard and then fails to load,
// and a host permitted in the CSP but missing here is an unused grant.
const AVATAR_HOSTS = ['avatars.githubusercontent.com', 'camo.githubusercontent.com'];
const safeAvatarUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && AVATAR_HOSTS.includes(u.hostname) ? u.href : '';
  } catch {
    return '';
  }
};

const safeLabelColor = (color) => /^[0-9a-fA-F]{6}$/.test(String(color)) ? color : '808080';

const sortIssues = (issues, sortBy, sortDir) => {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...issues].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'priority': cmp = getPrioritySortValue(a) - getPrioritySortValue(b); break;
      case 'created': cmp = new Date(a.created_at) - new Date(b.created_at); break;
      case 'updated': cmp = new Date(a.updated_at) - new Date(b.updated_at); break;
      case 'repo': cmp = a.repo.localeCompare(b.repo); break;
      case 'comments': cmp = a.comments - b.comments; break;
      default: cmp = 0;
    }
    return cmp * dir;
  });
};

export { $, $$, html, escapeHtml, debounce, formatDate, timeAgo, PRIORITY_ORDER, PRIORITY_LABELS, PRIORITY_VALUES, STATUS_LABELS, STATUS_VALUES, STORAGE_KEY, LAYOUT_KEY, THEME_KEY, getPriority, getStatus, getPrioritySortValue, priorityClass, statusClass, safeGitHubUrl, safeAvatarUrl, safeLabelColor, sortIssues };