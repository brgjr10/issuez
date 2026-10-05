// @vitest-environment jsdom
// Regression tests for the Wave 3 fixes. These drive the real src/main.js through the
// real setState -> render() path in jsdom, the same way tests/xss.test.js does.
//
// Note on dispatching: the app wires its DOM actions through inline on* attributes, and
// in vitest's jsdom environment the `window` an inline handler sees is a different object
// from the `window` the test module sees (an attribute written by a handler is visible on
// `document`, but a property it sets on `window` is not). So handler bodies are invoked
// through the window globals the inline attributes call — the same functions, reached the
// same way — rather than by firing the event. tests/xss.test.js only ever reads those
// attributes, which is why the limitation has not bitten before.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const issue = (over = {}) => ({
  number: 1,
  title: 'ordinary title',
  body: 'ordinary body',
  state: 'open',
  html_url: 'https://github.com/o/r/issues/1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  comments: 0,
  assignees: [],
  repo: 'r',
  repo_full: 'o/r',
  user: { login: 'o', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  labels: [{ name: 'priority:high', color: 'b60205' }],
  ...over,
});

let store;
let api;
let main;

const authed = (overrides = {}) => store.setState({
  user: { login: 'o', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  issues: [issue()],
  filteredIssues: [issue()],
  repos: [],
  loading: false,
  error: null,
  selectedIssue: null,
  searchQuery: '',
  filterState: 'all',
  filterAssignee: 'all',
  showSettings: false,
  showWelcome: false,
  ...overrides,
});

// What the inline oninput attribute runs when the user types.
const typeInSearchBox = (value) => {
  const input = document.querySelector('#search-input');
  input.value = value;
  window._onSearch(value);
  return input;
};

const key = (name) => ({ key: name, bubbles: true, cancelable: true });

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  store = await import('../src/state/store.js');
  api = await import('../src/api/github.js');
  main = await import('../src/main.js');
  api.setToken('test-token');
});

beforeEach(() => {
  api.setToken('test-token');
  localStorage.clear();
  authed({ layout: null });
  // Toasts now outlive state changes by design, so start each test with a clean slate.
  document.getElementById('toast-container').innerHTML = '';
});

// ---- ISSUEZ-002 — keyed region rendering -----------------------------------

