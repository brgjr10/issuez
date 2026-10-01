import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimitWaitMs, rateLimitExhausted, setToken, getIssue, formatIssueForDisplay } from '../src/api/github.js';

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