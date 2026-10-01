// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

const HOSTILE = {
  priorityLabel: 'priority:" onmouseover="window.__pwned=1',
  statusLabel: 'status:" onclick="window.__pwned=1',
  labelName: '"><img src=x onerror="window.__pwned=1>',
  labelColor: 'red; background:url(https://evil.example/x)',
  title: '"><img src=x onerror="window.__pwned=1>',
  body: '</div><script>window.__pwned=1</script>',
  repoFull: `o/r' + window.__pwned=1 + '"`,
};

const maliciousIssue = (over = {}) => ({
  number: 7,
  title: HOSTILE.title,
  body: HOSTILE.body,
  state: 'open',
  html_url: 'https://github.com/o/r/issues/7',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  comments: 0,
  assignees: [],
  repo: 'r',
  repo_full: HOSTILE.repoFull,
  user: { login: 'o', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  labels: [
    { name: HOSTILE.priorityLabel, color: 'b60205' },
    { name: HOSTILE.statusLabel, color: 'a2eeef' },
    { name: HOSTILE.labelName, color: HOSTILE.labelColor },
  ],
  ...over,
});

let setState;
let app;

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const store = await import('../src/state/store.js');
  const api = await import('../src/api/github.js');
  setState = store.setState;
  await import('../src/main.js');
  api.setToken('test-token');
  app = document.querySelector('#app');
});

const INERT_FALLBACK = 'rgb(128, 128, 128)';

// Assertions run against the parsed DOM, not against substrings: escaped text still
// literally contains "onerror=", so a string match would be a false alarm while a
// real injected attribute would be visible as an attribute on a real element.
function render(issue, extra = {}) {
  setState({ issues: [issue], filteredIssues: [issue], loading: false, user: maliciousIssue().user, selectedIssue: null, ...extra });
  const container = document.createElement('div');
  container.innerHTML = app.innerHTML;
  return container;
}