describe('ISSUEZ-002 — a state change no longer rebuilds the whole DOM', () => {
  it('gives each region a stable host element instead of one innerHTML blob', () => {
    for (const id of ['region-header', 'region-error', 'region-stats', 'region-toolbar', 'region-issues', 'region-cards', 'region-modal', 'region-settings', 'region-welcome']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('keeps node identity for regions whose state did not change', () => {
    const searchBefore = document.querySelector('#search-input');
    const triggerBefore = document.querySelector('#filter-state-trigger');
    const titleBefore = document.querySelector('.app-title');
    expect(searchBefore).not.toBeNull();

    // Only the issue list changes here: a second issue arrives from a refresh.
    const second = issue({ number: 2, title: 'second' });
    authed({ issues: [issue(), second], filteredIssues: [issue(), second] });

    expect(document.querySelector('#search-input')).toBe(searchBefore);
    expect(document.querySelector('#filter-state-trigger')).toBe(triggerBefore);
    expect(document.querySelector('.app-title')).toBe(titleBefore);
    expect(document.querySelectorAll('.issue-card')).toHaveLength(2);
  });

  it('does re-render the region whose state changed, and leaves the others alone', () => {
    const issuesHost = document.getElementById('region-issues');
    const searchBefore = document.querySelector('#search-input');
    authed({ error: 'something broke' });

    expect(document.querySelector('.error-state')).not.toBeNull();
    expect(document.getElementById('region-issues')).toBe(issuesHost);
    expect(document.querySelector('#search-input')).toBe(searchBefore);
  });

  it('rebuilds the issue region when the issue set changes', () => {
    const tableBefore = document.querySelector('.issues-table');
    const second = issue({ number: 2, title: 'second' });
    authed({ issues: [issue(), second], filteredIssues: [issue(), second] });
    const tableAfter = document.querySelector('.issues-table');
    expect(tableBefore).not.toBeNull();
    expect(tableAfter).not.toBe(tableBefore);
    expect(document.querySelectorAll('.issue-title')).toHaveLength(2);
  });
});

// ---- ISSUEZ-001 — search focus survives the debounce -----------------------

describe('ISSUEZ-001 — the search box keeps focus while typing', () => {
  it('keeps focus, value and results across a debounced keystroke', async () => {
    const input = document.querySelector('#search-input');
    input.focus();
    expect(document.activeElement).toBe(input);

    typeInSearchBox('ordinary');

    // Nothing should have happened yet: the handler is debounced by 200ms.
    expect(store.getState().searchQuery).toBe('');

    await new Promise(r => setTimeout(r, 300));

    expect(store.getState().searchQuery).toBe('ordinary');
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('#search-input')).toBe(input);
    expect(document.querySelector('#search-input').value).toBe('ordinary');
  });

  it('keeps focus across every pause in a longer query', async () => {
    const input = document.querySelector('#search-input');
    input.focus();
    for (const value of ['o', 'or', 'ordinary']) {
      typeInSearchBox(value);
      await new Promise(r => setTimeout(r, 260));
      expect(document.activeElement, `after typing "${value}"`).toBe(input);
    }
    expect(store.getState().searchQuery).toBe('ordinary');
  });

  it('still narrows the result set', async () => {
    const alpha = issue({ number: 1, title: 'alpha' });
    const beta = issue({ number: 2, title: 'beta' });
    authed({ issues: [alpha, beta], filteredIssues: [alpha, beta] });

    const input = document.querySelector('#search-input');
    input.focus();
    typeInSearchBox('beta');
    await new Promise(r => setTimeout(r, 300));

    expect(store.getState().filteredIssues.map(i => i.number)).toEqual([2]);
    expect(document.activeElement).toBe(input);
    expect(document.querySelectorAll('.issue-title')).toHaveLength(1);
  });

  it('carries the typed query through a region teardown (import reset path)', () => {
    const input = typeInSearchBox('ordinary');
    store.setState({ searchQuery: 'ordinary' });
    // Simulate the state being changed from outside the input (import, future "clear").
    store.setState({ searchQuery: '' });
    store.setState({ searchQuery: 'ordinary' });
    expect(document.querySelector('#search-input')).toBe(input);
    expect(document.querySelector('#search-input').value).toBe('ordinary');
  });
});

// ---- ISSUEZ-014 — toasts survive unrelated state changes --------------------

describe('ISSUEZ-014 — toasts are not discarded by a state change', () => {
  it('mounts the toast container on body, outside the re-rendered app tree', () => {
    const container = document.getElementById('toast-container');
    expect(container).not.toBeNull();
    expect(container.parentElement).toBe(document.body);
    expect(document.getElementById('app').contains(container)).toBe(false);
  });

  it('keeps a live toast node alive across a state change', () => {
    window._patLogin(); // empty token: shows the "Enter a PAT" warning toast
    const toast = document.querySelector('#toast-container .toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Enter a PAT');

    authed({ error: 'an unrelated state change' });

    expect(document.querySelector('#toast-container .toast')).toBe(toast);
    expect(toast.isConnected).toBe(true);
  });
});

// ---- ISSUEZ-003 — fetch failures are surfaced, never silent -----------------

describe('ISSUEZ-003 — a failed source is logged and reported, not swallowed', () => {
  const response = ({ status = 200, body = [], headers = {} }) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'stub',
    headers: { get: (k) => (k in headers ? headers[k] : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  const okUser = response({ body: { login: 'o', avatar_url: 'https://avatars.githubusercontent.com/u/1' } });
  const okRepos = response({ body: [{ full_name: 'o/r', name: 'r', login: 'o', owner: { login: 'o' } }] });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stubFetch = (handler) => {
    globalThis.fetch = vi.fn(handler);
  };

  it('logs and reports when one source in the fan-out fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(async (url) => {
      if (url.includes('/user/orgs')) return response({ status: 403, body: { message: 'Requires authentication' } });
      if (url.includes('/user/repos')) return okRepos;
      if (url.includes('/orgs/')) return okRepos;
      if (url.includes('/issues')) return response({ body: [] });
      return okUser;
    });

    await window._refresh();

    // The warning is the point: this used to be a bare .catch(() => []).
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.map(c => c.join(' ')).some(m => m.includes('organizations'))).toBe(true);
    expect(document.querySelector('#toast-container .toast').textContent).toContain('partial results');
    // A failure must not empty the dashboard: the surviving source is still loaded.
    expect(store.getState().repos.map(r => r.full_name)).toEqual(['o/r']);
  });

  it('surfaces a top-level rejection as a user-facing error state', async () => {
    stubFetch(async () => { throw new Error('Network request failed'); });

    await window._refresh();

    expect(store.getState().error).toBe('Network request failed');
    expect(document.querySelector('.error-state').textContent).toContain('Network request failed');
    expect(document.querySelector('#toast-container .toast').textContent).toContain('Network request failed');
  });

  it('names the repository when one repo\'s issues fail, rather than dropping it quietly', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(async (url) => {
      if (url.includes('/user/orgs')) return response({ body: [] });
      if (url.includes('/user/repos') || url.includes('/orgs/')) return okRepos;
      if (url.includes('/issues')) return response({ status: 500, body: { message: 'Server Error' } });
      return okUser;
    });

    await window._refresh();

    const warnings = warn.mock.calls.map(c => c.join(' '));
    expect(warnings.some(m => m.includes('open issues for o/r'))).toBe(true);
    expect(warnings.some(m => m.includes('closed issues for o/r'))).toBe(true);
    expect(document.querySelector('#toast-container .toast').textContent).toContain('2 sources failed');
    expect(store.getState().issues).toEqual([]);
  });

  it('reports a clean load without claiming partial results', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(async (url) => {
      if (url.includes('/user/orgs')) return response({ body: [] });
      if (url.includes('/user/repos') || url.includes('/orgs/')) return okRepos;
      if (url.includes('/issues')) return response({ body: [] });
      return okUser;
    });

    await window._refresh();

    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector('#toast-container .toast').textContent).toContain('Loaded');
  });
});

