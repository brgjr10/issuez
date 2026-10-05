import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { safeAvatarUrl } from '../src/utils/helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const indexHtml = readFileSync(`${ROOT}/index.html`, 'utf-8');
const csp = indexHtml.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];

const directive = (name) => {
  const found = csp.split(';').map(d => d.trim()).find(d => d.startsWith(`${name} `));
  return found ? found.split(/\s+/).slice(1) : [];
};

const cspImgHosts = () => directive('img-src')
  .filter(s => s.startsWith('https://'))
  .map(s => s.replace('https://', ''));

// The hosts the JS guard is willing to emit are discovered by probing, not by reading
// AVATAR_HOSTS out of the module: the point is what an attacker-controlled avatar URL
// can actually reach in the DOM, which is the property the CSP has to match.
const jsAvatarHosts = () => {
  const hosts = new Set();
  for (const host of ['avatars.githubusercontent.com', 'camo.githubusercontent.com', 'github.com', 'githubusercontent.com', 'evil.example']) {
    const url = `https://${host}/probe`;
    if (safeAvatarUrl(url) === url) hosts.add(host);
  }
  return hosts;
};

describe('the avatar allow-list and the CSP img-src agree (ISSUEZ-009)', () => {
  it('every host safeAvatarUrl will emit is permitted by img-src', () => {
    const missing = [...jsAvatarHosts()].filter(h => !cspImgHosts().includes(h));
    expect(missing).toEqual([]);
  });

  it('img-src grants no image host the JS guard does not already allow', () => {
    const extra = cspImgHosts().filter(h => !jsAvatarHosts().has(h));
    expect(extra).toEqual([]);
  });

  it('keeps the scheme list honest while doing it', () => {
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'https://avatars.githubusercontent.com', 'https://camo.githubusercontent.com']);
  });

  it('does not widen the CSP beyond images while it is here', () => {
    // The document policy is the security control; a fix for a missing avatar host must
    // not have relaxed the rest of it.
    expect(directive('default-src')).toEqual(["'none'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('connect-src')).toEqual(["'self'", 'https://api.github.com']);
    expect(directive('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp).not.toMatch(/frame-ancestors/);
  });
});