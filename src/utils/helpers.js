const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const html = (strings, ...values) => strings.reduce((r, s, i) => r + s + (values[i] ?? ''), '');
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
const timeAgo = (d) => { const s = Math.floor((Date.now() - new Date(d).getTime())/1000); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABELS = { 'todo': 'To Do', 'in-progress': 'In Progress', 'done': 'Done' };
const STORAGE_KEY = 'issuez_token';
const LAYOUT_KEY = 'issuez_layout';
const THEME_KEY = 'issuez_theme';

export { $, $$, html, escapeHtml, debounce, formatDate, timeAgo, PRIORITY_ORDER, PRIORITY_LABELS, STATUS_LABELS, STORAGE_KEY, LAYOUT_KEY, THEME_KEY };