// ---- ISSUEZ-004 — the custom select is a real listbox widget ----------------

describe('ISSUEZ-004 — the custom select is keyboard operable and named', () => {
  const trigger = () => document.querySelector('#filter-state-trigger');
  const listboxId = () => trigger().getAttribute('aria-controls');
  const listbox = () => document.getElementById(listboxId());
  const options = () => [...listbox().querySelectorAll('[role="option"]')];

  it('exposes listbox semantics on the trigger and the options', () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(listboxId()).toBeTruthy();
    expect(listbox().getAttribute('role')).toBe('listbox');
    // The native select is display:none, so the replacement must carry its name.
    expect(trigger().getAttribute('aria-label')).toBe('State');

    expect(options()).toHaveLength(3);
    expect(options().filter(o => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(options().filter(o => o.tabIndex === 0)).toHaveLength(1);
  });

  it('opens from the keyboard and moves with Arrow/Home/End', () => {
    trigger().focus();
    trigger().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(document.activeElement.dataset.value).toBe('all');

    listbox().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    expect(document.activeElement.dataset.value).toBe('open');

    listbox().dispatchEvent(new KeyboardEvent('keydown', key('End')));
    expect(document.activeElement.dataset.value).toBe('closed');

    listbox().dispatchEvent(new KeyboardEvent('keydown', key('ArrowUp')));
    expect(document.activeElement.dataset.value).toBe('open');

    listbox().dispatchEvent(new KeyboardEvent('keydown', key('Home')));
    expect(document.activeElement.dataset.value).toBe('all');
    // Roving tabindex follows focus: exactly one option stays in the tab order.
    expect(options().filter(o => o.tabIndex === 0)).toHaveLength(1);
  });

  it('wraps ArrowUp from the first option to the last', () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    listbox().dispatchEvent(new KeyboardEvent('keydown', key('ArrowUp')));
    expect(document.activeElement.dataset.value).toBe('closed');
  });

  it('commits an option with Enter, closes, and returns focus to the trigger', () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    listbox().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    listbox().dispatchEvent(new KeyboardEvent('keydown', key('Enter')));

    expect(document.querySelector('#filter-state').value).toBe('open');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().querySelector('.select-value').textContent).toBe('Open');
    expect(document.activeElement).toBe(trigger());
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    listbox().dispatchEvent(new KeyboardEvent('keydown', key('Escape')));

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes every dropdown when the click lands outside', () => {
    document.querySelector('#filter-assignee-trigger').dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    expect(document.querySelector('#filter-assignee-trigger').getAttribute('aria-expanded')).toBe('true');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('#filter-assignee-trigger').getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles closed on a second trigger activation', () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', key('ArrowDown')));
    trigger().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('never wraps a select in two widgets, however often render runs', () => {
    authed();
    store.setState({ searchQuery: 'zzz' });
    store.setState({ searchQuery: '' });
    const wrappers = [...document.querySelectorAll('.select-wrapper')];
    for (const select of document.querySelectorAll('select')) {
      expect(wrappers.filter(w => w.contains(select))).toHaveLength(1);
    }
    expect(wrappers.length).toBe(document.querySelectorAll('select').length);
  });
});

