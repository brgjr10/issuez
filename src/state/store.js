import { STORAGE_KEY, LAYOUT_KEY, THEME_KEY } from '../utils/helpers.js';

const state = {
  user: null,
  issues: [],
  filteredIssues: [],
  repos: [],
  loading: false,
  error: null,
  selectedIssue: null,
  searchQuery: '',
  filterRepo: 'all',
  filterLabel: 'all',
  filterState: 'all',
  filterAssignee: 'me',
  sortBy: 'priority',
  sortDir: 'asc',
  theme: 'dark',
  layout: null,
  rateLimit: { remaining: 5000, reset: 0 },
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, typeof partial === 'function' ? partial(state) : partial);
  listeners.forEach(fn => fn(state));
}

export function loadPersisted() {
  try {
    const layout = localStorage.getItem(LAYOUT_KEY);
    if (layout) state.layout = JSON.parse(layout);
  } catch {}
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme) state.theme = theme;
  } catch {}
}

export function persistLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
  } catch {}
}

export function persistTheme() {
  try {
    localStorage.setItem(THEME_KEY, state.theme);
  } catch {}
}
