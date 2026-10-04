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
- **5 themes** — Dark, Light, Colorful, Neon, and Pink
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
| `Dockerfile` | Node build stage → nginx runtime stage |
| `docker/nginx.conf` | Static server, response headers, `/healthz` |
| `docker-compose.yml` | Build + run with `${ISSUEZ_PORT:-2020}` on the host |

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

Switch themes from the header dropdown. Available themes:

| Theme | Description |
|-------|-------------|
| **Dark** | Standard dark mode with GitHub-inspired colors |
| **Light** | Clean, bright theme for daytime use |
| **Colorful** | Vibrant purple accents on a deep background |
| **Neon** | High-contrast glowing highlights on pure black |
| **Pink** | Warm pink-dominant palette |

Theme selection persists across sessions via `localStorage`.

## Layout Export / Import

Since Issuez runs entirely client-side, your layout preferences are stored in `localStorage`. To move them between devices:

1. Open **Settings**
2. Click **Export Layout** — downloads `issuez-layout.json`
3. On another device, open **Settings** → **Import Layout** and select the file

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

1. **build** (`node:22-alpine`) — `npm ci`, then `npm run build`. Only `index.html`, `vite.config.js`, `src/`, and `assets/` are copied in, so the dependency layer stays cached across code edits and the context stays small.
2. **serve** (`nginx:stable-alpine`) — copies `dist/` plus `docker/nginx.conf`. Node, `node_modules/`, and the toolchain are not in the runtime image.

`docker/nginx.conf` replaces the stock config to add what a static host cannot: the framing and MIME-sniffing headers described in [Security](#security), an explicit `application/manifest+json` type for `.webmanifest` (nginx's `mime.types` has no entry for it, and Chrome rejects the manifest otherwise), gzip, and a `/healthz` endpoint.

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
npm test            # vitest: helpers, sort, API layer, XSS sinks, build pipeline
```

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

**Rate limits:** 5,000 requests/hour for authenticated requests. The app monitors `X-RateLimit-Remaining` and pauses requests when the limit is exhausted.

**Pagination:** The app follows `Link` headers to fetch all pages of results automatically.

## Security

- **No backend server** — The app runs entirely client-side in the browser
- **No persistent storage** — Your token is held in memory (`sessionStorage`) only and is discarded when you close the tab or log out
- **No cookies, no localStorage for tokens** — Only layout preferences and theme are stored locally
- **Direct GitHub API** — All requests go directly to GitHub; no proxy or intermediary
- **Revocable access** — You can revoke your PAT at any time from GitHub Settings → Applications
- **Content-Security-Policy** — Shipped in `index.html` because a static host cannot set response headers. GitHub Pages also cannot set `X-Frame-Options`, so if you deploy somewhere else (or in front of Pages) add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` at the edge; browsers ignore `frame-ancestors` when the policy is delivered in a `<meta>` tag. The Docker image already does this — `docker/nginx.conf` sets `X-Frame-Options`, `X-Content-Type-Options`, and a `frame-ancestors 'none'` policy as real response headers, which combine with the `<meta>` policy rather than replacing it.

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
