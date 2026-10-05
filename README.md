# Issuez — Cross-Repo GitHub Issue Tracker

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![GitHub Pages](https://img.shields.io/badge/deployment-GitHub%20Pages-222222?logo=github)

**Issuez** aggregates every issue assigned to you across all your GitHub repositories and organizations into a single, modern dashboard — no organization setup required.

<img width="1919" height="928" alt="Issuez Dashboard" src="https://github.com/user-attachments/assets/6859a83c-9541-4a38-939b-59ef5084809f" />

## Features

- **Cross-repo aggregation** — See all issues assigned to you across every repo and org in one table
- **Priority ranking** — Issues are ranked by severity derived from labels (`priority: critical`, `high`, `medium`, `low`)
- **Status simulation** — Simulate workflow with `status: todo`, `in-progress`, `done` labels
- **Full-text search** — Search across issue titles and bodies in real time
- **Filter & sort** — Filter by repo, state, and assignee; sort by priority, date, repo, or comments
- **Inline management** — Close/reopen issues, add comments, and cycle status labels directly from the UI
- **18 themes** — Dark, Light, Bubbles, Neon, Pink, Rainbow, Sunset Glow, Sky Gradient, Berry Cobalt, Ghost, Solar, Eclipse, Pop, Gold Signal, Moss, Zen, Dusty, Violet
- **Layout export/import** — Download/upload your layout config as JSON to move between machines
- **Client-side only** — Runs entirely in the browser with no backend server

## Quick Start

1. Open the app in your browser (GitHub Pages or local)
2. Click **Connect with PAT** and paste your token
3. Browse, search, filter, and manage your issues

## Run with Docker

The production build is a static single-file bundle, so the container is nginx serving `dist/` and nothing else. The image builds the bundle in a Node stage and ships only nginx at runtime — no Node and no backend process in the final image.

```bash
docker compose up -d --build     # http://localhost:2020
```

If 2020 is taken, override the host port:

```bash
ISSUEZ_PORT=9090 docker compose up -d --build
```

Without Compose:

```bash
docker build -t issuez .
docker run -d --name issuez -p 2020:80 issuez
```

The container holds no state — your PAT and layout live in the browser — so there is no volume to mount and rebuilding loses nothing. `GET /healthz` returns `ok` and backs the image healthcheck.

| Path | Purpose |
|------|---------|
| `Dockerfile` | Node build stage → nginx runtime stage, both pinned by digest |
| `docker/nginx.conf` | Static server, response headers, `/healthz` |
| `docker-compose.yml` | Build + run with `${ISSUEZ_PORT:-2020}` on the host |

The image was changed but never built or run: there is no Docker daemon on the machine the
change was made on, so a pin or a base-image pull can only be proven with
`docker compose up --build` on a host that has one.

npm is still the development workflow — use it for `npm run dev` and `npm test`; use the container to run the app.

## Authentication

Issuez runs entirely client-side, so it uses a **Personal Access Token (PAT)** instead of OAuth. GitHub’s OAuth `access_token` endpoint blocks browser requests via CORS, so a backend would be required for OAuth.

1. Go to https://github.com/settings/tokens
2. Generate a new token (classic) with scopes:
   - `repo` (to read and write issues)
   - `read:org` (to list organization repositories)
3. Paste the token into the login field
4. Click **Connect**

**Security note:** Your token is held in browser memory only (`sessionStorage`). It is discarded when you close the tab or log out. It is never written to `localStorage`, cookies, or any persistent storage.

## Themes

Switch themes from the header dropdown or in **Settings**. The app ships 18 themes:

`dark` · `light` · `bubbles` · `neon` · `pink` · `rainbow` · `sunset-glow` ·
`sky-gradient` · `berry-cobalt` · `ghost` · `solar` · `eclipse` · `pop` ·
`gold-signal` · `moss` · `zen` · `dusty` · `violet`

`dark` is the default and is the base palette rather than an override; the other 17 are
`[data-theme="…"]` blocks in `src/styles.css`, which is the source of truth for what each
one looks like. Theme selection persists across sessions via `localStorage`.

## Layout Export / Import

Since Issuez runs entirely client-side, your layout preferences (theme and the current sort
column and direction) are stored in `localStorage` under `issuez_layout` and restored on
the next load. To move them between devices:

1. Open **Settings**
2. Click **Export Layout** — downloads `issuez-layout.json`
3. On another device, open **Settings** → **Import Layout** and select the file

Exporting writes the same preferences plus a `columns` list and an `exportedAt` stamp;
importing writes the preferences back to `localStorage` so they survive a reload.

## Forking & Custom Deployment

You can fork this repo, add your exported layout file, and deploy your own personalized version on GitHub Pages in minutes.

1. Fork the repository
2. (Optional) Add your `issuez-layout.json` to the root of the fork
3. Go to **Settings → Pages** in your fork
4. Set **Source** to `Deploy from a branch` and select `main` / `/dist`
5. Your personalized instance is live at `https://<your-username>.github.io/issuez/`

No backend, no server setup, no data storage — just your layout and themes applied instantly.

## Architecture

### Single-File Build

The production build bundles all CSS and JavaScript into a single `dist/index.html` file using `vite-plugin-singlefile`. This makes deployment to GitHub Pages trivial — just enable Pages and point it at the `dist` folder, and it makes the container trivial: there is one document to serve and a handful of static assets beside it.

### Container Image

Two stages, no shared state:

1. **build** (`node:22-alpine`, pinned by digest) — `npm ci`, then `npm run build`. Only `index.html`, `vite.config.js`, `src/`, and `assets/` are copied in, so the dependency layer stays cached across code edits and the context stays small. Because every toolchain package is a devDependency, this stage also installs `vitest` and `jsdom`, which it never uses.
2. **serve** (`nginx:stable-alpine`, pinned by digest) — copies `dist/` plus `docker/nginx.conf`, drops `conf.d/default.conf`, and runs as the unprivileged `nginx` user. Node, `node_modules/`, and the toolchain are not in the runtime image.

`docker/nginx.conf` replaces the stock config to add what a static host cannot: the framing and MIME-sniffing headers described in [Security](#security), an explicit `application/manifest+json` type for `.webmanifest` (nginx's `mime.types` has no entry for it, and Chrome rejects the manifest otherwise), gzip, and a `/healthz` endpoint. It also relocates the pid file and the logs to paths the unprivileged user can write.

### Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 to see the app in development mode.

### Build

```bash
npm run build       # Single-file HTML output (dist/index.html)
```

The build uses `vite-plugin-singlefile` to bundle all CSS and JavaScript into a single `dist/index.html` file. There is no post-build patching step: `npm run build` output is the finished artifact.

### Test

```bash
npm test            # vitest: helpers, sort, API layer, UI/a11y, CSP, XSS sinks, build pipeline
```

| Suite | Covers |
|-------|--------|
| `tests/helpers.test.js` | Sorting, label/URL/colour guards, `escapeHtml`, `timeAgo` |
| `tests/github-api.test.js` | Rate-limit budget, error-body mapping, pagination URLs |
| `tests/ui.test.js` | The real `setState` → `render()` path in jsdom: region rendering, search focus, toast lifetime, dialog semantics and focus, listbox keyboard operation, label association, layout persistence, logout |
| `tests/security-config.test.js` | The CSP `img-src` directive and the avatar allow-list agree |
| `tests/xss.test.js` | Hostile payloads through the real render path |
| `tests/build-pipeline.test.js` | A real `vite build` |

`tests/build-pipeline.test.js` runs the real build and fails if the committed entrypoint is ever overwritten, if a post-build patcher reappears, or if the bundle stops containing behaviour that only exists in `src/`.

### API

The app uses the GitHub REST API v3:

| Endpoint | Purpose |
|----------|---------|
| `GET /user` | Current authenticated user |
| `GET /user/repos` | User's repositories |
| `GET /user/orgs` | User's organizations |
| `GET /orgs/{org}/repos` | Organization repositories |
| `GET /repos/{owner}/{repo}/issues` | Repository issues (PRs filtered out) |
| `GET /repos/{owner}/{repo}/issues/{number}/comments` | Issue comments |
| `POST /repos/{owner}/{repo}/issues/{number}/comments` | Post comment |
| `PATCH /repos/{owner}/{repo}/issues/{number}` | Update issue (state) |
| `POST /repos/{owner}/{repo}/issues/{number}/labels` | Add label |
| `DELETE /repos/{owner}/{repo}/issues/{number}/labels/{name}` | Remove label |

**Rate limits:** 5,000 requests/hour for authenticated requests. The app reads `X-RateLimit-Remaining` from every response and pauses between requests once the budget runs out. A response that omits the header leaves the known budget alone rather than assuming a fresh one, and a 403 carrying a secondary rate limit is reported as one rather than as an authorization failure.

**Pagination:** The app follows `Link` headers to fetch all pages of results automatically.

**Pull requests cost quota:** `GET /repos/{owner}/{repo}/issues` returns pull requests on
the same endpoint as issues and REST v3 has no server-side filter for them, so every page
of every repo also carries its pull requests before the client drops them. This is the
reason the [GraphQL support](#roadmap) roadmap item exists: a single GraphQL query can ask
for issues only.

## Security

- **No backend server** — The app runs entirely client-side in the browser
- **No persistent storage** — Your token is held in memory (`sessionStorage`) only and is discarded when you close the tab or log out
- **No cookies, no localStorage for tokens** — Only layout preferences and theme are stored locally
- **Direct GitHub API** — All requests go directly to GitHub; no proxy or intermediary
- **Revocable access** — You can revoke your PAT at any time from GitHub Settings → Applications
- **Content-Security-Policy** — Shipped in `index.html` because a static host cannot set response headers. GitHub Pages also cannot set `X-Frame-Options`, so if you deploy somewhere else (or in front of Pages) add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` at the edge; browsers ignore `frame-ancestors` when the policy is delivered in a `<meta>` tag. The Docker image already does this — `docker/nginx.conf` sets `X-Frame-Options`, `X-Content-Type-Options`, and a `frame-ancestors 'none'` policy as real response headers, which combine with the `<meta>` policy rather than replacing it.

## Installability and offline use

`assets/manifest.webmanifest` ships so the dashboard appears in the browser's install
list with its own name, icon and colours. **No service worker is registered**, so this is
install-intent only: nothing is cached and the app has no offline mode, because the whole
point is that it talks to the GitHub API with a token held in `sessionStorage`. Adding a
service worker means deciding what may be cached — authenticated API responses must never
be — which is the [PWA support](#roadmap) roadmap item, not a footnote.

## Roadmap

- [ ] GraphQL support for faster cross-repo queries
- [ ] Saved filters and views
- [ ] Issue assignment and unassignment
- [ ] Batch operations (close multiple, add labels)
- [ ] Keyboard shortcuts
- [ ] Desktop notifications for new assigned issues
- [ ] PWA support for offline access

## Contributing

Pull requests are welcome. Please preserve the existing architecture and match the code style.

## License

MIT
