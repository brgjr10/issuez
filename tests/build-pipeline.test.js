import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_FILES = ['index.html', 'vite.config.js', 'src/main.js', 'src/api/github.js', 'src/state/store.js', 'src/utils/helpers.js', 'src/styles.css'];

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.qa-tmp' || entry.name === 'tests') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

let dist = '';

beforeAll(() => {
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: ROOT, stdio: 'pipe' });
  dist = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf-8');
}, 180000);

describe('ISSUEZ-001 — no script writes build output back over a tracked source file', () => {
  it('patch-built.cjs is gone', () => {
    expect(existsSync(join(ROOT, 'patch-built.cjs'))).toBe(false);
  });

  it('nothing in the repo copies or writes index.html any more', () => {
    const offenders = [];
    for (const file of walk(ROOT)) {
      if (!/\.(c|m)?js$/.test(file)) continue;
      const src = readFileSync(file, 'utf-8');
      if (/copyFileSync|writeFileSync|createWriteStream/.test(src) && /index\.html/.test(src)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('the root index.html is still the dev entrypoint, not an inlined bundle', () => {
    const root = readFileSync(join(ROOT, 'index.html'), 'utf-8');
    expect(root.length).toBeLessThan(4000);
    expect(root).toContain('<script type="module" src="src/main.js">');
    expect(root).toContain('href="src/styles.css"');
    expect(root).not.toContain('cyclePriorityPatched');
  });

  it('the dead <style id="theme-styles"> patch anchor is gone', () => {
    expect(readFileSync(join(ROOT, 'index.html'), 'utf-8')).not.toContain('theme-styles');
    expect(SRC_FILES.filter(f => f.endsWith('.js')).map(f => readFileSync(join(ROOT, f), 'utf-8')).join('\n')).not.toContain('theme-styles');
  });
});

describe('ISSUEZ-002 — the build needs no post-processing', () => {
  it('the built bundle is the whole app: no minified-identifier injection', () => {
    expect(dist).not.toContain('cyclePriorityPatched');
    expect(dist.length).toBeGreaterThan(30000);
  });

  it('cycleIssuePriority reached the bundle from source, not from a patcher', () => {
    expect(dist).toMatch(/window\._cyclePriority=/);
    expect(dist).toContain('priority:');
    expect(dist).toContain('_cyclePriorityFromEl');
  });

  it('the CSS the patcher used to inject is inlined by the build itself', () => {
    expect(dist).not.toContain('<link rel="stylesheet"');
    expect(dist).toContain('data-theme=');
    expect(dist).toContain('.priority-critical');
  });

  it('every top-level module source file is still present', () => {
    for (const f of SRC_FILES) expect(existsSync(join(ROOT, f))).toBe(true);
  });

  it('dist is a single self-contained html plus the public assets', () => {
    const entries = readdirSync(join(ROOT, 'dist'));
    expect(entries).toContain('index.html');
    expect(entries).toContain('manifest.webmanifest');
    expect(entries).toContain('icon.svg');
    expect(statSync(join(ROOT, 'dist', 'index.html')).size).toBeGreaterThan(30000);
  });

  it('the CSP and referrer policy travel in the document because GitHub Pages cannot set headers', () => {
    const root = readFileSync(join(ROOT, 'index.html'), 'utf-8');
    const csp = root.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    expect(csp).toMatch(/connect-src 'self' https:\/\/api\.github\.com/);
    expect(csp).toMatch(/manifest-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    // Browsers ignore frame-ancestors delivered in a <meta> tag and log a console
    // message, so it must not be shipped here — the host has to set it.
    expect(csp).not.toMatch(/frame-ancestors/);
    expect(root).toMatch(/<meta name="referrer" content="no-referrer">/);
    expect(dist).toMatch(/Content-Security-Policy/);
  });

  it('the manifest referenced by index.html is actually built', () => {
    const root = readFileSync(join(ROOT, 'index.html'), 'utf-8');
    const href = root.match(/<link rel="manifest" href="([^"]+)"/)[1];
    const manifest = JSON.parse(readFileSync(join(ROOT, 'dist', href), 'utf-8'));
    expect(manifest.icons[0].src).toBe('icon.svg');
    expect(existsSync(join(ROOT, 'dist', manifest.icons[0].src))).toBe(true);
  });
});