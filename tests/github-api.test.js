import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rateLimitWaitMs, rateLimitExhausted, setToken, getIssue, formatIssueForDisplay,
  fetchWithPagination, getIssues, getUserRepos, getRateLimit,
} from '../src/api/github.js';

describe('rate-limit budget (ISSUEZ-008)', () => {
  it('returns no wait while budget remains', () => {
    expect(rateLimitWaitMs({ remaining: 5000, reset: Date.now() - 1000 })).toBe(0);
  });

  it('returns the remaining wait once the budget is down to its last request', () => {
    expect(rateLimitWaitMs({ remaining: 1, reset: Date.now() - 1000 })).toBe(0);
    const wait = rateLimitWaitMs({ remaining: 1, reset: Date.now() + 30000 });
    expect(wait).toBeGreaterThan(25000);
    expect(wait).toBeLessThanOrEqual(30000);
  });

  it('treats a wait beyond the 60s cap as exhausted so callers can bail out', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      expect(rateLimitWaitMs({ remaining: 0, reset: Date.now() + 60001 })).toBeGreaterThan(60000);
      expect(rateLimitWaitMs({ remaining: 0, reset: Date.now() + 59999 })).toBeLessThanOrEqual(60000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getIssue goes through the API layer (ISSUEZ-007, ISSUEZ-013)', () => {
  let calls;
  let respond;

  beforeEach(() => {
    calls = [];
    respond = () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({}) });
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(url);
      return respond(url);
    });
    setToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const headers = () => ({
    get: (k) => (k === 'X-RateLimit-Remaining' ? '4999' : k === 'X-RateLimit-Reset' ? '0' : null),
  });

  it('turns a 401 into Unauthorized instead of parsing the error body as an issue', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401, headers: headers(), text: async () => '{"message":"Bad credentials"}' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('Unauthorized');
  });

  it('surfaces a real error body rather than a TypeError from the formatter', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, headers: headers(), text: async () => 'server exploded' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('server exploded');
  });

  it('encodes every caller-supplied path segment', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(url);
      return { ok: true, status: 200, headers: headers(), json: async () => ({ user: {} }) };
    });
    await getIssue('own er', 're/po', '7;x');
    expect(calls[0]).toBe('https://api.github.com/repos/own%20er/re%2Fpo/issues/7%3Bx');
  });
});

describe('rateLimitExhausted default state', () => {
  it('is false before any request has been made', () => {
    expect(rateLimitExhausted()).toBe(false);
  });
});

