# Issuez — Product Overview

## The Problem
GitHub's built-in issue trackers are limited: GitHub Projects can only track issues within a **single repository**. There is no native way to view **all issues assigned to you** across every repository and organization in one place — without first creating a GitHub Organization.

## The Goal
Build a lightweight, profile-wide GitHub issue tracker that:

- Aggregates **every issue assigned to a user** across all their repositories and organizations
- Displays them in a **single table**, grouped by project/repository
- Ranks issues by **severity/priority** (similar to GitHub Projects, but cross-repo)
- Requires only a **GitHub Personal Access Token (PAT)** — no organization setup needed

## Core Features

### 1. Authentication

> **Research First (before building anything):** Investigate the GitHub REST API and/or GitHub GraphQL API to determine what works **client-side only** (GitHub Pages, no backend) for:
> - Reading issues assigned to the authenticated user across repos and orgs (`GET /issues` endpoint with `assignee=@me`, `GET /repos`, `GET /orgs/{org}/repos`)
> - Reading issue comments (`GET /repos/{owner}/{repo}/issues/{issue_number}/comments`)
> - Creating/updating issue comments (`POST /repos/{owner}/{repo}/issues/{issue_number}/comments`)
> - Updating issue state/status (`PATCH /repos/{owner}/{repo}/issues/{issue_number}` — e.g., `state: open/closed`)
> - Adding/removing labels for priority/severity tracking (`POST/DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels`)
> - CORS support and rate limits (5,000 requests/hour for authenticated PAT/OAuth)
> - Whether the GitHub OAuth flow can complete without a backend (PKCE / `response_type=code` implicit flow limitations on static hosting)
> 
> **Document findings in the README** so the auth approach is justified by what the API actually supports in a static/Pages context.
>
> **Based on research, choose the simplest approach:**
> - Users log in via **GitHub OAuth** (PKCE-based, no client secret needed for mobile/SPA apps) — they simply click "Sign in with GitHub" (no manual token creation needed)
> - Provide a **fallback PAT option** for users who prefer it, with a setup guide walking them through creating a token with the correct scopes
> - **No personal data is stored** — the token is held in memory only (JavaScript variable / `sessionStorage`). It is never written to `localStorage`, cookies, or any persistent storage. The token is discarded when the tab closes or the user logs out
> - Users can revoke their PAT or OAuth access at any time from their GitHub settings

### 2. Issue Dashboard
- On login, automatically fetch all issues assigned to the authenticated user across all repos and orgs
- **Pagination:** The GitHub API paginates results (default 30/page). The app must follow `Link` headers or use GraphQL to fetch all pages until every issue is retrieved
- **Rate limit handling:** Check `X-RateLimit-Remaining` responses. When the limit is near zero, show a clear warning with the reset time (`X-RateLimit-Reset`) and pause further requests until then
- Render them in a **table view** (with a mobile card/list view fallback), separated/grouped by repository (project)
- Sort and rank issues by **severity** (priority) — severity is derived from labels (e.g., `priority: critical`, `priority: high`, `priority: medium`, `priority: low`). Issues without a priority label are treated as lowest priority
- **Search & filter:** Provide search across issue titles/bodies, and filters for repository, label, state (open/closed), and assignee
- **Sort options:** By severity, created date, updated date, repo name, and comment count
- **Pull request handling:** The `/issues` endpoint returns PRs as well. Detect PRs (they have a `pull_request` key) and either filter them out or display them in a separate section — do not mix them into the issue table
- **Loading & error states:** Show skeleton rows or a spinner while fetching. If a repo's issues fail to load, show an inline error with a retry button — don't block the entire dashboard
- **Refresh:** Include a manual "Refresh" button to re-fetch all issues. Optionally auto-refresh every 5 minutes if the tab is active

### 3. Issue Management
- Users can **change issue state** (open/closed) directly from the UI via `PATCH /repos/{owner}/{repo}/issues/{issue_number}`
- **Status simulation:** GitHub issues only have `open`/`closed` state — there is no native "in progress" or "done" status. Simulate workflow status using labels (e.g., `status: todo`, `status: in-progress`, `status: done`). The UI should present these as status toggles, but under the hood they add/remove labels
- Users can **leave comments** on issues through the UI via `POST /repos/{owner}/{repo}/issues/{issue_number}/comments`
- All changes are written back to GitHub via the API

### 4. Layout & Settings Persistence
- Since no user data is stored on a server, user preferences must survive cache clears and device changes via **local file export/import**
- Users can customize:
  - Table column layout (which columns to show, order, width)
  - Custom names/labels for projects or views
  - Theme selection
- Provide an **"Export Layout"** button that downloads a `.json` config file with all customizations
- Provide an **"Import Layout"** button to upload that `.json` file and restore the layout instantly
- This way users can move between machines or recover after clearing browser data without losing their setup

> **Forking Note:** Users can fork this repo, drop their exported `.json` layout file into the fork, and run their own personalized version of the app on GitHub Pages — no server setup, no data storage, just their layout and themes applied instantly.

### 5. UI / Themes
- The UI should feel **modern, polished, and fresh** — not like a typical developer tool
- Ships with multiple themes users can switch between:
  - **Light** — clean and bright
  - **Dark** — standard dark mode
  - **Colorful** — vibrant accents
  - **Neon** — glowing, high-contrast highlights
  - **Pink** — warm pink-dominant palette
- Theme selection persists across sessions (stored locally, no server needed)
- **Mobile responsiveness:** The table layout must collapse into a card-based list view on narrow screens. Each issue card shows title, repo, severity badge, status, and a detail expander. All management actions (status change, comments) remain accessible in card view

### 6. Deployment
- Runs as a **GitHub Pages** site
- Must be built as a **single `index.html`** entry point (GitHub Pages SPA — no server-side rendering)
- All app logic, styling, and assets bundled or inlined so the app loads from that single file

### 7. Documentation
- After the app is complete, create a **thorough `README.md`** that includes:
  - Project overview and features
  - Screenshots or rendered images of the app UI (use placeholder images named clearly like `screenshot-dark.png` if real screenshots aren't available)
  - Setup and running instructions
  - Available themes and how to switch them
  - Authentication setup (OAuth app registration and/or PAT creation)
  - A **Forking / Custom Deployment** section explaining how to fork the repo, add their exported `.json` layout file, and enable GitHub Pages on their fork to run their own personalized version cross-machine with zero backend setup
  - A **Security** section explaining:
    - No user data is stored — tokens are held in memory only and never written to disk, cookies, or localStorage
    - No backend server — the app runs entirely client-side in the browser
    - Tokens are used solely to make GitHub API calls and are discarded when the session ends
    - Users can revoke their PAT or OAuth access at any time from their GitHub settings
- Store images in an `assets/` or `images/` folder and reference them from the README

## Constraints
- Must work by just loggin in through GitHub or with just a PAT — no backend server required
- Must not save or store any user data
- Must support cross-repository (User-Level) issue aggregation