function hostileAttributes(container) {
  const bad = [];
  for (const el of container.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      if (attr.name !== 'data-repo' && attr.value.includes('__pwned')) bad.push(`${attr.name}=${attr.value}`);
      if (/^on/i.test(attr.name) && (attr.value.includes('__pwned') || attr.value.includes('"') || attr.value.includes('<'))) bad.push(`${attr.name}=${attr.value}`);
      if (attr.name === 'href' && attr.value && !/^https:\/\/github\.com\//.test(attr.value)) bad.push(`href=${attr.value}`);
      if (attr.name === 'src' && attr.value && !/^https:\/\/(avatars|github|camo)\.githubusercontent\.com\//.test(attr.value)) bad.push(`src=${attr.value}`);
      if (attr.name === 'style' && attr.value.includes('url(')) bad.push(`style=${attr.value}`);
    }
  }
  return bad;
}

// The decisive structural property: the set of inline handler bodies must not change
// when the issue data changes, so nothing remote ever reaches a JavaScript context.
const handlerValues = (container) => [...new Set(
  [...container.querySelectorAll('*')].flatMap(n => [...n.attributes].filter(a => /^on/i.test(a.name)).map(a => a.value))
)].sort();

const benignIssue = (over = {}) => maliciousIssue({
  title: 'ordinary title',
  body: 'ordinary body',
  repo_full: 'o/r',
  html_url: 'https://github.com/o/r/issues/7',
  labels: [{ name: 'priority:high', color: 'b60205' }, { name: 'bug', color: 'd73a4a' }],
  ...over,
});

describe('stored XSS via label and issue data (ISSUEZ-004, ISSUEZ-005)', () => {
  it('boot wires the PAT, theme and every action handler without throwing', () => {
    for (const fn of ['_patLogin', '_logout', '_setTheme', '_openIssueFromEl', '_toggleIssueStateFromEl', '_cyclePriorityFromEl', '_cycleStatusFromEl', '_cycleStatusFromModal', '_setPriorityFromModal', '_setStatusFromModal']) {
      expect(typeof window[fn]).toBe('function');
    }
  });

  it('renders the row, cards and toolbar with no injected script and no injected image', () => {
    const el = render(maliciousIssue());
    expect(el.querySelector('.issues-table')).not.toBeNull();
    expect(el.querySelector('.issue-card')).not.toBeNull();
    expect(el.querySelectorAll('script')).toHaveLength(0);
    expect(el.querySelectorAll('img[src="x"]')).toHaveLength(0);
    expect(window.__pwned).toBeUndefined();
  });

  it('interpolates nothing attacker-controlled into any attribute except data-repo', () => {
    expect(hostileAttributes(render(maliciousIssue()))).toEqual([]);
  });

  it('produces byte-identical inline handlers for hostile and benign issue data', () => {
    expect(handlerValues(render(maliciousIssue()))).toEqual(handlerValues(render(benignIssue())));
  });

  it('constrains the priority badge class to the known enum', () => {
    for (const badge of render(maliciousIssue()).querySelectorAll('.priority-badge')) {
      expect(badge.className).toBe('priority-badge priority-none');
    }
    expect(render(benignIssue()).querySelector('.priority-badge').className).toBe('priority-badge priority-high');
  });

  it('constrains the status badge class to the known enum', () => {
    for (const badge of render(maliciousIssue()).querySelectorAll('.status-badge')) {
      expect(badge.className).toBe('status-badge status-todo');
    }
  });

  it('keeps a hostile label colour as inert data, not as CSS', () => {
    for (const chip of render(maliciousIssue()).querySelectorAll('.label-chip')) {
      expect(chip.style.borderColor).toBe('rgba(128, 128, 128, 0.25)');
      expect(chip.style.color).toBe(INERT_FALLBACK);
    }
  });

  it('carries the hostile repo name as escaped data, not as an onclick argument', () => {
    const badge = render(maliciousIssue()).querySelector('.priority-badge');
    expect(badge.dataset.repo).toBe(HOSTILE.repoFull);
    expect(badge.dataset.number).toBe('7');
    expect(badge.getAttribute('onclick')).toBe('window._cyclePriorityFromEl(this)');
    expect(badge.getAttribute('onkeydown')).toBe("if(event.key==='Enter'||event.key===' ')window._cyclePriorityFromEl(this)");
  });

  it('renders the issue title and body as text, never as markup', () => {
    const el = render(maliciousIssue());
    expect(el.querySelector('.issue-title').textContent).toBe(HOSTILE.title);
    expect(el.querySelector('.label-chip').textContent).toBe(HOSTILE.labelName);
  });

  it('drops a javascript: issue URL instead of linking to it', () => {
    const el = render(maliciousIssue({ html_url: 'javascript:window.__pwned=1' }));
    expect(el.querySelector('.issue-gh-link').getAttribute('href')).toBe('');
    expect(hostileAttributes(el)).toEqual([]);
  });

  it('opens the modal without injecting through repo_full, html_url or body', () => {
    const el = render(maliciousIssue(), { selectedIssue: maliciousIssue() });
    expect(el.querySelector('.modal-body')).not.toBeNull();
    expect(el.querySelectorAll('script')).toHaveLength(0);
    expect(hostileAttributes(el)).toEqual([]);
    expect(window.__pwned).toBeUndefined();
  });

  it('makes every clickable row affordance keyboard reachable', () => {
    const el = render(maliciousIssue());
    for (const sel of ['.priority-badge', '.status-badge', '.issue-title', '.issue-card', 'th[role="button"]']) {
      for (const node of el.querySelectorAll(sel)) {
        expect(node.getAttribute('tabindex')).toBe('0');
        expect(node.getAttribute('onkeydown')).toBeTruthy();
      }
    }
  });

  it('names the GitHub link for screen readers', () => {
    for (const link of render(maliciousIssue()).querySelectorAll('.issue-gh-link')) {
      expect(link.getAttribute('aria-label')).toBe('Open issue on GitHub');
    }
  });
});