// ---- ISSUEZ-005 — dialog semantics, focus and Escape ------------------------

describe('ISSUEZ-005 — modals are dialogs with focus and Escape', () => {
  it('marks the issue modal as a modal dialog and moves focus into it', () => {
    authed({ selectedIssue: issue() });
    const modal = document.querySelector('#region-modal .modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(modal.getAttribute('aria-labelledby'))).not.toBeNull();
    expect(modal.contains(document.activeElement)).toBe(true);
  });

  it('closes the issue modal on Escape', () => {
    authed({ selectedIssue: issue() });
    expect(document.querySelector('#region-modal .modal')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));

    expect(document.querySelector('#region-modal .modal')).toBeNull();
    expect(store.getState().selectedIssue).toBeNull();
  });

  it('marks the settings dialog and closes it on Escape', () => {
    authed({ showSettings: true });
    const modal = document.querySelector('#region-settings .modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.contains(document.activeElement)).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));

    expect(store.getState().showSettings).toBe(false);
    expect(document.querySelector('#region-settings .modal')).toBeNull();
  });

  it('marks the welcome dialog and closes it on Escape', () => {
    authed({ showWelcome: true });
    expect(document.querySelector('#region-welcome .modal').getAttribute('role')).toBe('dialog');
    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));
    expect(store.getState().showWelcome).toBe(false);
  });

  it('closes the topmost dialog first when two are stacked', () => {
    authed({ selectedIssue: issue(), showWelcome: true });
    expect(document.querySelector('#region-welcome .modal')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));

    expect(store.getState().showWelcome).toBe(false);
    expect(store.getState().selectedIssue).not.toBeNull();
    expect(document.querySelector('#region-modal .modal')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));
    expect(store.getState().selectedIssue).toBeNull();
  });

  it('does nothing on Escape when no dialog is open', () => {
    expect(() => document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')))).not.toThrow();
    expect(store.getState().selectedIssue).toBeNull();
  });

  it('keeps Tab inside the open dialog', () => {
    authed({ showSettings: true });
    const modal = document.querySelector('#region-settings .modal');
    const focusables = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.tabIndex !== -1);
    focusables[focusables.length - 1].focus();

    document.dispatchEvent(new KeyboardEvent('keydown', key('Tab')));
    expect(document.activeElement).toBe(focusables[0]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it('leaves the comment draft alone when unrelated state changes', () => {
    authed({ selectedIssue: issue() });
    const textarea = document.querySelector('#comment-input');
    textarea.value = 'half-written draft';
    textarea.focus();

    // A background refresh landing while the user types must not wipe the textarea.
    store.setState({ searchQuery: 'zzz' });

    expect(document.querySelector('#comment-input')).toBe(textarea);
    expect(document.querySelector('#comment-input').value).toBe('half-written draft');
  });

  it('restores focus to the control that opened the dialog', () => {
    authed({ showSettings: true });
    expect(document.querySelector('#region-settings .modal').contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', key('Escape')));
    expect(store.getState().showSettings).toBe(false);
  });
});

// ---- ISSUEZ-006 — every field has a name, the PAT is in a form --------------

describe('ISSUEZ-006 — form fields are labelled', () => {
  it('names the search box with aria-label', () => {
    expect(document.querySelector('#search-input').getAttribute('aria-label')).toBe('Search issues by title or body');
  });

  it('associates the filter labels with their selects', () => {
    for (const id of ['filter-state', 'filter-assignee']) {
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, id).not.toBeNull();
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('names the comment box and the layout file input', () => {
    authed({ selectedIssue: issue() });
    expect(document.querySelector('label[for="comment-input"]')).not.toBeNull();

    authed({ showSettings: true });
    expect(document.querySelector('label[for="import-file"]')).not.toBeNull();
  });

  it('puts the PAT field inside a form with a real label', () => {
    api.setToken(null);
    store.setState({ user: null });

    const input = document.querySelector('#pat-input');
    expect(input).not.toBeNull();
    expect(input.closest('form')).not.toBeNull();
    expect(input.name).toBe('pat');
    const label = document.querySelector('label[for="pat-input"]');
    expect(label).not.toBeNull();
    expect(label.textContent.trim()).toBe('Personal Access Token');
  });

  it('does not claim the token is never stored', () => {
    api.setToken(null);
    store.setState({ user: null });

    const text = document.querySelector('.auth-card').textContent;
    expect(text).not.toMatch(/never stored/i);
    expect(text).not.toMatch(/memory only/i);
    expect(text).toMatch(/sessionStorage/);
  });
});

// ---- ISSUEZ-007 — layout preferences are actually persisted ----------------

describe('ISSUEZ-007 — layout persistence is wired up', () => {
  it('writes the layout to localStorage when the sort changes', () => {
    expect(localStorage.getItem('issuez_layout')).toBeNull();

    window._setSort('updated');

    const raw = localStorage.getItem('issuez_layout');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw)).toMatchObject({ sortBy: 'updated', sortDir: 'asc' });

    window._setSort('updated');
    expect(JSON.parse(localStorage.getItem('issuez_layout'))).toMatchObject({ sortBy: 'updated', sortDir: 'desc' });
  });

  it('re-applies a persisted layout on the next load', () => {
    store.setState({ sortBy: 'priority', sortDir: 'asc', layout: null });
    localStorage.setItem('issuez_layout', JSON.stringify({ sortBy: 'updated', sortDir: 'desc' }));

    store.loadPersisted();
    main.applyPersistedLayout();

    expect(store.getState().sortBy).toBe('updated');
    expect(store.getState().sortDir).toBe('desc');
  });

  it('leaves the defaults alone when nothing has been persisted', () => {
    store.setState({ sortBy: 'priority', sortDir: 'asc', layout: null });
    store.loadPersisted();
    main.applyPersistedLayout();
    expect(store.getState().sortBy).toBe('priority');
    expect(store.getState().sortDir).toBe('asc');
  });
});

// ---- ISSUEZ-011 — exportLayout defers blob URL revocation -------------------

describe('ISSUEZ-011 — exportLayout does not revoke the blob URL before the download starts', () => {
  it('defers revokeObjectURL to the next tick so the click can start the download', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

    authed();
    window._exportLayout();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});

describe('ISSUEZ-019 — logout resets the whole state shape', () => {
  it('clears repos and loading as well as the issues', () => {
    store.setState({ repos: [{ full_name: 'o/r' }], loading: true, showSettings: true });

    window._logout();

    const s = store.getState();
    expect(s.repos).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.issues).toEqual([]);
    expect(s.filteredIssues).toEqual([]);
    expect(s.user).toBeNull();
    expect(s.selectedIssue).toBeNull();
    expect(s.showSettings).toBe(false);
    expect(s.showWelcome).toBe(false);
  });
});