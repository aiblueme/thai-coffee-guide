---
project: thai-coffee
url: https://thai-coffee.shellnode.lol
vps: ghost
port: 8420
stack: Jinja2-generated static HTML, nginx:alpine, SWAG
standards_version: "2.0"
security: done
ux_ui: done
repo_cleanup: done
readme: done
last_session: "2026-03-09"
has_blockers: false
---

# Project Status — thai-coffee

## Last Session
Date: 2026-03-09
Agent: Claude Code

### Completed
- [Security] Added missing `.dockerignore` (excluded .git, .env, .claude, scripts, templates, data, QA files)
- [Security] Added `.env.*` to `.gitignore`
- [Security] Added `Permissions-Policy: camera=(), microphone=(), geolocation=()` header to nginx.conf
- [Security] Added dotfile blocking `location ~ /\.` block to nginx.conf
- [Security] Fixed `EXPOSE 8420` → `EXPOSE 80` in Dockerfile (nginx listens on 80, host port 8420 is the compose mapping)
- [Security] Added `mem_limit: 128m` to docker-compose.yml
- [Repo] Added "Live" URL section (`https://thai-coffee.shellnode.lol`) to README
- [Repo] Fixed deploy instructions in README (removed outdated `git init` first-time setup)
- [Repo] Added MIT LICENSE file
- [UX/UI] Full audit — no P1 or P2 issues found. Site is well-structured.
- Pushed 2 commits to `origin/master` — commits db7dac4 and 63cde4d

### Incomplete
- None

### Blocked — Needs Matt
- None

## Backlog
- [P3] Add `og:url` meta tag to all pages — missing from base.html template. Requires site rebuild (`python scripts/build_site.py`) after template edit.
- [P3] "Where to Buy" section uses emoji icons (🏪🛒📦☕) — borderline per global aesthetic preferences. Matt to decide if they should be replaced with text/CSS icons.
- [P3] `server_tokens off` not set in nginx.conf (may be handled at SWAG proxy level — check before adding)
- [P3] CSP header omitted — site loads Google Fonts (fonts.googleapis.com + fonts.gstatic.com), would need font-src and style-src directives. Skip or add project-specific CSP.

## Done
- [x] Full security audit — 2026-03-09 — commit db7dac4
- [x] Repo/README audit — 2026-03-09 — commit 63cde4d
- [x] UX/UI audit (no fixes needed) — 2026-03-09

## Decisions Log
- "EXPOSE in Dockerfile was 8420 (host port) — corrected to 80 (container internal port). Host port mapping lives in docker-compose.yml only." (2026-03-09)
- "Table with min-width: 900px wrapped in .table-scroll-wrapper with overflow-x: auto on compare page — not a mobile overflow bug." (2026-03-09)
- "og:url P3 — not fixed this session because it requires template edit + site rebuild. Logged to backlog." (2026-03-09)
- "CSP skipped — Google Fonts CDN requires font-src/style-src allowlist, not appropriate to add a generic CSP. P3 backlog item." (2026-03-09)
- "dist/ committed to repo — this is the build output. Not gitignored because no CI pipeline. Intentional and working." (2026-03-09)

## Project Notes
- Build pipeline: Jinja2 templates + data/coffee-data.json → dist/ via scripts/build_site.py
- Images: icrawler-downloaded WebP in images/processed/, committed in dist/images/
- 16 brands covered, 4 page types: index, compare, guide, /brands/{slug}.html
- Service name in compose is `thai-coffee`, container_name is `thai-coffee-guide` — intentional, matches SWAG swag_address label
- SWAG URL: `thai-coffee.shellnode.lol` (not thai-coffee-guide)
- QA artifacts (qa-report.md, qa-results.json, qa-screenshots/, qa-tests/) are in repo but excluded from Docker build via .dockerignore
