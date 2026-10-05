import { escapeHtml, formatDate, timeAgo } from '../utils/helpers.js';

const API_BASE = 'https://api.github.com';
const PER_PAGE = 100;
const RATE_LIMIT_MAX_WAIT_MS = 60000;
const SECONDARY_RATE_LIMIT_MESSAGE = 'GitHub secondary rate limit reached — too many requests from this client. Wait a minute and try again.';

let token = null;
let rateLimit = { remaining: 5000, reset: 0 };

export function setToken(t) { token = t; }
export function getToken() { return token; }
export function isAuthed() { return !!token; }

export function getRateLimit() { return rateLimit; }

export function rateLimitWaitMs(state = rateLimit) {
  if (state.remaining > 1) return 0;
  return Math.max(0, state.reset - Date.now());
}

export function rateLimitExhausted() {
  return rateLimitWaitMs() > RATE_LIMIT_MAX_WAIT_MS;
}

const rateLimitMessage = () => 'GitHub rate limit reached. Try again after ' + new Date(rateLimit.reset).toLocaleTimeString();

// A response with no X-RateLimit-* header — some error paths, some proxies — used to be
// read as "5000 remaining", which quietly reset the budget to full and hid an exhausted
// quota from rateLimitExhausted(). Only trust a header that is actually present.
function applyRateLimitHeaders(res) {
  const remaining = res.headers.get('X-RateLimit-Remaining');
  if (remaining !== null && remaining !== '') rateLimit.remaining = parseInt(remaining, 10);
  const reset = res.headers.get('X-RateLimit-Reset');
  if (reset !== null && reset !== '') rateLimit.reset = parseInt(reset, 10) * 1000;
}

// GitHub answers errors with a JSON envelope; passing the body through verbatim put
// {"message":"…","documentation_url":"…"} straight into the toast, so pull the human
// sentence out of it and only fall back to the raw text when it is not JSON.
async function readErrorMessage(res) {
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    console.warn('[issuez] Could not read the GitHub error body — the response was truncated or the connection dropped.', e);
    return res.statusText || `HTTP ${res.status}`;
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.message === 'string' && parsed.message) return parsed.message;
    if (Array.isArray(parsed?.errors)) return parsed.errors.map(e => e?.message || e?.code).filter(Boolean).join(', ');
  } catch {
    // Not JSON — a proxy error page or a plain-text body. The raw text is the best we have.
  }
  return text || res.statusText || `HTTP ${res.status}`;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': token ? `Bearer ${token}` : undefined,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  applyRateLimitHeaders(res);

  if (res.status === 401) throw new Error('Unauthorized');
  if (res.status === 403 && rateLimit.remaining <= 0) throw new Error(rateLimitMessage());
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res;
}

export async function fetchWithPagination(path) {
  const results = [];
  let url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=1`;

  while (url) {
    const wait = rateLimitWaitMs();
    if (wait > RATE_LIMIT_MAX_WAIT_MS) {
      throw new Error(rateLimitMessage());
    }
    if (wait > 0) await new Promise(r => setTimeout(r, wait));

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': token ? `Bearer ${token}` : undefined,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    applyRateLimitHeaders(res);

    if (!res.ok) {
      // Paginated calls used to have no 401/403 handling at all, so a revoked token or a
      // secondary rate limit surfaced GitHub's raw JSON envelope instead of a sentence.
      if (res.status === 401) throw new Error('Unauthorized');
      if (res.status === 403 && rateLimit.remaining <= 0) throw new Error(rateLimitMessage());
      const message = await readErrorMessage(res);
      if (res.status === 403 && /secondary rate limit/i.test(message)) throw new Error(SECONDARY_RATE_LIMIT_MESSAGE);
      throw new Error(message);
    }

    const data = await res.json();
    results.push(...data);

    const link = res.headers.get('Link');
    if (!link) break;
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  return results;
}

export async function getCurrentUser() {
  const res = await request('/user');
  return res.json();
}

export async function getUserRepos() {
  return fetchWithPagination('/user/repos?sort=updated');
}

export async function getUserOrgs() {
  return fetchWithPagination('/user/orgs');
}

export async function getOrgRepos(org) {
  return fetchWithPagination(`/orgs/${encodeURIComponent(org)}/repos?sort=updated`);
}

export async function getIssues(owner, repo, state = 'open') {
  const res = await fetchWithPagination(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${encodeURIComponent(state)}`);
  // REST v3 has no "issues only" parameter — pull requests arrive on the same endpoint,
  // so they cost quota and bandwidth and can only be dropped here. See README.
  return res.filter(i => !i.pull_request);
}

export async function getIssue(owner, repo, issueNumber) {
  const res = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}`);
  return res.json();
}

export async function getIssueComments(owner, repo, issueNumber) {
  const res = await fetchWithPagination(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/comments`);
  return res;
}

export async function postComment(owner, repo, issueNumber, body) {
  const res = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return res.json();
}

export async function updateIssue(owner, repo, issueNumber, data) {
  const res = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function addLabel(owner, repo, issueNumber, label) {
  const res = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([label]),
  });
  return res.json();
}

export async function removeLabel(owner, repo, issueNumber, label) {
  await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
  });
}

export function formatIssueForDisplay(issue) {
  const labels = issue.labels.map(l => ({ name: l.name, color: l.color }));
  const priority = labels.find(l => l.name.startsWith('priority:'))?.name.replace('priority:', '') || null;
  const status = labels.find(l => l.name.startsWith('status:'))?.name.replace('status:', '') || null;

  const repoUrl = issue.repository_url || '';
  const urlParts = repoUrl.split("/").filter(Boolean);
  const repo = urlParts[urlParts.length - 1] || "unknown";
  const owner = urlParts[urlParts.length - 2] || "unknown";
  const repo_full = `${owner}/${repo}`;
  

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    state: issue.state,
    html_url: issue.html_url,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    comments: issue.comments,
    user: { login: issue.user.login, avatar_url: issue.user.avatar_url },
    repo,
    repo_full,
    labels,
    priority,
    status,
    pull_request: issue.pull_request,
  };
} 