describe('formatIssueForDisplay stays total', () => {
  it('reads issue.user.login — the exact field a bad response made undefined', () => {
    const formatted = formatIssueForDisplay({
      id: 1, number: 7, title: 't', body: '', state: 'open',
      html_url: 'https://github.com/o/r/issues/7',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', comments: 0,
      user: { login: 'o', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
      repository_url: 'https://api.github.com/repos/o/r', labels: [],
    });
    expect(formatted.user.login).toBe('o');
    expect(formatted.repo_full).toBe('o/r');
  });
});

// ISSUEZ-020: a response with no X-RateLimit-* header used to be read as "5000
// remaining", which reset the budget to full and hid an exhausted quota from the guard.
describe('rate-limit headers are only trusted when present (ISSUEZ-020)', () => {
  const withHeaders = (map) => ({ get: (k) => (k in map ? map[k] : null) });

  const stub = (response) => {
    globalThis.fetch = vi.fn(async () => response);
  };

  beforeEach(() => {
    setToken('t');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the known budget when a response omits X-RateLimit-Remaining', async () => {
    stub({ ok: true, status: 200, headers: withHeaders({ 'X-RateLimit-Remaining': '3' }), json: async () => ({ login: 'o' }) });
    await getIssue('o', 'r', 7);
    expect(getRateLimit().remaining).toBe(3);

    stub({ ok: true, status: 200, headers: withHeaders({}), json: async () => ({ login: 'o' }) });
    await getIssue('o', 'r', 7);

    expect(getRateLimit().remaining).toBe(3);
    expect(getRateLimit().remaining).not.toBe(5000);
  });

  it('keeps the known reset time when a response omits X-RateLimit-Reset', async () => {
    const reset = Math.floor((Date.now() + 120000) / 1000);
    stub({ ok: true, status: 200, headers: withHeaders({ 'X-RateLimit-Reset': String(reset) }), json: async () => ({ login: 'o' }) });
    await getIssue('o', 'r', 7);
    expect(getRateLimit().reset).toBe(reset * 1000);

    stub({ ok: true, status: 200, headers: withHeaders({ 'X-RateLimit-Remaining': '99' }), json: async () => ({ login: 'o' }) });
    await getIssue('o', 'r', 7);

    expect(getRateLimit().reset).toBe(reset * 1000);
  });

  it('does the same on the paginated path, so the guard can still trip', async () => {
    const past = String(Math.floor((Date.now() - 60000) / 1000));
    stub({
      ok: true, status: 200, headers: withHeaders({ 'X-RateLimit-Remaining': '1', 'X-RateLimit-Reset': past }),
      json: async () => [],
    });
    await fetchWithPagination('/user/orgs');
    expect(getRateLimit().remaining).toBe(1);

    stub({ ok: true, status: 200, headers: withHeaders({}), json: async () => [] });
    await fetchWithPagination('/user/orgs');

    expect(getRateLimit().remaining).toBe(1);
  });

  it('still records a genuinely lower budget', async () => {
    stub({ ok: true, status: 200, headers: withHeaders({ 'X-RateLimit-Remaining': '4999' }), json: async () => ({ login: 'o' }) });
    await getIssue('o', 'r', 7);
    expect(getRateLimit().remaining).toBe(4999);
  });
});

// ISSUEZ-010: raw GitHub JSON was the user-facing error, and a secondary rate limit
// (403 with budget left) fell through to the generic !res.ok branch.
describe('error bodies become sentences, not JSON (ISSUEZ-010)', () => {
  const json = (status, body, extraHeaders = {}) => ({
    ok: false,
    status,
    statusText: 'Forbidden',
    headers: { get: (k) => (k === 'X-RateLimit-Remaining' ? '4000' : k === 'X-RateLimit-Reset' ? '0' : (k in extraHeaders ? extraHeaders[k] : null)) },
    text: async () => JSON.stringify(body),
    json: async () => body,
  });

  beforeEach(() => setToken('t'));
  afterEach(() => vi.restoreAllMocks());

  it('extracts the message from a GitHub error envelope on the single-request path', async () => {
    globalThis.fetch = vi.fn(async () => json(422, { message: 'Validation Failed', documentation_url: 'https://docs.github.com/x' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('Validation Failed');
  });

  it('extracts the message on the paginated path, where there was no mapping at all', async () => {
    globalThis.fetch = vi.fn(async () => json(401, { message: 'Bad credentials' }));
    await expect(fetchWithPagination('/user/repos')).rejects.toThrow('Unauthorized');
  });

  it('never puts a JSON envelope in front of the user', async () => {
    globalThis.fetch = vi.fn(async () => json(500, { message: 'Server Error', documentation_url: 'https://docs.github.com/y' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow(/^Server Error$/);
  });

  it('recognises a secondary rate limit and replaces GitHub wording with something actionable', async () => {
    globalThis.fetch = vi.fn(async () => json(403, { message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' }));
    // The assertion has to distinguish the app's own sentence from GitHub's raw one, or
    // it passes even with the mapping removed.
    await expect(fetchWithPagination('/user/repos')).rejects.toThrow(/secondary rate limit reached/i);
    await expect(fetchWithPagination('/user/repos')).rejects.not.toThrow(/exceeded a secondary rate limit/i);
  });

  it('joins a validation errors array when there is no top-level message', async () => {
    globalThis.fetch = vi.fn(async () => json(422, { errors: [{ message: 'title is required' }, { code: 'custom' }] }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('title is required, custom');
  });

  it('falls back to the raw text for a non-JSON body', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', headers: { get: () => null }, text: async () => '<html>gateway</html>' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('<html>gateway</html>');
  });

  it('falls back to the status text for an empty body instead of throwing an empty message', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', headers: { get: () => null }, text: async () => '' }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('Bad Gateway');
  });

  it('reports an unreadable body rather than masking it', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500, statusText: 'Internal Server Error', headers: { get: () => null },
      text: async () => { throw new Error('socket hang up'); },
    }));
    await expect(getIssue('o', 'r', 7)).rejects.toThrow('Internal Server Error');
  });
});

// ISSUEZ-017: callers appended per_page=100 to a path fetchWithPagination already
// completed with per_page, so every request carried the parameter twice.
describe('paginated URLs carry per_page exactly once (ISSUEZ-017)', () => {
  let calls;

  beforeEach(() => {
    setToken('t');
    calls = [];
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(url);
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] };
    });
  });

  afterEach(() => vi.restoreAllMocks());

  const perPageCount = (url) => (url.match(/per_page=/g) || []).length;

  it('is 1 for the repo list', async () => {
    await getUserRepos();
    expect(perPageCount(calls[0])).toBe(1);
  });

  it('is 1 for the issue list and keeps the state filter', async () => {
    await getIssues('o', 'r', 'closed');
    expect(perPageCount(calls[0])).toBe(1);
    expect(calls[0]).toContain('state=closed');
    expect(calls[0]).toContain('per_page=100');
  });

  it('does not confuse the owner or repo name with the parameter', async () => {
    await getIssues('per_page', 'x');
    expect(calls[0]).toContain('/repos/per_page/x/issues');
    // The encoded path segment must not be mistaken for a second query parameter.
    expect(calls[0].split('?')[1].match(/per_page=/g)).toHaveLength(1);
  });
});