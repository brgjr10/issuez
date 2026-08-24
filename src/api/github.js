import { escapeHtml, formatDate, timeAgo } from '../utils/helpers.js';

const API_BASE = 'https://api.github.com';
const PER_PAGE = 100;

let token = null;
let rateLimit = { remaining: 5000, reset: 0 };

export function setToken(t) { token = t; }
export function getToken() { return token; }
export function isAuthed() { return !!token; }

export function getRateLimit() { return rateLimit; }

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

  rateLimit.remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '5000', 10);
  rateLimit.reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0', 10) * 1000;

  if (res.status === 401) throw new Error('Unauthorized');
  if (res.status === 403 && rateLimit.remaining <= 0) throw new Error('Rate limit exceeded. Try again after ' + new Date(rateLimit.reset).toLocaleTimeString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res;
}

export async function fetchWithPagination(path) {
  const results = [];
  let url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=1`;

  while (url) {
    if (rateLimit.remaining <= 1) {
      const wait = Math.max(0, rateLimit.reset - Date.now());
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
    }

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': token ? `Bearer ${token}` : undefined,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    rateLimit.remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '5000', 10);
    rateLimit.reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0', 10) * 1000;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
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
  return fetchWithPagination('/user/repos?sort=updated&per_page=100');
}

export async function getUserOrgs() {
  return fetchWithPagination('/user/orgs');
}

export async function getOrgRepos(org) {
  return fetchWithPagination(`/orgs/${org}/repos?sort=updated&per_page=100`);
}

export async function getIssues(owner, repo, state = 'open') {
  const res = await fetchWithPagination(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
  return res.filter(i => !i.pull_request);
}

export async function getIssueComments(owner, repo, issueNumber) {
  const res = await fetchWithPagination(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
  return res;
}

export async function postComment(owner, repo, issueNumber, body) {
  const res = await request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return res.json();
}

export async function updateIssue(owner, repo, issueNumber, data) {
  const res = await request(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function addLabel(owner, repo, issueNumber, label) {
  const res = await request(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([label]),
  });
  return res.json();
}

export async function removeLabel(owner, repo, issueNumber, label) {
  await request(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
  });
}

export function formatIssueForDisplay(issue) {
  const labels = issue.labels.map(l => ({ name: l.name, color: l.color }));
  const priority = labels.find(l => l.name.startsWith('priority:'))?.name.replace('priority:', '') || null;
  const status = labels.find(l => l.name.startsWith('status:'))?.name.replace('status:', '') || null;
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
    repo: issue.repository_url?.split('/').pop() || 'unknown',
    repo_full: `${issue.repository_url?.split('/').slice(-2).join('/') || 'unknown/unknown'}`,
    labels,
    priority,
    status,
    pull_request: issue.pull_request,
  };
}
