import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bundle() {
  await build({
    root: __dirname,
    build: {
      outDir: join(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: join(__dirname, 'index.html'),
      },
    },
  });

  let html = readFileSync(join(__dirname, 'index.html'), 'utf-8');

  // Inline CSS
  const cssPath = join(__dirname, 'dist', 'assets');
  const cssFiles = readdirSync(cssPath).filter(f => f.endsWith('.css'));
  let css = '';
  for (const f of cssFiles) {
    css += readFileSync(join(cssPath, f), 'utf-8');
  }
  html = html.replace('<link rel="stylesheet" href="/src/styles.css">', `<style>${css}</style>`);

  // Inline JS
  const jsFiles = readdirSync(cssPath).filter(f => f.endsWith('.js'));
  let js = '';
  for (const f of jsFiles) {
    js += readFileSync(join(cssPath, f), 'utf-8');
  }
  html = html.replace('<script type="module" src="/src/main.js"></script>', `<script>${js}</script>`);

  writeFileSync(join(__dirname, 'dist', 'index.html'), html);
  console.log('Single-file build complete: dist/index.html');
}

bundle().catch(e => { console.error(e); process.exit(1); });
