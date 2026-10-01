import { describe, it, expect } from 'vitest';
import {
  sortIssues, priorityClass, statusClass, getPriority, getStatus,
  safeGitHubUrl, safeAvatarUrl, safeLabelColor, escapeHtml, PRIORITY_ORDER,
} from '../src/utils/helpers.js';

const issue = (over = {}) => ({
  number: 1,
  title: 't',
  body: 'b',
  state: 'open',
  html_url: 'https://github.com/o/r/issues/1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  comments: 0,
  repo: 'r',
  repo_full: 'o/r',
  labels: [],
  ...over,
});

const labelled = (label) => issue({ labels: [{ name: label, color: 'b60205' }] });

describe('sortIssues (ISSUEZ-003)', () => {
  const critical = labelled('priority:critical');
  const high = labelled('priority:high');
  const low = labelled('priority:low');
  const unlabelled = issue({ number: 9 });
  const mixed = [unlabelled, low, critical, high];

  it('ascending priority puts critical first and unlabelled last', () => {
    const out = sortIssues(mixed, 'priority', 'asc').map(i => getPriority(i) || 'none');
    expect(out).toEqual(['critical', 'high', 'low', 'none']);
  });

  it('descending priority is the exact reverse of ascending', () => {
    const asc = sortIssues(mixed, 'priority', 'asc').map(i => i.number);
    const desc = sortIssues(mixed, 'priority', 'desc').map(i => i.number);
    expect(desc).toEqual([...asc].reverse());
  });

  it('the shipped default (priority + asc) buries nothing important at the bottom', () => {
    const out = sortIssues(mixed, 'priority', 'asc');
    expect(getPriority(out[0])).toBe('critical');
    expect(out[out.length - 1].number).toBe(unlabelled.number);
  });

  it('unknown sortDir is treated as ascending rather than silently reversed', () => {
    expect(sortIssues(mixed, 'priority', 'nonsense').map(i => i.number))
      .toEqual(sortIssues(mixed, 'priority', 'asc').map(i => i.number));
  });

  it('created/updated asc is oldest first, desc is newest first', () => {
    const dates = [
      issue({ number: 2, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' }),
      issue({ number: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }),
      issue({ number: 3, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' }),
    ];
    expect(sortIssues(dates, 'created', 'asc').map(i => i.number)).toEqual([1, 3, 2]);
    expect(sortIssues(dates, 'created', 'desc').map(i => i.number)).toEqual([2, 3, 1]);
    expect(sortIssues(dates, 'updated', 'asc').map(i => i.number)).toEqual([1, 3, 2]);
    expect(sortIssues(dates, 'updated', 'desc').map(i => i.number)).toEqual([2, 3, 1]);
  });

  it('comments asc is fewest first, desc is most first', () => {
    const withComments = [issue({ number: 1, comments: 5 }), issue({ number: 2, comments: 1 }), issue({ number: 3, comments: 9 })];
    expect(sortIssues(withComments, 'comments', 'asc').map(i => i.number)).toEqual([2, 1, 3]);
    expect(sortIssues(withComments, 'comments', 'desc').map(i => i.number)).toEqual([3, 1, 2]);
  });

  it('repo asc is A to Z', () => {
    const repos = [issue({ number: 1, repo: 'zeta' }), issue({ number: 2, repo: 'alpha' })];
    expect(sortIssues(repos, 'repo', 'asc').map(i => i.number)).toEqual([2, 1]);
  });

  it('does not mutate its input', () => {
    const input = [...mixed];
    const before = input.map(i => i.number);
    sortIssues(input, 'priority', 'desc');
    expect(input.map(i => i.number)).toEqual(before);
  });

  it('PRIORITY_ORDER ranks critical before high before medium before low', () => {
    expect(Object.values(PRIORITY_ORDER)).toEqual([0, 1, 2, 3]);
  });
});

describe('priorityClass / statusClass (ISSUEZ-004)', () => {
  it('passes through known enum values', () => {
    expect(priorityClass(labelled('priority:critical'))).toBe('critical');
    expect(priorityClass(labelled('priority:low'))).toBe('low');
    expect(statusClass(labelled('status:in-progress'))).toBe('in-progress');
    expect(statusClass(labelled('status:done'))).toBe('done');
  });

  it('falls back to none/todo when unlabelled', () => {
    expect(priorityClass(issue())).toBe('none');
    expect(statusClass(issue())).toBe('todo');
  });

  it('collapses an attribute-breaking label to none', () => {
    const attack = labelled('priority:" onmouseover="alert(1)');
    expect(getPriority(attack)).toBe('" onmouseover="alert(1)');
    expect(priorityClass(attack)).toBe('none');
    expect(priorityClass(attack)).not.toContain('"');
    expect(priorityClass(attack)).not.toContain(' ');
  });

  it('collapses an unknown priority label to none', () => {
    expect(priorityClass(labelled('priority:urgent'))).toBe('none');
  });

  it('collapses an attribute-breaking status label to todo', () => {
    const attack = labelled('status:" onclick="alert(1)');
    expect(statusClass(attack)).toBe('todo');
  });
});

describe('URL and colour guards (ISSUEZ-005)', () => {
  it('accepts an https github.com issue URL', () => {
    expect(safeGitHubUrl('https://github.com/o/r/issues/7')).toBe('https://github.com/o/r/issues/7');
  });

  it('rejects javascript:, data:, http: and foreign hosts', () => {
    expect(safeGitHubUrl('javascript:alert(1)')).toBe('');
    expect(safeGitHubUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeGitHubUrl('http://github.com/o/r')).toBe('');
    expect(safeGitHubUrl('https://evil.example/o/r')).toBe('');
    expect(safeGitHubUrl('" onmouseover="alert(1)')).toBe('');
    expect(safeGitHubUrl(undefined)).toBe('');
  });

  it('allows only the known GitHub avatar hosts over https', () => {
    expect(safeAvatarUrl('https://avatars.githubusercontent.com/u/1')).toBe('https://avatars.githubusercontent.com/u/1');
    expect(safeAvatarUrl('https://evil.example/x.png')).toBe('');
    expect(safeAvatarUrl('javascript:alert(1)')).toBe('');
    expect(safeAvatarUrl('" onerror="alert(1)')).toBe('');
  });

  it('accepts a 6-digit hex label colour and rejects anything else', () => {
    expect(safeLabelColor('b60205')).toBe('b60205');
    expect(safeLabelColor('B60205')).toBe('B60205');
    expect(safeLabelColor('red; background:url(https://evil.example/x)')).toBe('808080');
    expect(safeLabelColor('')).toBe('808080');
    expect(safeLabelColor('fff')).toBe('808080');
  });
});

describe('escapeHtml', () => {
  it('escapes every character that can leave an attribute or text context', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml("'")).toBe('&#39;');
    expect(escapeHtml(null)).toBe('');
  });
});