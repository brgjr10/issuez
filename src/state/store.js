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
  filterState: 'all',
  filterAssignee: 'all',
  sortBy: 'priority',
  sortDir: 'asc',
  theme: 'dark',
  layout: null,
  rateLimit: { remaining: 5000, reset: 0 },
  showSettings: false,
  showWelcome: false,
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
  } catch (e) {
    console.warn(`[issuez] Could not read ${LAYOUT_KEY} from localStorage — the value is corrupt or storage is blocked. Layout customisation will reset until that key is cleared.`, e);
  }
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme) state.theme = theme;
  } catch (e) {
    console.warn(`[issuez] Could not read ${THEME_KEY} from localStorage — storage is blocked or full. The theme will fall back to dark on every load.`, e);
  }
}

export function persistLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
  } catch (e) {
    console.warn(`[issuez] Could not save ${LAYOUT_KEY} — the quota is exhausted or storage is blocked. Export the layout instead if you need to keep it.`, e);
  }
}

export function persistTheme() {
  try {
    localStorage.setItem(THEME_KEY, state.theme);
  } catch (e) {
    console.warn(`[issuez] Could not save ${THEME_KEY} — the quota is exhausted or storage is blocked. The theme change will not survive a reload.`, e);
  }
}
